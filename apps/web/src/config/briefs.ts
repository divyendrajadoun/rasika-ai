/**
 * Films made from a brief instead of footage. Mirrors apps/worker/rasika_worker/brief.py KINDS (the
 * worker writes, scores and designs them); this side says what each one needs from the user.
 */

export type BriefKindId =
  | "launch"
  | "showreel"
  | "app"
  | "recipe"
  | "versus"
  | "machine"
  | "journey"
  | "explainer"
  | "editorial"
  | "tierlist"
  | "product"
  | "referral"
  | "hype"
  | "flyover"
  | "diagram"
  | "animate"
  | "roundup"
  | "researched";

/** The sections the kinds are shown in (wizard + dashboard). */
export type BriefGroup = "post" | "animate" | "website" | "topic" | "fun";
export const BRIEF_GROUPS: { id: BriefGroup; title: string; blurb: string }[] = [
  {
    id: "post",
    title: "From a post",
    blurb:
      "Paste a post that lists things with links: we visit every link and make a narrated reel of them.",
  },
  {
    id: "animate",
    title: "Animate anything",
    blurb:
      "Show a style you love, give a rough idea: every frame is drawn in code, scored, and checked against your style.",
  },
  {
    id: "website",
    title: "From your website",
    blurb: "Give a link: we capture the real page, its controls, colours and words.",
  },
  {
    id: "topic",
    title: "From a topic",
    blurb: "Give a topic or a recipe: we write it, design it and (for some) narrate it.",
  },
  { id: "fun", title: "Fun formats", blurb: "Fights, tier lists, machines and storybooks." },
];

export type BriefField =
  | { id: "url"; label: string; placeholder: string; help: string }
  | { id: "recipe"; label: string; placeholder: string; help: string }
  | { id: "subject"; label: string; placeholder: string; help: string }
  | { id: "topic"; label: string; placeholder: string; help: string }
  | { id: "contenders" }
  | { id: "line" }
  | { id: "focus"; label: string; placeholder: string; help: string }
  | { id: "seconds"; options: number[] }
  | { id: "closing" }
  | { id: "presets"; items: { label: string; text: string; seconds?: number }[] }
  | { id: "narrate" }
  | { id: "post"; label: string; placeholder: string; help: string }
  | { id: "speaker" }
  | { id: "look" }
  | { id: "theme" };

/** The looks of a researched explainer (apps/worker/rasika_worker/hyper.py THEMES), or a reel to match. */
export type ExplainerThemeId = "studio" | "night" | "pop";
export const EXPLAINER_THEMES: {
  id: ExplainerThemeId;
  name: string;
  blurb: string;
  swatch: [string, string, string];
}[] = [
  {
    id: "studio",
    name: "Studio",
    blurb: "Warm paper, drifting light, bold black type, one orange word.",
    swatch: ["#f1e9dd", "#1e1813", "#c2571b"],
  },
  {
    id: "night",
    name: "Night",
    blurb: "Deep navy, violet and teal light, warm amber accents.",
    swatch: ["#0d0f14", "#f4f1ea", "#ffb347"],
  },
  {
    id: "pop",
    name: "Pop",
    blurb: "Butter yellow, pink and blue light, red accents.",
    swatch: ["#fff2b8", "#111111", "#e8361c"],
  },
];

/** The designed looks of a roundup film (packages/engine/src/roundup.ts), or a reel to match. */
export type RoundupLookId = "signal" | "frontpage" | "loud" | "keynote" | "terminal";
export const ROUNDUP_LOOKS: { id: RoundupLookId; name: string; blurb: string }[] = [
  {
    id: "signal",
    name: "Signal",
    blurb: "Dark tech: glowing 3D screens, outlined numerals, a moving grid.",
  },
  {
    id: "frontpage",
    name: "Front page",
    blurb: "Newspaper: paper, serif headlines, taped clippings, a red marker.",
  },
  {
    id: "loud",
    name: "Loud",
    blurb: "Bold pop: a colour block per item, giant numbers, stickers, bounce.",
  },
  {
    id: "keynote",
    name: "Keynote",
    blurb: "Polished: drifting colour light, glass panels, big rounded screens.",
  },
  {
    id: "terminal",
    name: "Terminal",
    blurb: "Hacker: scanlines, typed commands, a green preview turning to colour.",
  },
];

