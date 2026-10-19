"""The planner (SPEC §7.4): Claude designs the Plan JSON from the transcript, keyframes, subject,
the user's images, the style and brand. Structured output through a tool whose `input_schema` is
the Plan JSON Schema; prompt caching on the big identical prefix (prompt + schema + few-shot);
validation inside Chromium with the real font metrics; one repair round on hard errors.
"""

from __future__ import annotations

import base64
import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import structlog

from rasika_worker.settings import Settings

log = structlog.get_logger("rasika.worker.planner")

HERE = Path(__file__).resolve().parent
PROMPT = HERE.parents[0] / "prompts" / "planner.md"
EXAMPLES_DIR = PROMPT.parent / "examples"
_REPO = HERE.parents[2] if len(HERE.parents) > 2 else None
SCHEMA_CANDIDATES = [
    (_REPO / "packages" / "schema" / "plan.schema.json") if _REPO else None,
    Path("/app/schema/plan.schema.json"),
]
FEWSHOT_CANDIDATES = [
    (_REPO / "plans" / "baisa_bling.json") if _REPO else None,
    Path("/app/plans/baisa_bling.json"),
]
FEWSHOT_WORDS = [
    (_REPO / "plans" / "baisa_bling.words.json") if _REPO else None,
    Path("/app/plans/baisa_bling.words.json"),
]
STYLE_GUIDE = [
    (_REPO / "reference" / "mikku" / "references" / "style-guide.md") if _REPO else None,
    Path("/app/prompts/style-guide.md"),
]


def _first(paths: list[Path | None]) -> Path:
    for p in paths:
        if p and p.exists():
            return p
    raise FileNotFoundError(f"none of {paths} exist")


def load_plan_schema() -> dict[str, Any]:
    bundle = json.loads(_first(SCHEMA_CANDIDATES).read_text(encoding="utf-8"))
    schema = dict(bundle["$defs"]["Plan"])
    schema["$defs"] = bundle["$defs"]
    return schema


@dataclass
class PlannerInput:
    duration_sec: float
    language: str
    words: list[dict[str, Any]]
    subject: dict[str, Any]
    style: dict[str, Any]
    style_text: str | None
    brand: dict[str, Any]
    images: list[dict[str, Any]]  # {id, label, sayWhen, path}
    keyframes: list[Path]
    industry: str | None = None
    options: dict[str, Any] = field(
        default_factory=dict
    )  # captions / sfxIntensity / music / language
    # the wall behind the speaker is dark → ivory/gold tokens even in full/zoom modes
    wall_is_dark: bool = False
    # "Match a reference": frames of the reel whose look this edit must copy
    reference_stills: list[Path] = field(default_factory=list)


@dataclass
class PlannerResult:
    plan: dict[str, Any]
    report: dict[str, Any]
    ok: bool
    usage: dict[str, int]
    attempts: int
    seconds: float
    raw_first: dict[str, Any] | None = None


def compact_words(words: list[dict[str, Any]]) -> str:
    return "\n".join(f"{i}|{float(w['t']):.2f}|{w['w']}" for i, w in enumerate(words))


def _b64_image(path: Path, max_bytes: int = 1_500_000) -> dict[str, Any]:
    data = path.read_bytes()
    if len(data) > max_bytes:  # keyframes are 540 px wide; user images may be larger
        try:
            from PIL import Image

            im = Image.open(path)
            im.thumbnail((720, 720))
            from io import BytesIO

            buf = BytesIO()
            im.convert("RGB").save(buf, format="JPEG", quality=82)
            data = buf.getvalue()
        except Exception:  # pragma: no cover
            pass
    # the bytes decide the type: a large PNG re-encoded above is JPEG now, whatever its name says
    mt = (
        "image/png"
        if data[:4] == b"\x89PNG"
        else "image/webp"
        if data[:4] == b"RIFF" and data[8:12] == b"WEBP"
        else "image/gif"
        if data[:6] in (b"GIF87a", b"GIF89a")
        else "image/jpeg"
    )
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": mt, "data": base64.b64encode(data).decode()},
    }


