# mikku style guide

## 1. Beat structure (scale to the video length)

| Share | Beat | What happens |
|---|---|---|
| 0–3 % | Hook | Her question as 3-line poster type above the head (small Anton / huge Anton in terracotta / italic serif tail). Two user photos pop in as tilted polaroids at the lower corners on the first noun. |
| 3–7 % | Credibility / number | Any number she says becomes a rolling counter (`fn` sets textContent). |
| 7–10 % | Tease | If she promises to reveal something later → dashed "locked" card with the word blurred: THE WORD / ████ / REVEALED AT THE END. |
| 10–20 % | Problem | Punch-in (`zoom` mode) on her signature prop with a gold ring drawing on, label "THE SAME X". Then a phone mockup scrolling the prop crop repeatedly with a DAY 1→30 counter and a stamped verdict ("YOU NEED IT"). |
| 20–33 % | Concept | Video shrinks to `card` mode on the maroon stage; concept name huge in ivory/gold above. Second idea as an equation ("SEEN MORE = liked more"). |
| 33–75 % | Chapters 01/02/03 | Each "first/second/third" → `card` mode chapter card (big gold number). Then content: `full` mode + polaroid cards, OR `pip` mode + full-bleed photo plates with labels, one per named place/thing. |
| 75–88 % | Payoff | Back to `card` mode: locked card returns, unblurs piece by piece, final word huge in gold + Devanagari below, riser → impact → gold particle burst. |
| 88–97 % | Brand | Brand name in big italic serif above her head; "NOT FROM THE FEED" style line with an animated strike; `pip` plates of the brand's world. |
| last 2.5 s | End card | `arch` mode: video inside a palace-arch mask on maroon, a faint blurred photo behind, brand in spaced caps + the closing line in italic serif. |

Not every video has every beat — keep the rhythm (something new every 2–4 s, a layout change every ≤6 s).

## 2. Layout zones (1080×1920)

- Poster type: y 150–650 (the wall above her head). Max ~3 lines; total height must end above y≈680 in
  card mode (card top edge = 960 + 275 − 0.56·960 ≈ 697).
- Polaroids: 420–470 px wide, top-right (x≈570–590) or top-left (x≈40–70), y 170–760, tilt ±4–9°.
- Captions: fixed y 1400 (over the hand/mic area). One word at a time.
- Labels on photo plates: top, over a dark gradient `.shade`.

## 3. Video modes (`M` / `SEG` in template)

`full` (default, gentle breathing) · `zoom` (punch-in: x=(540−px)·s, y=(960−py)·s, s≈2.1) · `card`
(s .56, gold border, maroon stage) · `pip` (s .34 bottom-right over `bleed` plates) · `arch` (end card).
Transitions are 0.5 s outExpo (0.6 s inOutCubic into/out of zoom). Put mode switches ~0.05–0.1 s before
the word that triggers them.

## 4. Palette & type

Derived from Rajasthan / the brand photos: stage maroon `#3a0a11` with a gold dot jaali pattern,
maroon `#5a0f1a`, terracotta `#c8452f`, gold `#e6b450` (dark bg) / `#9a6a14` (light bg), ivory `#f6ecd8`.
On a light wall use maroon/terracotta/dark-gold; on stage or photos use ivory/gold. Swap the palette for a
different brand but keep 1 dark stage + 2 accents + 1 neutral.
Fonts: Anton (poster), Instrument Serif Italic (emotion words), Inter 800 spaced caps (kickers),
Tiro Devanagari (display Hindi), Mukta ExtraBold (Hindi captions).

## 5. Captions

Inter 800 74 px cream with 14 px dark stroke; pop (scale .72→1, outBack .19 s). Hold until next word or
0.85 s max. Emphasis: `GOLDW` → gold serif italic 108 px (feelings, the theme word, the payoff word);
`REDW` → terracotta Anton 96 px (nouns she names, places, brand, numbers, ordinals). Strip . , ? !

## 6. SFX map (`cues.json`, mixed at 0.45 under voice, no beat bed)

whoosh .45 s (gain .8) on every mode switch and every bleed plate · pop on every card/chip/counter-card ·
tick ×8 every .12 under counters · glitch .3 s on a "but actually" line · impact on stamps · riser 1.35 s →
impact + sub on the payoff word · sub on brand reveal and end card.

## 7. Bugs already fixed — keep them fixed

- Hide out-of-range items with `display:none` (visibility on a parent doesn't hide children that set
  `visibility:visible` via `set()`).
- `#bleed` needs `z-index:0; isolation:isolate`, `#vw` z 1, `#fx` z 2 — otherwise plate z-indexes cover the pip video.
- Every font used must be in `window.__ready` (`document.fonts.load`) or text renders blank in stills.
- Feed/scrolling content: drive with `fn` and absolute time, never CSS animation.
- Images from phone screenshots: crop UI before use (prep_images `--crops`).

## 8. QA checklist before the full render

Stills at every scene entry + mid-scene: no text over the face, no leftover elements, poster text clear of
the card top in card mode, labels readable on photos, captions not hidden by graphics, end card complete,
first frame already has something on screen.