export interface BriefKind {
  id: BriefKindId;
  group: BriefGroup;
  title: string;
  /** what the film is, one line */
  blurb: string;
  /** what the user has to give, in plain words (shown on the card and the form) */
  youGive: string;
  /** what comes back */
  youGet: string;
  fields: BriefField[];
  /** the look (a preset id) */
  preset: string;
  /** narrated by a voice (true) or carried by on-screen type and music (false) */
  narrate: boolean;
  /** the longest the film runs, for the credit estimate */
  maxSeconds: number;
  /** prefilled example the user can keep or replace */
  example: Record<string, string>;
}

const FOCUS_FIELD: BriefField = {
  id: "focus",
  label: "What should it focus on? (optional)",
  placeholder: "e.g. the new AI triage feature; for developers at startups",
  help: "Leave empty and we pick the product's strongest moments from its own page.",
};

/** The through-line films: one real element of the product carries the whole film. */
const THROUGH_GET =
  "one real element of your product (its main button or logo) carries the film: it morphs scene to scene, a cursor clicks your real controls while the camera zooms screen-studio style, and it lands as your logo on the end card. In your own colours and typeface, on a 120 BPM beat.";

const URL_FIELD: BriefField = {
  id: "url",
  label: "Website link",
  placeholder: "https://linear.app",
  help: "A public page of the product. We open it, take real screenshots and use its own words; we never invent features or numbers.",
};

