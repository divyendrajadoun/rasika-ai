---
name: mikku
description: Turns a raw talking-head video into a fully motion-designed Instagram reel in the "Mikku" style — the Baisa Bling "Rasika" edit — rendered from code to a real MP4 with voice + sound effects. Transcribes the speech, times every word, then builds kinetic poster typography on the wall above the speaker, Katana-style one-word captions, image cards and full-bleed photo plates landing on the exact spoken words, a punch-in on a prop the speaker wears, framed-card / picture-in-picture / palace-arch video modes on a maroon stage, chapter cards, a teased-then-revealed payoff word, and an end card. Use this skill whenever the user uploads a vertical talking video (MP4/MOV) and asks to edit it, add motion graphics, make it a reel, "edit like the Baisa Bling / Rasika video", "do the mikku edit", "motion design this", "add text, images and sound effects to my video", or uploads a talking video plus reference images to place in it — even if they never say "mikku".
---

# mikku — motion-designed talking-head reels

The finished look (see `references/example_baisa_bling.html`, a 90 s jewellery-brand reel the user loved):
a single selfie take becomes an editorial reel — poster type on the wall above her head, captions one word
at a time, the user's photos flying in as polaroids exactly when she names them, the whole video shrinking
into a gold-framed card on a deep maroon stage for "concept" moments, picture-in-picture over full-bleed
photos for "look at this" moments, and a mystery word teased at 5 s and revealed with an impact near the end.

Read `references/style-guide.md` before planning — it holds the beat structure, layout zones, palette,
caption rules, SFX map and the bugs already fixed once. Read the example HTML when you need working code
for a specific effect (choker punch-in ring, scrolling phone feed, counter, film strip, jaali SVG, burst).

## Environment facts (claude.ai sandbox)

- Network allows GitHub/PyPI/npm only. **Image sites (Wikimedia, museums, Unsplash) and HuggingFace are
  blocked.** So: speech models come from sherpa-onnx GitHub releases (scripts handle it) and every photo
  must come from the user. Don't promise web images; if a beat has no photo, draw it (SVG pattern, typography)
  and tell the user which beats would improve with a real photo.
- 1 CPU, ~3 GB RAM, 300 s per command. Anything long (model download, frame extraction, transcription,
  the full render) runs **detached**: `setsid nohup <cmd> > log 2>&1 < /dev/null &`, then poll with `sleep`.
- Never `pkill -f name` with a name that also appears in your own command line — it kills your shell.
- Chromium for rendering is at /opt/pw-browsers (render.py finds it).

## Workflow

Paths below: `K=<this skill dir>`, project dir `P=/home/claude/proj`, models `A=/home/claude/asr`.

1. **Kick off slow work in parallel** (one bash call):
   - `setsid nohup bash $K/scripts/setup_asr.sh $A > /home/claude/asr.log 2>&1 < /dev/null &`
   - `setsid nohup bash $K/scripts/prep_video.sh <upload.mp4> $P > /home/claude/prep.log 2>&1 < /dev/null &`
   - `python3 $K/scripts/prep_images.py $P <img1> <img2> …` — first look at each image and pass `--crops`
     to cut phone-screenshot UI (back arrows, "…" buttons, Lens icons, letterbox bars, text under paintings).
2. **Find the language.** When ASR_READY: `python3 $K/scripts/transcribe.py $A $P/audio16k.wav en x --probe`.
   Pick the language whose line reads as real sentences (Whisper int8 in "hi" mode can output garbage on
   English/Hinglish speech — trust the probe, not the user's accent).
3. **Transcribe** detached: `transcribe.py $A $P/audio16k.wav <lang> $P/segments.json` (~2–4 min/min of audio).
4. **Correct the transcript** into `$P/script.txt` by context: brand names (e.g. "Buy Subling" → Baisa Bling),
   Indian words (jaali, polki, jhumka, payal, nani, rasa/rasika), homophones ("feet" → feed). Keep her words;
   don't rewrite her speech. Hindi speech → script in Devanagari.
5. **Word timing**: `python3 $K/scripts/align.py $A $P/audio16k.wav $P/segments.json $P/script.txt $P`
   (English). Non-English: add `--proportional`. Writes `words.json` + `words.js`. Every visual cue is
   placed from these times.
6. **Study the footage**: view 2–3 full frames. Note (a) the free wall area above the head = poster zone,
   (b) face position, (c) a **signature prop** she wears/holds that matches the script (choker, ring, saree,
   book, cup) and its pixel position — it becomes the punch-in moment.
7. **Plan the beat map** (follow the style-guide structure) as a table: time · words · visual · video mode ·
   SFX. Map each user image to the exact word that names it. If the user named a brand/handle, it goes in the
   end card.
8. **Build** `$P/comp.html` from `$K/assets/template.html` (it reads `video.js`, `words.js`, `frames/`,
   `img/`, `fonts/`). Fill the SCENES block, the `SEG` video-mode timeline, palette `C` if the brand calls for
   it, and the caption emphasis sets `GOLDW` / `REDW`.
9. **Review stills**: `python3 $K/scripts/render.py $P/comp.html --stills t1,t2,… --outdir $P/shots`
   (~24 times per call: every scene entry + mid-points), then `python3 $K/scripts/sheet.py $P/shots out.jpg`
   and view it. Fix overlaps, leftovers, unreadable colours. Repeat for the second half.
10. **Full render** detached: `render.py $P/comp.html -o $P/video_noaudio.mp4 --crf 20 --preset veryfast`
    (~9 s of compute per second of video). Poll the log every ~280 s.
11. **Sound**: write `$P/cues.json` (style-guide SFX map, `"bpm":0,"bed_gain":0`), then
    `bash $K/scripts/finish.sh $P /mnt/user-data/outputs/<name>.mp4`. Zip `comp.html words.js video.js fonts img cues.json`
    as the editable source (never zip `frames/`). Present both files.
12. **Report honestly**: what each section does in a few lines, then what to check — beats that use a drawn
    graphic instead of a real photo, images that only approximate what she says, caption stretches that
    were interpolated, no music bed (suggest adding licensed music in Instagram), file size.

## Non-negotiables

- On-screen text must be a complete, meaningful phrase — never a fragment that only makes sense with audio.
- Every image or graphic enters on the word that names it, not "around" it.
- Real imagery beats stand-ins: use the user's photos for what they show; don't label an image as something
  it isn't (pearls ≠ jhumkas → label the styling idea, e.g. "+ A PLAIN SHIRT").
- Vary the edit: no section longer than ~6 s in one layout. Rotate full → card → pip → punch-in.
- Hindi words on screen in Devanagari (Tiro for display, Mukta for captions).
- Don't identify real people in user photos; just use them as given.