class Planner:
    def __init__(self, settings: Settings, client: Any | None = None) -> None:
        self.s = settings
        if client is None:
            import anthropic

            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.client: Any = client
        self.schema = load_plan_schema()
        self._prefixes: dict[str, list[dict[str, Any]]] = {}
        self.system_prefix = self._prefix_for("editorial")

    def _prefix_for(self, family: str) -> list[dict[str, Any]]:
        """One cached system prefix per motion family (prompt + craft guide + that family's example)."""
        key = family if (EXAMPLES_DIR / f"{family}.json").exists() else "editorial"
        if key not in self._prefixes:
            self._prefixes[key] = self._system_prefix(key)
        return self._prefixes[key]

    # ── the cached prefix: prompt + style guide + schema + few-shot ──
    def _system_prefix(self, family: str = "editorial") -> list[dict[str, Any]]:
        prompt = PROMPT.read_text(encoding="utf-8")
        try:
            guide = _first(STYLE_GUIDE).read_text(encoding="utf-8")
        except FileNotFoundError:
            guide = ""
        example = EXAMPLES_DIR / f"{family}.json"
        if example.exists():
            # a 24 s realtor clip planned in this family's vocabulary — the craft *and* the moves
            fewshot_plan = json.loads(example.read_text(encoding="utf-8"))
            fewshot_words = json.loads((EXAMPLES_DIR / "words.json").read_text(encoding="utf-8"))[
                "words"
            ]
            excerpt = compact_words(fewshot_words)
            label = f"Plan (realtor, 24 s, **{family}** family — the moves this family makes):"
        else:
            fewshot_plan = json.loads(_first(FEWSHOT_CANDIDATES).read_text(encoding="utf-8"))
            fewshot_plan.pop("$schema", None)
            fewshot_words = json.loads(_first(FEWSHOT_WORDS).read_text(encoding="utf-8"))["words"]
            excerpt = compact_words(fewshot_words[:60]) + "\n…"
            label = "Plan (jewellery brand, 90 s, editorial family):"
        text = (
            prompt
            + "\n\n---\n\n# Reference style guide (the craft; vocabulary is the example's, not yours)\n\n"
            + guide
            + "\n\n---\n\n# Worked example\n\nTranscript excerpt (`index|start|word`):\n\n"
            + excerpt
            + "\n\n"
            + label
            + "\n\n```json\n"
            + json.dumps(fewshot_plan, ensure_ascii=False)
            + "\n```\n"
        )
        return [{"type": "text", "text": text, "cache_control": {"type": "ephemeral"}}]

    def _user_content(self, inp: PlannerInput) -> list[dict[str, Any]]:
        parts: list[dict[str, Any]] = []
        meta = {
            "durationSec": inp.duration_sec,
            "language": inp.language,
            "industry": inp.industry or "unknown — infer from the words",
            "styleText": inp.style_text or "",
            "brand": inp.brand,
            "options": inp.options,
        }
        parts.append(
            {
                "type": "text",
                "text": "## This reel\n\n" + json.dumps(meta, ensure_ascii=False, indent=1),
            }
        )
        style_tokens = {k: v for k, v in inp.style.items() if k != "motion"}
        motion = dict(inp.style.get("motion") or {})
        parts.append(
            {
                "type": "text",
                "text": "## Style tokens\n\n" + json.dumps(style_tokens, ensure_ascii=False),
            }
        )
        parts.append({"type": "text", "text": motion_brief(inp.style, motion)})
        if inp.options.get("broll"):
            parts.append({"type": "text", "text": BROLL_BRIEF})
        fb = film_brief(inp.options)
        if fb:
            parts.append({"type": "text", "text": fb})
        if inp.options.get("faceless"):
            stage = str((inp.style.get("palette") or {}).get("stage") or "#000000")
            tokens = "`iv` / `gold`" if hex_luma(stage) < 0.5 else "`mar` / `ter` / `goldd`"
            parts.append(
                {
                    "type": "text",
                    "text": "## Subject\n\nThere is NO speaker on screen: this is a narrated, "
                    "script-only film. The footage is a plain stage-coloured plate in every mode, "
                    "so the whole frame (y 150–1500) is yours. Carry every line with typography and "
                    "cards — a poster line, counter, chapter card or image should be on screen for "
                    "every sentence; never leave the plate empty for more than 1.5 s. Stay in `full` "
                    "mode for the whole reel (the other modes only frame an empty plate). Poster lines "
                    "are the picture: 2–4 words at 150–260 px, placed around the middle of the frame "
                    "(y 500–1100), with a kicker or second line under them; one per sentence, replaced "
                    "on the next sentence. Counters at 220+ px. Captions sit in the lower third as "
                    f"usual. Text colours: {tokens} throughout.",
                }
            )
        else:
            wall = (
                "The wall behind the speaker is DARK: use `iv` / `gold` for every poster line, "
                "including in `full` and `zoom` modes, never `mar` / `ter` / `goldd`."
                if inp.wall_is_dark
                else "The wall behind the speaker is light: `mar` / `ter` / `goldd` in `full` / "
                "`zoom`, `iv` / `gold` on the dark stage modes."
            )
            parts.append(
                {
                    "type": "text",
                    "text": "## Subject (stage pixels, from face detection)\n\n"
                    + json.dumps(inp.subject)
                    + "\n\n"
                    + wall,
                }
            )
        parts.append(
            {
                "type": "text",
                "text": f"## Transcript ({len(inp.words)} words, `index|start|word`)\n\n"
                + compact_words(inp.words),
            }
        )
        if inp.keyframes:
            parts.append(
                {"type": "text", "text": f"## Keyframes ({len(inp.keyframes)}, evenly spaced)"}
            )
            for kf in inp.keyframes[:6]:
                parts.append(_b64_image(kf))
        if inp.reference_stills:
            parts.append({"type": "text", "text": REFERENCE_FRAMES_BRIEF.format(n=len(inp.reference_stills[:4]))})
            for still in inp.reference_stills[:4]:
                parts.append(_b64_image(still))
        if inp.images:
            parts.append(
                {
                    "type": "text",
                    "text": "## The user's images (use the `id` as imageId; show them only for what they are)",
                }
            )
            for im in inp.images[:15]:
                desc = {
                    "id": im["id"],
                    "label": im.get("label") or "",
                    "showWhenISay": im.get("sayWhen") or "",
                }
                parts.append({"type": "text", "text": json.dumps(desc, ensure_ascii=False)})
                p = im.get("path")
                if p and Path(p).exists():
                    parts.append(_b64_image(Path(p)))
        else:
            parts.append(
                {
                    "type": "text",
                    "text": "## The user's images\n\nNone. Use patternCards, counters, chips, equations and typography for visuals.",
                }
            )
        parts.append(
            {
                "type": "text",
                "text": (
                    "Design the plan for THIS reel now. Use `version: 1`, `meta.fps: 30`, `meta.width: 1080`, "
                    "`meta.height: 1920`, the given durationSec and language, the style tokens verbatim as `style`, "
                    "the subject as given. Call `emit_plan` once."
                ),
            }
        )
        return parts

    def _call(
        self,
        messages: list[dict[str, Any]],
        family: str = "editorial",
        max_tokens: int = 32000,
    ) -> tuple[dict[str, Any] | None, dict[str, int], str]:
        # Streaming is mandatory for large outputs (the SDK refuses >10-minute non-streamed calls).
        with self.client.messages.stream(
            model=self.s.anthropic_planner_model,
            max_tokens=max_tokens,
            system=self._prefix_for(family),
            tools=[
                {
                    "name": "emit_plan",
                    "description": "Emit the Plan JSON for this reel.",
                    "input_schema": self.schema,
                }
            ],
            # Opus 5.5 rejects forced tool choice; the prompt demands the call, and we fall back
            # to a JSON block in text if the model answers in prose.
            tool_choice={"type": "auto"},
            messages=messages,
        ) as stream:
            resp = stream.get_final_message()
        usage = {
            "input_tokens": resp.usage.input_tokens,
            "output_tokens": resp.usage.output_tokens,
            "cache_read": getattr(resp.usage, "cache_read_input_tokens", 0) or 0,
            "cache_write": getattr(resp.usage, "cache_creation_input_tokens", 0) or 0,
        }
        plan = next((b.input for b in resp.content if b.type == "tool_use"), None)
        if plan is None:
            text = "".join(getattr(b, "text", "") for b in resp.content)
            start, end = text.find("{"), text.rfind("}")
            if start >= 0 and end > start:
                try:
                    plan = json.loads(text[start : end + 1])
                except json.JSONDecodeError:
                    plan = None
        return (dict(plan) if plan else None), usage, resp.stop_reason or ""

    def plan(self, inp: PlannerInput, validator: Any) -> PlannerResult:
        """validator(plan, words, image_ids) → {ok, plan, issues}."""
        t0 = time.time()
        total: dict[str, int] = {
            "input_tokens": 0,
            "output_tokens": 0,
            "cache_read": 0,
            "cache_write": 0,
        }
        user = self._user_content(inp)
        family = str((inp.style.get("motion") or {}).get("family") or "editorial")
        messages: list[dict[str, Any]] = [{"role": "user", "content": user}]
        plan, usage, stop = self._call(messages, family)
        for k in total:
            total[k] += usage.get(k, 0)
        log.info("planner_call", attempt=1, stop=stop, **usage)
        if stop == "max_tokens":
            # A truncated tool call comes back as a partial/empty input that would validate as an
            # empty plan — never accept it. One retry asking for a tighter answer.
            messages.append(
                {
                    "role": "user",
                    "content": "Your previous answer was cut off by the output limit. Answer again with the "
                    "complete plan, more compactly: short ids, no optional fields at their defaults, "
                    "no more than ~45 elements.",
                }
            )
            plan, usage, stop = self._call(messages, family)
            for k in total:
                total[k] += usage.get(k, 0)
            log.info("planner_call", attempt="1b", stop=stop, **usage)
            if stop == "max_tokens":
                raise RuntimeError("planner output exceeded the token limit twice")
        if plan is None:
            raise RuntimeError(f"planner returned no tool call (stop={stop})")
        if len(plan.get("elements") or []) < self.min_elements(inp.duration_sec):
            raise RuntimeError(
                f"planner returned {len(plan.get('elements') or [])} elements for {inp.duration_sec:.0f} s"
            )
        raw_first = json.loads(json.dumps(plan))
        plan = self._normalise(plan, inp)
        image_ids = [im["id"] for im in inp.images]
        report = validator(plan, inp.words, image_ids)
        attempts = 1
        errors = [i for i in report["issues"] if i["level"] == "error"]
        if errors:
            # one repair round with the error list (SPEC §7.4)
            fixes = "\n".join(
                f"- [{e['code']}] {e.get('elementId', '')}: {e['message']}" for e in errors[:40]
            )
            messages.append(
                {
                    "role": "assistant",
                    "content": [
                        {
                            "type": "tool_use",
                            "id": "toolu_plan_1",
                            "name": "emit_plan",
                            "input": raw_first,
                        }
                    ],
                }
            )
            messages.append(
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": "toolu_plan_1",
                            "content": "Validated. Hard errors remain:\n" + fixes,
                        },
                        {
                            "type": "text",
                            "text": "Fix every listed error and call `emit_plan` again with the complete corrected plan. Keep everything else the same.",
                        },
                    ],
                }
            )
            plan2, usage, stop = self._call(messages, family)
            for k in total:
                total[k] += usage.get(k, 0)
            attempts = 2
            log.info("planner_call", attempt=2, stop=stop, **usage)
            if plan2 is not None:
                plan2 = self._normalise(plan2, inp)
                report2 = validator(plan2, inp.words, image_ids)
                errors2 = [i for i in report2["issues"] if i["level"] == "error"]
                if len(errors2) <= len(errors) and report2.get("plan"):
                    plan, report = plan2, report2
        fixed = report.get("plan")
        if not fixed:
            # the validator could not even parse it (schema-level failure) — say so, don't crash
            msgs = "; ".join(
                str(i.get("message", "")) for i in report["issues"] if i["level"] == "error"
            )[:400]
            raise RuntimeError(f"plan fails the schema after {attempts} attempt(s): {msgs}")
        if inp.wall_is_dark:
            swapped = swap_wall_tokens(fixed)
            if swapped:
                report["issues"].append(
                    {
                        "level": "fixed",
                        "code": "color.darkWall",
                        "message": f"{swapped} colours switched to ivory/gold for the dark wall",
                    }
                )
        summary = {
            "ok": report["ok"],
            "attempts": attempts,
            "firstErrors": errors[:40],
            "errors": [i for i in report["issues"] if i["level"] == "error"],
            "warnings": [i for i in report["issues"] if i["level"] == "warn"],
            "fixed": [
                i
                for i in report["issues"]
                if i["level"] == "fixed" and i["code"] != "anchor.inferred"
            ],
            "anchorsInferred": sum(1 for i in report["issues"] if i["code"] == "anchor.inferred"),
            "usage": total,
            "model": self.s.anthropic_planner_model,
            "seconds": round(time.time() - t0, 1),
            "elements": len(fixed.get("elements", [])),
            "modeSwitches": len(fixed.get("videoModes", [])),
        }
        return PlannerResult(
            fixed, summary, bool(report["ok"]), total, attempts, summary["seconds"], raw_first
        )

    @staticmethod
    def min_elements(duration_sec: float) -> int:
        """Below this the plan is a failure, not a style: roughly one element per 8 s, at least 3."""
        return max(3, int(duration_sec / 8))

    def _normalise(self, plan: dict[str, Any], inp: PlannerInput) -> dict[str, Any]:
        """Pin the fields the model must not change; drop elements the style bans."""
        motion = inp.style.get("motion") or {}
        banned = set(motion.get("avoidElements") or [])
        if banned and isinstance(plan.get("elements"), list):
            kept = [e for e in plan["elements"] if e.get("type") not in banned]
            if len(kept) != len(plan["elements"]):
                log.info("planner_dropped_banned", n=len(plan["elements"]) - len(kept))
            plan["elements"] = kept
        case = str(motion.get("caseStyle") or "auto")
        sentence = (
            case == "sentence" or (case == "auto" and motion.get("family") in MIXED_CASE_FAMILIES)
        )
        if sentence and isinstance(plan.get("elements"), list):
            for el in plan["elements"]:
                for line in el.get("lines") or []:
                    if isinstance(line, dict) and isinstance(line.get("text"), str):
                        line["text"] = sentence_case(line["text"])
        plan["version"] = 1
        plan["meta"] = {
            "durationSec": inp.duration_sec,
            "fps": 30,
            "width": 1080,
            "height": 1920,
            "language": inp.language,
        }
        plan["style"] = inp.style
        plan.setdefault("subject", inp.subject)
        plan.setdefault("captions", {"enabled": True, "y": 1400, "gold": [], "accent": []})
        plan["captions"]["enabled"] = bool(inp.options.get("captions", True))
        plan.setdefault("sfx", {"auto": True, "intensity": 0.8})
        if "sfxIntensity" in inp.options:
            plan["sfx"]["intensity"] = float(inp.options["sfxIntensity"])
        if not inp.options.get("broll") and isinstance(plan.get("elements"), list):
            plan["elements"] = [e for e in plan["elements"] if e.get("type") != "broll"]
        plan.setdefault("videoModes", [{"t": 0, "mode": "full"}])
        if inp.options.get("faceless"):
            # no speaker: the framed modes would only frame an empty plate
            plan["videoModes"] = [{"t": 0, "mode": "full"}]
            plan.setdefault("meta", {})["faceless"] = True
        elif ((inp.style or {}).get("motion") or {}).get("framing") == "full":
            plan["videoModes"] = keep_full_bleed(plan["videoModes"])
        plan.setdefault("elements", [])
        seen: set[str] = set()
        for i, el in enumerate(plan["elements"]):
            eid = str(el.get("id") or f"e{i}")
            while eid in seen:
                eid += "x"
            el["id"] = eid
            seen.add(eid)
        return plan



