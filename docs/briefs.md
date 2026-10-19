# Films from a brief

Rasika makes some films with no footage at all: the user gives a brief, and the worker writes,
scores and designs the whole film. In the wizard: **Source → From a brief → pick the kind**.

| Kind | You give | You get | Look (preset) | Voice |
| --- | --- | --- | --- | --- |
| SaaS launch film | website link (+ focus, length 20/30/40 s) | high-end through-line launch film | `saas-launch` in the site's colours | music only |
| 15-second showreel | website link (+ focus) | through-line showreel matching the landing page | `showreel-kinetic` in the site's colours | music only |
| Apple-style app film | website link (+ focus, length) | keynote-style through-line film: white space, the device as the hero | `porcelain-keynote` in the site's colours | music only |
| Product film | website link (+ focus, length 30/40/60 s) | 40 s through-line film: what it does, who it is for | `porcelain-keynote` in the site's colours | music only |
| Referral promo | referral page link (+ the programme in a line) | 15 s: how referring works, what you get, how to start | `porcelain-keynote` in the site's colours | music only |
| Hype launch | website link (+ focus, length 15/20/30 s) | 20 s punchy through-line launch | `porcelain-keynote` in the site's colours | music only |
| Landing-page fly-over | landing page link + a two-part closing line (brand name from the Brand step) | 14.5 s 3D fly-over: glide, rise, dive into the hero card, word-by-word title | `porcelain-keynote` | music only |
| Diagram explainer | what to explain (+ its link) | 60 s: one diagram, the camera zooms into each part with an example and pulls back | `porcelain-keynote` | music only |
| Recipe explainer | the recipe with measures | 30 s: a glass fills ingredient by ingredient with each measure on screen, then the garnish | `recipe-explainer` | music only |
| Versus: a comic fight | two contenders, optionally the winner | 1 min arcade fight: health bars, rounds, special moves, a K.O., the winner's banner | `versus-arcade` | announcer |
| Music machine | the line that types out, the closing words | 20 s: silence while the line becomes a machine, then every block the ball hits plays a note, then the closing words on a final hit | `music-machine` | the notes |
| Storybook journey | what the story is about | 30 s Grand Budapest-style vignette: a window onto the passing seasons, chapter cards, a waltz | `grand-budapest` | music only |
| Animated explainer | a topic or question | 40–60 s Kurzgesagt-style film: one illustrated world in parallax, a flying bee host, numbers as crowds of little figures | `kurz-explainer` | narrator |
| Editorial explainer | a topic or story | 40–60 s Vox-style film: newspaper clippings and documents, the key phrase struck in red marker, numbers on the word | `vox-paper` | narrator |
| Tier list | what to rank (optionally the picks) | 25–40 s ranking: an S–D board, each pick flying into its tier on the word, a reason and a punchline each | `tier-list` | narrator |

## How it is made (apps/worker)

1. **compose** (`pipeline.compose`, `brief.py`)
   - websites: `capture_site` opens the page in headless Chromium and takes real screenshots (first
     screen, full page, two sections, phone) plus the page's own words. Every request, the page's
     sub-requests included, is checked against private, loopback and internal addresses
     (`check_url`): the worker can never be pointed at storage, Redis or the database.
   - `write`: one Claude call turns the brief (and the screenshots) into the film's on-screen lines,
     an optional narration and the kind's structured data (the recipe's layers and colours, the
     fight's moves and damage, the machine's notes). It may only use claims the site itself states.
   - with a narrator: Deepgram speaks the narration; a synthesised bed (`music.py`) is mixed under
     it, ducked. Without one: the lines become the timeline and the bed is the soundtrack.
2. **probe → transcribe → plan → render**, as for any reel. A film with no narrator skips speech
   recognition (its words are the lines). The planner gets the kind's own direction
   (`planner.FILM_KINDS`) and builds the film from five elements made for it.

### Through-line films (launch, showreel, app, product, referral, hype)

`capture_site` also records the page's real controls (logo, main button, buttons, inputs, headings:
position and size on the full-page screenshot), the brand's colours and typeface, and crops the logo
and the main button. The writer names ONE through-line object from the product (usually the main
button), a hook of 3–5 words, and scenes that each point at a real control. The planner builds:
a `throughLine` (the real button interrupts the hook, becomes a pill holding each scene's key word,
lands as the logo on the end card), a `screenFocus` per scene (the camera zooms to the control while a
cursor glides to it and clicks), the scene lines on a 120 BPM beat grid. `brand_style` dresses the
kind's preset in the site's own background, text and accent colours and (when bundled) its typeface.

What the prompts asked for that Rasika does differently: the real UI is not rebuilt as vector layers
(the screenshots are real; the camera, cursor and through-line object move over them); codebase-based
films use the live site (or screenshots uploaded on the photos step); 9:16 only; no WebGL depth of field
(the fly-over fakes thin focus with a sharp band over a blurred copy).

## The elements (packages/engine/src/brief.ts, product.ts)

| Element | What it draws | Sound |
| --- | --- | --- |
| `browserCard` | a browser window holding a real screenshot that scrolls inside it | whoosh in |
| `pourGlass` | a glass (rocks, highball, coupe, martini, wine, mug) filling layer by layer, each measure labelled, ice, garnish | a pour per layer |
| `fightHud` | two health bars, hit bursts with a word, shake, K.O., the winner's banner | impact per hit, boom at the K.O. |
| `seasonWindow` | a framed window with land rolling past through the seasons (blossom, sun, leaves, snow), a steaming cup | — |
| `noteMachine` | ramps, gears, a row of key blocks and a drum; pieces fly out of the typed line, then the ball plays them | a pitched note per key, kick per drum, gear ticks; nothing before the drop |
| `tierBoard` | S–D rows; each item appears big, then flies into its row and the row flashes | pop on appear, whoosh on the flight, hit on landing |
| `explainerWorld` | a world (space, earth, city, ocean, cell, lab) in three parallax layers that dolly, and a bee host flying between perches (idle, point, tap, wow, think); faceless films only | a soft whoosh per flight |
| `crowd` | quantities as little round figures; the highlighted ones change colour and hop on the spoken number | ticks as they appear, pop on the highlight |
| `screenFocus` | a window on the real page; the camera zooms to one region per step (spring in log scale, then a 1.00→1.04 push), a cursor glides to a real control and clicks (ripple) | whoosh per zoom, click tick |
| `throughLine` | one shape carried through the film: position, size, radius and colour morph on each key; a real crop (button, logo) is revealed inside by a mask, never cross-faded | pop on each change |
| `pageFlyover` | the page flat on a studio floor in 3D; glide (speed curve integrated), rise and flatten to an overhead strip, dive into the hero card, logo tiles, badge, two-line title word by word | whooshes at 8.66 s and 9.8 s, hit at 9.97 s (scaled) |
| `diagramZoom` | nodes and flows in a fixed layout; parts grow in (picture before words), flows draw and carry dots in their direction, the camera zooms into each part with one example and pulls back as it locks | pop per step, whoosh per zoom |
| `docCard` | a newspaper clipping, typed document or letter with a scissored edge and halftone; one phrase struck by a red marker (underline, circle, box) | whoosh in, marker scratch |

## Limits

- Vertical 1080×1920 only (the briefs that ask for 16:9 are made vertical).
- No generated video, characters or lip-sync: everything on screen is drawn by the engine or is a
  real screenshot. A brief that needs generated characters (e.g. a music video with a sung
  protagonist) is outside what this mode does.
- The fight roasts what the contenders do, never their looks or identity, and shows no likeness of a
  real person: names and colours only.