export const BRIEF_KINDS: BriefKind[] = [
  {
    id: "researched",
    group: "topic",
    title: "Explainer from a topic",
    blurb:
      'Name a topic or paste a post: we research it and make a fast "how it works" reel with real numbers.',
    youGive: "A topic, an idea or a post (links welcome).",
    youGet:
      'A 40–65 s narrated reel in the "how it works" format: a hook on screen from the first frame, then a new scene every 2–3 seconds (steps on cards, the real pages, numbers that count up), captions on every word, and a comment call to action. Every number comes from the research, with its source.',
    fields: [
      {
        id: "topic",
        label: "What should it explain?",
        placeholder: "How UPI payments work in India, for a beginner",
        help: "A topic, an idea or a whole post. Add links and we open them; we also search the web and only use facts we can source.",
      },
      { id: "theme" },
    ],
    preset: "dark-ios",
    narrate: true,
    maxSeconds: 66,
    example: { topic: "How UPI payments work in India, explained for a beginner" },
  },
  {
    id: "roundup",
    group: "post",
    title: "Roundup from a post",
    blurb:
      "A post listing repos, tools or products becomes a reel: each one shown on its real page while a voice explains it.",
    youGive: "The post, with a link for each thing it lists.",
    youGet:
      "A 45–90 s reel: a hook, then each item with its real page, its demo clip and its numbers on screen while a voice (or an AI presenter) explains it in plain words, captions throughout, and a recap of every name at the end. Facts come only from the post and the pages.",
    fields: [
      {
        id: "post",
        label: "Paste the post",
        placeholder: "1. owner/repo — what it does\nhttps://github.com/owner/repo\n\n2. …",
        help: "Up to 8 items, each with its link. We open every link: the page, its README, its demo clips and today's numbers.",
      },
      { id: "look" },
      { id: "speaker" },
    ],
    preset: "dark-ios",
    narrate: true,
    maxSeconds: 90,
    example: {
      post: "Today's GitHub top 3: AI design skills and a robot duck\n\n1. pbakaus/impeccable\nA design language that makes AI coding assistants understand design.\nhttps://github.com/pbakaus/impeccable\n\n2. Nutlope/hallmark\nA design skill that rejects AI slop, for Claude Code, Codex and Cursor.\nhttps://github.com/Nutlope/hallmark\n\n3. pollen-robotics/microduck\nA mini two-legged duck robot that walks, trained with reinforcement learning.\nhttps://github.com/pollen-robotics/microduck",
    },
  },
  {
    id: "launch",
    group: "website",
    title: "SaaS launch film",
    blurb: "The polished launch video founders post on X: features, benefits and real screens.",
    youGive: "Your product's website link.",
    youGet: "A high-end 30 s launch film: " + THROUGH_GET,
    fields: [URL_FIELD, FOCUS_FIELD, { id: "seconds", options: [20, 30, 40] }],
    preset: "saas-launch",
    narrate: false,
    maxSeconds: 32,
    example: { url: "https://linear.app" },
  },
  {
    id: "showreel",
    group: "website",
    title: "15-second motion showreel",
    blurb: "A dynamic motion-design reel for a website, as if it were your showreel.",
    youGive: "A website link.",
    youGet: "A 15 s showreel matching your landing page: " + THROUGH_GET,
    fields: [URL_FIELD, FOCUS_FIELD],
    preset: "showreel-kinetic",
    narrate: false,
    maxSeconds: 16,
    example: { url: "https://vercel.com" },
  },
  {
    id: "app",
    group: "website",
    title: "Apple-style app film",
    blurb: "A calm, premium 30-second film of your app: one idea per shot, lots of white space.",
    youGive:
      "Your app's website or landing page link. Add screenshots on the next step if you have them.",
    youGet: "A 30 s keynote-style film, white space and one idea per shot: " + THROUGH_GET,
    fields: [URL_FIELD, FOCUS_FIELD, { id: "seconds", options: [20, 30] }],
    preset: "porcelain-keynote",
    narrate: false,
    maxSeconds: 32,
    example: { url: "https://things.app" },
  },
  {
    id: "recipe",
    group: "topic",
    title: "Recipe explainer",
    blurb:
      "From an empty glass to the finished drink, every ingredient and measure shown as it pours.",
    youGive: "The recipe: ingredients with their measures, the method, the garnish.",
    youGet:
      "A 30 s explainer: the glass fills layer by layer with each measure labelled, then the garnish and the name.",
    fields: [
      {
        id: "recipe",
        label: "Recipe",
        placeholder:
          "Negroni: 30 ml gin, 30 ml Campari, 30 ml sweet vermouth. Stir with ice, strain over a big cube, orange peel.",
        help: "Write it the way you would tell a friend. Your measures are used exactly as written.",
      },
    ],
    preset: "recipe-explainer",
    narrate: false,
    maxSeconds: 32,
    example: {
      recipe:
        "Negroni: 30 ml gin, 30 ml Campari, 30 ml sweet vermouth. Stir with ice, strain over a big cube, garnish with an orange peel.",
    },
  },
  {
    id: "versus",
    group: "fun",
    title: "Versus: a comic fight",
    blurb: "A one-minute arcade-style fight with a plot, special moves, a K.O. and a clear winner.",
    youGive: "Two contenders (people, brands, ideas) and, if you like, who wins.",
    youGet:
      "A 1-minute fight narrated by an announcer: health bars, rounds, absurd special moves, a K.O., the winner's banner.",
    fields: [{ id: "contenders" }],
    preset: "versus-arcade",
    narrate: true,
    maxSeconds: 62,
    example: { a: "Tabs", b: "Spaces", winner: "" },
  },
  {
    id: "machine",
    group: "fun",
    title: "Music machine",
    blurb:
      "A line types out on paper, falls apart into a music machine, and the machine plays a beat.",
    youGive: "The line that types out, and the closing words.",
    youGet:
      "A 20 s film: 12 s of silence while the machine builds, then every block the ball hits plays a note, then your closing words on a final hit.",
    fields: [{ id: "line" }],
    preset: "music-machine",
    narrate: false,
    maxSeconds: 22,
    example: { line: "make it catchy.", end: "ONE PROMPT" },
  },
  {
    id: "journey",
    group: "fun",
    title: "Storybook journey",
    blurb:
      "A pastel, symmetrical, chaptered vignette in the Grand Budapest Hotel manner, told through a window.",
    youGive: "What the story is about, in a sentence.",
    youGet:
      "A 30 s film: a framed window onto the passing seasons, chapter cards, deadpan lines, a waltz.",
    fields: [
      {
        id: "subject",
        label: "What's the story?",
        placeholder:
          "Four seasons passing outside a train window, a cosy carriage, a cup of coffee on the table.",
        help: "One or two sentences. Name the place, the mood and anything that should be in the frame.",
      },
    ],
    preset: "grand-budapest",
    narrate: false,
    maxSeconds: 32,
    example: {
      subject:
        "Four seasons passing outside a train window, a cosy carriage, a cup of coffee on the table.",
    },
  },
  {
    id: "explainer",
    group: "topic",
    title: "Animated explainer",
    blurb:
      "A Kurzgesagt-style explainer: an illustrated world in parallax, a little flying host, numbers as characters.",
    youGive: "A topic or a question, in a sentence (and, if you like, the angle you want).",
    youGet:
      "A 40–60 s narrated film: one illustrated world (space, earth, city, ocean, cell or lab), a bee host that points and taps, crowds of little figures for the numbers, a payoff.",
    fields: [
      {
        id: "topic",
        label: "What should it explain?",
        placeholder: "Why is the sky blue, and why are sunsets red?",
        help: "A topic or a question. Add the angle or the one fact you want in it; we only use well-known facts and never invent statistics.",
      },
    ],
    preset: "kurz-explainer",
    narrate: true,
    maxSeconds: 62,
    example: { topic: "Why is the sky blue, and why are sunsets red?" },
  },
  {
    id: "editorial",
    group: "topic",
    title: "Editorial explainer",
    blurb:
      "A Vox-style narrated explainer told with paper evidence: clippings, documents, a red marker.",
    youGive: "A topic or a story, in a sentence (a date or a source you want cited helps).",
    youGet:
      "A 40–60 s narrated film: newspaper clippings and documents with the key phrase marked in red, numbers on the spoken word, a clear 'so what'.",
    fields: [
      {
        id: "topic",
        label: "What's the story?",
        placeholder: "How the Wright brothers' 12-second flight in 1903 changed travel",
        help: "A topic, an event or a question. The clippings paraphrase well-established facts; they never imitate a real newspaper's headline.",
      },
    ],
    preset: "vox-paper",
    narrate: true,
    maxSeconds: 62,
    example: { topic: "How the Wright brothers' 12-second flight in 1903 changed travel" },
  },
  {
    id: "tierlist",
    group: "fun",
    title: "Tier list",
    blurb:
      "The viral ranking format: S to D, each pick flying into its tier on the word, a hot take at the top.",
    youGive: "What to rank (and, if you like, the picks and where they go).",
    youGet:
      "A 25–40 s narrated tier list: a ranking board, 6–10 picks dropping in with a hit, a funny reason for each, captions in a blue box.",
    fields: [
      {
        id: "topic",
        label: "What are we ranking?",
        placeholder: "Programming languages for a first project. Python in S, put Brainfuck in D.",
        help: "The topic, plus any picks and tiers you want. Rankings are framed as opinions; names only, never faces.",
      },
    ],
    preset: "tier-list",
    narrate: true,
    maxSeconds: 40,
    example: { topic: "Breakfast foods, ranked. Cereal in S, plain toast in D." },
  },
  {
    id: "animate",
    group: "animate",
    title: "Animate anything",
    blurb:
      "Your style references and a rough idea become a film drawn entirely in code: no video model, no stock footage.",
    youGive:
      "1–3 images of a style you love (next step), a topic or story, a length, and if you like narration and an ending.",
    youGet:
      "An 8–30 s animated film in your style: a style guide, checked facts for explainers, 2–4 s shots with a moving camera, music in code, every shot checked against your references and fixed before render.",
    fields: [
      {
        id: "presets",
        items: [
          {
            label: "Hummingbird explainer",
            text: "A cool explainer video on how a hummingbird hovers",
            seconds: 15,
          },
          {
            label: "Kids' story",
            text: "A tiny paper rocket that dreams of touching the moon, told in 6 shots with a happy ending",
            seconds: 30,
          },
          {
            label: "Product ad",
            text: "A launch ad for my app [name + one line about what it does]. Show the problem, the app solving it, and end on the logo",
            seconds: 20,
          },
          {
            label: "Science explainer",
            text: "How bees tell each other where the flowers are (the waggle dance). Verify the facts",
            seconds: 15,
          },
          {
            label: "Milestone",
            text: "My channel hit 10,000 followers. Big number count-up, my brand colours, a confetti burst",
            seconds: 8,
          },
        ],
      },
      {
        id: "topic",
        label: "Story or topic",
        placeholder: "A cool explainer video on how a hummingbird hovers",
        help: "A rough idea is enough. For explainers we only show facts we can source, and keep the sources.",
      },
      { id: "seconds", options: [8, 10, 15, 20, 30] },
      { id: "narrate" },
      {
        id: "focus",
        label: "Words or an ending (optional)",
        placeholder: "e.g. end on “Hover like a hummingbird”",
        help: "Pure animation beats on-screen text: most shots have no words at all.",
      },
    ],
    preset: "animate-studio",
    narrate: false,
    maxSeconds: 31,
    example: { topic: "A cool explainer video on how a hummingbird hovers", seconds: "15" },
  },
  {
    id: "product",
    group: "website",
    title: "Product film",
    blurb: "A 40-second film of what your product does and who it's for, on its real interface.",
    youGive: "Your product's website link (and, if you like, what to focus on).",
    youGet: "A 40 s product film: " + THROUGH_GET,
    fields: [URL_FIELD, FOCUS_FIELD, { id: "seconds", options: [30, 40, 60] }],
    preset: "porcelain-keynote",
    narrate: false,
    maxSeconds: 62,
    example: { url: "https://linear.app", seconds: "40" },
  },
  {
    id: "referral",
    group: "website",
    title: "Referral promo",
    blurb: "15 seconds on how your referral programme works and what people get.",
    youGive:
      "The link to your referral page (or your site), and the reward in a line if it isn't on the page.",
    youGet:
      "A 15 s promo: how referring works and what you get, ending on how to start referring. " +
      THROUGH_GET,
    fields: [
      URL_FIELD,
      {
        id: "focus",
        label: "The programme in a line (optional)",
        placeholder: "e.g. Give a friend a month free, get a month free when they subscribe",
        help: "We only say what your page (or this line) says: no invented rewards or numbers.",
      },
    ],
    preset: "porcelain-keynote",
    narrate: false,
    maxSeconds: 16,
    example: { url: "https://dropbox.com/referrals" },
  },
  {
    id: "hype",
    group: "website",
    title: "Hype launch",
    blurb: "A punchy 20-second launch video for socials.",
    youGive: "Your product's website link (and what to focus on, if you like).",
    youGet: "A 20 s hype video: " + THROUGH_GET,
    fields: [URL_FIELD, FOCUS_FIELD, { id: "seconds", options: [15, 20, 30] }],
    preset: "porcelain-keynote",
    narrate: false,
    maxSeconds: 32,
    example: { url: "https://cal.com", seconds: "20" },
  },
  {
    id: "flyover",
    group: "website",
    title: "Landing-page fly-over",
    blurb:
      "A 3D camera glides over your landing page, rises to show it whole, and dives into the hero.",
    youGive:
      "Your landing page link and a two-part closing line (a statement, then a short italic tail). Your brand name goes on the Brand step.",
    youGet:
      "A 14.5 s film: your page flat on a bright studio floor, one continuous camera with thin focus, the hero landing as a card under your two-line title and logo.",
    fields: [URL_FIELD, { id: "closing" }],
    preset: "porcelain-keynote",
    narrate: false,
    maxSeconds: 15,
    example: {
      url: "https://linear.app",
      closeLine: "Built for the way you work.",
      closeTail: "Finally.",
    },
  },
  {
    id: "diagram",
    group: "topic",
    title: "Diagram explainer",
    blurb:
      "One diagram, one continuous space: the camera zooms into each part and pulls back to show how it fits.",
    youGive: "What to explain (a product, a tool, an idea), and its website link if it has one.",
    youGet:
      "A 60 s explainer: a hook question, three to five parts each zoomed into with one concrete example, then the whole diagram and a one-line takeaway. Music only, one typeface, one accent.",
    fields: [
      {
        id: "topic",
        label: "What should it explain?",
        placeholder: "Why a CDN makes a website fast, for someone deciding whether to use one",
        help: "Say who it's for and what they're deciding. Facts only; we never invent numbers or quotes.",
      },
      {
        ...URL_FIELD,
        label: "Website link (optional)",
        help: "If it's a product, we read its own page so every fact is right.",
      } as BriefField,
    ],
    preset: "porcelain-keynote",
    narrate: false,
    maxSeconds: 62,
    example: { topic: "Why a CDN makes a website fast, for someone deciding whether to use one" },
  },
];

export const briefKind = (id: string): BriefKind | undefined =>
  BRIEF_KINDS.find((k) => k.id === id);

/** Presets made for one kind of brief film; they are offered there, not in the style grid of edits. */
export const BRIEF_PRESET_IDS = new Set([
  "saas-launch",
  "showreel-kinetic",
  "recipe-explainer",
  "versus-arcade",
  "music-machine",
  "grand-budapest",
  "kurz-explainer",
]);