FILM_COMMON = """## This is a brief film (kind: {kind})

There is no speaker: the whole 1080×1920 frame is yours, in `full` mode throughout. The transcript
is the film's on-screen script{spoken} — design the film from it and from the data below, which the
writer produced from the user's brief. Use the data verbatim (names, measures, colours, hits).

### The film's data
{data}
"""

FILM_KINDS = {
    "launch": """### Kind: SaaS launch film
- Open on the product name as huge poster type (200–300 px), one line, centred, with the tagline under it.
- Each feature gets ~4–6 s: a `browserCard` holding the screenshot whose label the feature's `shot` names
  (use that image's id; `url` = the product's host; scroll 0.25–0.6; tilt −4…4; vary x/y/w between
  features), with the feature title as poster type (120–180 px) and its benefit line beside or under it.
- Use the "Phone view" screenshot once as a tilted `imageCard` beside a browser window.
- A `chips` row of 2–3 short benefits once; a quick montage of 2–3 screens near the end (short windows).
- Close on the name again and the call to action, large. Something moves every 1.5–2.5 s.""",
    "showreel": """### Kind: 15-second motion showreel
- More motion than words: poster slams of 1–3 words (220–320 px) on the beat, every ~1 s.
- Two or three `browserCard`s of the real screenshots flying through at bold tilts (±8°), overlapping
  briefly with the type; one big reveal of the name (`reveal`) in the last 3 s.""",
    "app": """### Kind: Apple-style app film
- One idea per beat, generous empty space: a single sentence-case poster line (90–140 px) per beat,
  centred around y 300–420, nothing else beside it.
- The real screens presented calmly: a `browserCard` (scroll 0.1–0.25, tilt 0) or the "Phone view" as an
  `imageCard` with no tilt, centred, below the line. Slow; ≥ 2.5 s per beat.
- Final beat: the product name alone, large, centred.""",
    "recipe": """### Kind: recipe explainer
- ONE `pourGlass` carries the film: t0 just before the first ingredient's line, t1 = the end. Its
  `layers` are the data's layers in order (name, amount, color, fill as given); each layer's `at` is the
  start of the line that names that ingredient, minus the glass's t0; `dur` 1.0–1.6. `garnish` from the
  data, `at` on its line. `glass` and `ice` from the data. Centre it (cx 540–600, top 560–700, size 700–820).
- The drink's name as poster type at the top (y 170–300) from the start; the method steps as `chips`
  near the end (top left, above the glass). Keep text clear of the glass and its labels (they sit to
  its right). The glass's labels already show every measure: no `counter`s for the measures, and
  no poster line that repeats a measure; use poster lines for the drink's name and the method.""",
    "versus": """### Kind: versus, a comic fight
- ONE `fightHud` from ~0.3 s to the end: `a`/`b` (names, colours) and `winner` from the data. Its `hits`
  are the data's moves in order, each `at` on the narration word where that move lands (minus the HUD's
  t0), `dmg` and `word` from the data; `koAt` on the KO line. The loser's total damage reaches 100.
- A `chapterCard` for each round title, briefly, when the narrator announces it (keep it under the HUD,
  y ≥ 380).
- Each special move's name as poster type (2–4 words, 140–220 px) in the middle of the frame
  (y 700–1150) as it lands; never over the HUD (y 150–400). Captions stay on (the narration).""",
    "machine": """### Kind: music machine
- 0 s → the drop (the second line's first word, ~12 s): NO SOUND. The user's line types itself out as
  poster type (posterText, `anim` "rise", 150–220 px, y 300–520, no `accent`) and holds ~3 s.
- A `noteMachine` from just after the line (t0 ≈ 3.5 s) to ~1 s before the closing words: its pieces
  assemble until the ball waits at the top; `dropAt` = the drop time minus its t0. Then a catchy
  4-second phrase: `notes` from the data's degrees, at offsets on a 0.25 s grid between dropAt and
  dropAt + 4 (a rhythm, not even spacing); `drums` on every beat (0.5 s) from dropAt.
- The closing words as poster type (220–320 px, `anim` "pop", `accent` "sub"), centred, at the third
  line, held to the end. After that: silence. Nothing else; no chips, no cards, no counters.""",
    "journey": """### Kind: storybook journey
- ONE `seasonWindow` for the whole film (t0 ~0.3 s → the end): `seasons`, `shape` (= the data's frame) and
  `cup` from the data; centred (x 140, w 800, y 420–520, h 900–1000).
- A `chapterCard` at each season change with the data's chapter titles (they sit above the window).
- The deadpan lines as small, centred, symmetrical poster type in the accent face (serif, 54–76 px)
  at the top (y 160–330), one at a time. Symmetry everywhere: centred, nothing tilted.""",
}


