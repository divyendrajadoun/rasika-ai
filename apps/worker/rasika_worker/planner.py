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
    mt = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
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
                    "every sentence; never leave the plate empty for more than 1.5 s. Use `card` / "
                    "`pip` / `arch` modes only when an imageCard or chapterCard fills them; otherwise "
                    f"stay in `full`. Text colours: {tokens} throughout.",
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
        if motion.get("family") in MIXED_CASE_FAMILIES and isinstance(plan.get("elements"), list):
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
        plan.setdefault("videoModes", [{"t": 0, "mode": "full"}])
        plan.setdefault("elements", [])
        seen: set[str] = set()
        for i, el in enumerate(plan["elements"]):
            eid = str(el.get("id") or f"e{i}")
            while eid in seen:
                eid += "x"
            el["id"] = eid
            seen.add(eid)
        return plan


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
        + f"\n\n**Prefer:** {prefer}\n**Never use:** {never}\n\\n"
        + f"Entrance: {motion.get('enter', 'rise')} · exit: {motion.get('exit', 'lift')} · "
        + f"camera: {motion.get('camera', 'glide')} · sound kit: {motion.get('sfxKit', 'pop')}."
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
            self._page.set_content(html)
            self._page.add_script_tag(path=str(self.bundle))
            self._page.evaluate(
                "async () => { for (const f of ['400 100px Anton','800 50px Inter','italic 100px Serif','100px Tiro']) { try { await document.fonts.load(f) } catch (e) {} } }"
            )
        return self._page

    def __call__(
        self, plan: dict[str, Any], words: list[dict[str, Any]], image_ids: list[str]
    ) -> dict[str, Any]:
        page = self._ensure()
        result = page.evaluate(
            """([plan, words, imageIds]) => {
              const E = window.RasikaEngine;
              const r = E.validatePlan(plan, words, { imageIds, measureText: E.measureTextCanvas() });
              return { ok: r.ok, plan: r.plan, issues: r.issues };
            }""",
            [plan, words, image_ids],
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
