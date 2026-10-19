# Rasika redesign — working notes (taste-skill v2 run)

## 1. Inventory (what only Rasika has)
1. The name: Rasika, Sanskrit for the one who tastes, the connoisseur; "ras" = taste/essence.
2. The output: a 1080×1920 reel whose every caption lands on the spoken word, with poster type
   above the head, counters, tilted photo cards, pip plates, stamps, stock B-roll, sound cues.
3. The same real 12-second phone take rendered 93 times — 93 real demo videos in /demo/styles.
4. A real 90-second before/after of a jewellery founder (/demo/before.mp4, /demo/after.mp4).
5. The engine is a DOM engine: a plan JSON → HTML/CSS → frames; the website can run the same tokens.
6. Nine motion families and seven synthesised sound kits; 67 looks measured from open repos.
7. Three ways in: a take, a script narrated by a voice, a reference reel matched; plus HeyGen presenters.
8. English, Hindi, Hinglish; Devanagari on screen, never romanised.
9. Prices in rupees: free, ₹999, ₹2,999; credits ₹80–120 a reel; 1 credit = 90 s.
10. The constraint: no timeline, ever. You click the word, not the frame.
11. Minutes: a 42-second take becomes a reel in about two and a half minutes.
12. Made in India, for realtors, doctors, coaches, founders, chefs, lawyers.

## 2. The argument (claims → proof)
1. Talk to your phone; Rasika sets your words like a studio would.        → the sentence set live, in Rasika's own type (hero)
2. Type any line; it is set the way the reel sets it, in 93 styles.         → the typed-headline fragment + style buttons (showcase)
3. You give a take (or a script, or a reference); you get words timed,       → call and response: transcript rows, the plan's poster
   a plan, a finished reel.                                                     line + counter, the finished reel (how it works)
4. Every move a motion designer makes by hand happens on the word.           → the real reel, drag-to-compare, six margin notes (features)
5. Ninety-three styles, one take: all real renders.                           → the board of 93 demo tiles (proof)
6. Free for one reel; ₹999 for ten.                                            → the plans table (pricing)
7. The questions people ask, answered plainly.                                → FAQ tiles
8. Start here: drop the take.                                                  → the wizard's real first step, open (cta)
9. Rasika · links · year.                                                      → one quiet line (footer)
(Industries section dropped: its claim is carried by the features notes and the FAQ's first answer;
its three poster lines per industry were a repeated module.)

## 3. Direction and idea
Dealt: **The product performs** (seed 1170911086). Chosen over colour-chapters and dense-tiles
because Rasika's engine is HTML: the page can set type with the same tokens the reel uses, so the
fragments are the product, not pictures of it.

> On this page, **the way Rasika sets a spoken line (poster type above the head, the lit word in the
> caption)** becomes **the page's own headline and controls: the sentence is set live by the style
> you pick.**

Competitor test: CapCut / Opus Clip could not sign it; their type is a template, Rasika's is a plan.

**The live thing:** the showcase input — type your line, see it set in the chosen style's real
tokens (font, palette, caption pill), switch styles; on a phone, tap an example chip.

## 4. Palette and type (decisions against the sheet)
- Dealt "Sheet and biro" (white / black / blue) as proportions. The subject has unmistakable colours
  (the maroon stage, gold foil, ivory), so per colour.md the colours come from the subject at the
  dealt proportions: ground bone `#f4f0e8` (low chroma, not cream), ink oxblood `#2b0a10`, muted
  `#6b5a5d`, accent deep gold `#9a6a14` (links, the one button), field-1 oxblood `#3a0a11` with
  ivory ink `#f6ecd8` (inverted sections: hero, cta). Terracotta leaves the page UI (it stays a
  caption colour inside reels). Noted as a palette taken from the subject, not a redraw.
- Dealt type Switzer (Fontshare) for the whole page; Anton stays only inside reel fragments
  (data-ui), where it is the product's own face. Instrument Serif leaves the page.
- Radius: square (direction default); buttons rectangular, one shape.

## 5. Section mapping
- hero "Controls on the sentence": dark field, two-line headline "Talk to your phone. / Post like a
  studio." set with the reel's poster type? No — house rule: one face; the headline is Switzer; the
  three live chips are product controls: Style (cycles real presets: the headline takes its poster
  font + colours inside a data-ui stage), Captions (lights the words one by one), Hindi (switches the
  sentence to Devanagari). Supporting sentence + one button.
- showcase "Headline you can type": input line; answer = the line set in the chosen style at true reel
  scale (caption pill + poster line), three example lines as buttons.
- how-it-works "Call and response": take → timed words; words → plan fragments; plan → the reel
  (breaks out at 760px, real demo video).
- features "Panel with margin notes": the compare slider phone at true size (raw ↔ Rasika) with six
  notes level with captions, poster line, counter, card, pip, sound.
- proof "Large marks on tiles": tiles are the 93 real demo posters (hover plays), first tile accent
  with "93 styles, one take"; filter chips + search above.
- pricing "Plans as a large table": Free / Creator / Pro / Agency.
- faq "Accordion of filled tiles": the seven questions.
- cta "First step, already open": the real drop zone + source choice, on the oxblood field.
- footer "A single quiet line".
No redraws needed. Industries removed by the argument.