def film_brief(options: dict[str, Any]) -> str | None:
    """The brief film's direction for the planner (None for an ordinary edit)."""
    film = options.get("film")
    brief = options.get("brief") or {}
    kind = str(brief.get("kind") or "")
    if not isinstance(film, dict) or kind not in FILM_KINDS:
        return None
    spoken = " (spoken by the narrator)" if film.get("narration") else " (nobody speaks; the lines appear on screen)"
    data = json.dumps(film.get("data") or {}, ensure_ascii=False)
    return FILM_COMMON.format(kind=kind, spoken=spoken, data=data) + "\n" + FILM_KINDS[kind]

BROLL_BRIEF = """## Stock B-roll (this edit asked for it)

The user wants stock footage cut into the reel. Add `broll` elements: a cutaway to a portrait stock
clip found from your `query`. Write queries as a stock librarian would — concrete, visual, English,
3–8 words naming the subject and the shot ("hands polishing a gold ring macro", "crowded Delhi market
at dusk", "woman scrolling phone in bed") — never abstract nouns ("success", "taste").
Rules: 1.2–4 s each; never in the first 1.5 s; at least 1.5 s of the speaker between two cutaways;
at most one per 10 s; the clip must illustrate the exact words being spoken, landing on the noun.
A B-roll replaces the picture (in `card` / `pip` modes it fills the card), so keep that window free
of `imageCard`s and put any `posterText` above the picture where it stays readable; captions keep
running. Give it a short `label` only when a source tag suits the style ("stock", "archive").
Never cut away on the emotional line, the punchline or the CTA."""

