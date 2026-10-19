# Films from a brief

Rasika makes some films with no footage at all: the user gives a brief, and the worker writes,
scores and designs the whole film. In the wizard: **Source → From a brief → pick the kind**.

| Kind | You give | You get | Look (preset) | Voice |
| --- | --- | --- | --- | --- |
| SaaS launch film | the product's website link | 25–30 s launch film: real screenshots in moving browser windows, feature titles and benefits, a call to action | `saas-launch` | music only |
| 15-second motion showreel | a website link | 15 s of kinetic type on the beat, the site's screens flying through, the name revealed | `showreel-kinetic` | music only |
| Apple-style app film | the app's website link (screenshots optional, on the photos step) | 30 s keynote-style film: one idea per shot, the real screens on a clean stage | `porcelain-keynote` | music only |
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

## The elements (packages/engine/src/brief.ts)

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
| `docCard` | a newspaper clipping, typed document or letter with a scissored edge and halftone; one phrase struck by a red marker (underline, circle, box) | whoosh in, marker scratch |

## Limits

- Vertical 1080×1920 only (the briefs that ask for 16:9 are made vertical).
- No generated video, characters or lip-sync: everything on screen is drawn by the engine or is a
  real screenshot. A brief that needs generated characters (e.g. a music video with a sung
  protagonist) is outside what this mode does.
- The fight roasts what the contenders do, never their looks or identity, and shows no likeness of a
  real person: names and colours only.
