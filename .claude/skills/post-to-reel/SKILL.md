---
name: post-to-reel
description: Turn a pasted post that lists things with links (a "GitHub daily top 5", "3 AI tools to try", a product roundup) into a finished vertical reel with Rasika — research every link, write the narration, put each item's real page, demo clip and numbers on screen on the right words, render a 1080×1920 MP4. Use when the user pastes such a post and asks for a reel, a video, a narrated roundup or an AI-presenter version of it.
---

# Post → Reel (Rasika roundup films)

The skill drives Rasika's own "From a post" film type (`apps/worker/rasika_worker/roundup.py`), so
what you make here is exactly what customers get in the product. Improve the product code, not a
side copy, when a run shows a problem.

## 1. Settle the brief (don't interrogate)

- **The post**: save it verbatim to a file in the scratchpad (`post.txt`). It needs at least one
  link per item; if it has none, ask for the links.
- **Mode**: `voice` (narration over the visuals) is the default. `presenter` (an AI avatar speaking,
  visuals behind) costs money per video through HeyGen: ask before using it, and say it is not wired
  into roundups yet if `roundup_reel.py` refuses it.
- **CTA** (optional): the user's own closing call to action, else the writer's default.
- **Language**: English narration (the narration voices are English-only).

## 2. Make sure the local stack is up

The driver writes to the LOCAL database only (`.env` must point at localhost — check the hosts, never
print secrets). Then:

```bash
docker compose up -d redis postgres rustfs s3-init
docker compose build worker && docker compose up -d worker   # after any worker code change
```

Never run this against the production stack (`rasika-cloud`).

## 3. Run it

```bash
apps/worker/.venv/Scripts/python.exe tools/e2e/roundup_reel.py <post.txt> [--cta "..."] [--voice aura-2-thalia-en] [--preset dark-ios]
```

It prints each stage (reading the post, researching each link, writing, narration, transcription,
plan, render) and saves `reel_1080.mp4`, `reel_720.mp4`, `script.json` and `research.json` under
`.work-e2e/roundup/<project id>/`. A full run is ~6–8 minutes for five items.

To redo only the edit after a layout change (no new research or narration), re-queue a `plan` job
for the same project (see the `/tmp/replan.py` pattern in this repo's history: insert a jobs row of
type `plan` and push the message to `rasika:jobs`).

## 4. Look at the result before reporting (mandatory)

1. Contact sheet: `ffmpeg -i reel_1080.mp4 -vf "fps=1/3,scale=270:-2,tile=6x4" -frames:v 1 contact.jpg`,
   then open it and look. Grab full frames at the hook, at each item's counter and at the end card.
2. Check against this list:
   - The first 3 s show the hook line big and every item's page flashing under it.
   - Each item: `#n` + name + takeaway on top, its visuals in the window under it (no blank white
     area), the number counting up under the window on the spoken number, captions at the bottom.
   - Demo clips play whole across the frame over a blur (never stretched or cropped to a sliver).
   - The end card shows the closing line and the recap of every name.
   - Every fact on screen is in `research.json` (page facts) or the post; nothing invented.
3. Read `script.json`: the hook must name the count and the most surprising item; each item must
   say what it is in plain words; numbers rounded as spoken.
4. Fix the weakest thing in `roundup.py` (writer prompt or `build_plan`), add or adjust a test in
   `apps/worker/tests/test_roundup.py`, rebuild the worker, re-plan, look again.

## 5. Deliver

Give the user the path to `reel_1080.mp4`, a few frames, the script, and what was found or could
not be found for each link (`research.json` → `problems`). Credit: every item's page or repo link
is shown on screen in the browser bar or the clip's label.

## Rules

- Facts come from the post and the pages, never from memory. Star counts are GitHub's at the time of
  the visit; what only the post claims is said as the post's claim.
- Use only media found on the item's own page or README. Never download from YouTube or other
  platforms whose terms forbid it.
- Don't paste the user's post or research into any third-party service other than the ones the
  product already uses (Anthropic, Deepgram, and HeyGen in presenter mode with the user's go-ahead).