MIXED_CASE_FAMILIES = {"kinetic", "whiteboard", "chalk", "launch", "blocks"}


def hex_luma(hex_colour: str) -> float:
    """Relative luma 0..1 of #rrggbb (same weights as the engine's hexLuma)."""
    try:
        n = int(hex_colour.lstrip("#"), 16)
    except ValueError:
        return 0.0
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255


def sentence_case(text: str) -> str:
    """'YOUR TASTE WAS TAUGHT' → 'Your taste was taught'. Only shouted multi-word Latin lines
    change; acronyms, single words, numbers and Devanagari are left alone."""
    letters = [c for c in text if c.isalpha()]
    if len(text.split()) < 2 or not letters or not all(c.isupper() for c in letters):
        return text
    if not all(ord(c) < 0x250 for c in letters):  # not Latin script
        return text
    low = text.lower()
    return low[0].upper() + low[1:]


REFERENCE_FRAMES_BRIEF = """## The reference reel the user wants copied ({n} frames)

The user uploaded this reel as THE look of their edit and picked no other style. The finished reel
must look like these frames: someone who saw both should say "same editor". Copy, measuring
against the 1080 px frame width:
- **Poster type scale and weight.** If the reference sets one or two words huge (a third of the
  width or more), set them huge too: `size` 160–320 on the key word. Do not shrink the reference's
  type into small top-of-frame lines.
- **The mix of faces** (e.g. condensed caps for the key word with serif-italic asides beside it;
  the style tokens name the fonts) and **the colours** each one takes.
- **Placement**: where the type sits relative to the person (over the wall beside the head, across
  the frame, low), its alignment, and how many lines.
- **Graphic furniture** you can build from the elements: stickers (`chips`), small cards, counters,
  progress bars, cut-out photo cards when the user has photos.
- **Caption treatment**: size, case, colour and position as in the frames.
- **Framing**: if the speaker fills the frame edge to edge in the reference, stay in `full` /
  `zoom`; if the reference frames them in windows, use `card` / `pip`.
Never copy the reference's words, logos, people or footage: the speaker and the transcript are the
user's own."""


def keep_full_bleed(modes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """A full-bleed style (e.g. matched from a reference shot edge to edge): the speaker never sits
    in a `card` or `pip` window. Punch-ins (`zoom`) stay; the closing `arch` switch stays, because
    the end card hangs from it; every other framed switch becomes `full`. Repeats are merged."""
    out: list[dict[str, Any]] = []
    last_arch = max((i for i, m in enumerate(modes) if m.get("mode") == "arch"), default=-1)
    for i, m in enumerate(modes):
        mode = m.get("mode")
        if mode in ("card", "pip") or (mode == "arch" and i != last_arch):
            m = {**m, "mode": "full"}
        if out and out[-1].get("mode") == m.get("mode") == "full":
            continue
        out.append(m)
    return out or [{"t": 0, "mode": "full"}]


def motion_brief(style: dict[str, Any], motion: dict[str, Any]) -> str:
    """The style's choreography, as a section of the user message."""
    family = motion.get("family") or "editorial"
    direction = (motion.get("direction") or "").strip() or (
        "House editorial choreography: follow the beat structure in the system prompt."
    )
    prefer = ", ".join(style.get("preferredElements") or []) or "any"
    never = ", ".join(motion.get("avoidElements") or []) or "none"
    stage = str((style.get("palette") or {}).get("stage") or "#000000")
    stage_note = (
        "The stage behind the framed modes is DARK: `iv` / `gold` there."
        if hex_luma(stage) < 0.5
        else "The stage behind the framed modes is LIGHT: use `mar` / `ter` / `goldd` in every mode, "
        "never `iv` / `gold`."
    )
    return (
        f"## Motion direction for this style (family: {family})\n\n"
        + direction
        + "\n\n"
        + stage_note
        + f"\n\n**Prefer:** {prefer}\n**Never use:** {never}\n\n"
        + f"Entrance: {motion.get('enter', 'rise')} · exit: {motion.get('exit', 'lift')} · "
        + f"easing: {motion.get('easing', 'spring')} · camera: {motion.get('camera', 'glide')} · "
        + f"sound kit: {motion.get('sfxKit', 'pop')} · texture: {motion.get('texture', 'none')}."
        + (
            "\n\nFraming: FULL BLEED. The speaker fills the frame the whole reel; use `full` and "
            "`zoom` only (no `card` / `pip`), and put every element on top of the footage."
            if motion.get("framing") == "full"
            else (
                "\n\nFraming: mostly FRAMED. Keep the speaker in `card` / `pip` windows on the stage for "
                "most of the reel, with short `full` beats."
                if motion.get("framing") == "framed"
                else ""
            )
        )
        + (
            "\n\nThe engine types poster lines letter by letter (`type`): keep them short, 1–4 words."
            if motion.get("enter") == "type"
            else ""
        )
        + (
            "\n\nEvery move lands in held poses (stop-motion `steps` easing): fewer, bigger moves; "
            "hold ≥ 0.8 s after each landing."
            if motion.get("easing") == "steps"
            else ""
        )
        + (
            "\n\nPaper look: the footage carries the paper material and torn strata in every mode, and "
            "the `card` / `arch` modes show the paper stage — spend at least half the reel framed."
            if family == "collage"
            else ""
        )
        + (
            "\n\nThis style sets poster type in SENTENCE CASE: write lines as sentences, not shouts."
            if motion.get("caseStyle") == "sentence"
            else (
                "\n\nThis style shouts: poster lines are UPPERCASE, 1–4 words."
                if motion.get("caseStyle") == "upper"
                else ""
            )
        )
    )


# ── validation inside Chromium (same validator + font metrics the engine uses) ──


class ChromiumValidator:
    """Runs @rasika/schema's validatePlan from the engine bundle in a headless page."""

    def __init__(self, settings: Settings) -> None:
        self.bundle = settings.engine_bundle
        self.fonts = settings.fonts_dir
        if not self.bundle.exists():
            raise RuntimeError(f"engine bundle missing: {self.bundle}")
        self._pw: Any = None
        self._browser: Any = None
        self._page: Any = None

    def _ensure(self) -> Any:
        if self._page is None:
            from playwright.sync_api import sync_playwright

            self._pw = sync_playwright().start()
            self._browser = self._pw.chromium.launch(args=["--allow-file-access-from-files"])
            self._page = self._browser.new_page()
            fonts = self.fonts
            css = ""
            if fonts.exists():
                u = fonts.resolve().as_uri()
                css = (
                    f'@font-face{{font-family:"Anton";src:url("{u}/Anton.ttf")}}'
                    f'@font-face{{font-family:"Inter";src:url("{u}/Inter.ttf");font-weight:100 900}}'
                    f'@font-face{{font-family:"Serif";src:url("{u}/InstrumentSerif-Italic.ttf");font-style:italic}}'
                    f'@font-face{{font-family:"Tiro";src:url("{u}/TiroDevanagariHindi.ttf")}}'
                )
            html = f"<!doctype html><html><head><style>{css}</style></head><body></body></html>"
            # a page opened from disk may load the font files beside it; an in-memory page may not
            # (fonts would silently fall back and every width would be measured in the wrong face)
            import tempfile

            page_file = Path(tempfile.mkdtemp(prefix="rasika-validate-")) / "validate.html"
            page_file.write_text(html, encoding="utf-8")
            self._page.goto(page_file.as_uri())
            self._page.add_script_tag(path=str(self.bundle))
            self._page.evaluate(
                "async () => { for (const f of ['400 100px Anton','800 50px Inter','italic 100px Serif','100px Tiro']) { try { await document.fonts.load(f) } catch (e) {} } }"
            )
        return self._page

    def __call__(
        self, plan: dict[str, Any], words: list[dict[str, Any]], image_ids: list[str]
    ) -> dict[str, Any]:
        page = self._ensure()
        base = self.fonts.resolve().as_uri() if self.fonts.exists() else ""
        result = page.evaluate(
            """async ([plan, words, imageIds, base]) => {
              const E = window.RasikaEngine;
              // measure with the style's own faces (a wide grotesk overflows where Anton fits)
              const f = (plan && plan.style && plan.style.fonts) || {};
              let fonts;
              if (base && E.fontsForStyle && f.poster) {
                const fams = E.fontsForStyle(f);
                window.__loadedFonts = window.__loadedFonts || new Set();
                const fresh = fams.filter((x) => !window.__loadedFonts.has(x));
                if (fresh.length) {
                  const st = document.createElement("style");
                  st.textContent = E.fontFaceCss(base, fresh);
                  document.head.appendChild(st);
                  for (const fam of fresh) {
                    try { await document.fonts.load(E.fontLoadDescriptor(fam)); } catch (e) {}
                    window.__loadedFonts.add(fam);
                  }
                }
                fonts = {
                  poster: E.fontFamily(f.poster), accent: E.fontFamily(f.accent || "Instrument Serif"),
                  ui: E.fontFamily(f.ui || "Inter"), devanagari: E.fontFamily(f.devanagari || "Tiro Devanagari Hindi"),
                };
              }
              const r = E.validatePlan(plan, words, { imageIds, measureText: E.measureTextCanvas(fonts) });
              return { ok: r.ok, plan: r.plan, issues: r.issues };
            }""",
            [plan, words, image_ids, base],
        )
        return dict(result)

    def close(self) -> None:
        try:
            if self._browser:
                self._browser.close()
            if self._pw:
                self._pw.stop()
        finally:
            self._page = self._browser = self._pw = None


def swap_wall_tokens(plan: dict[str, Any]) -> int:
    """On a dark wall the light-wall tokens are unreadable in every mode: mar→iv, ter→gold,
    goldd→gold on poster lines, counters, equations and strike lines."""
    swap = {"mar": "iv", "ter": "gold", "goldd": "gold"}
    n = 0
    for el in plan.get("elements", []):
        for line in el.get("lines", []) or []:
            if line.get("color") in swap:
                line["color"] = swap[line["color"]]
                n += 1
        for key in ("color", "leftColor", "rightColor"):
            if el.get(key) in swap:
                el[key] = swap[el[key]]
                n += 1
    return n
