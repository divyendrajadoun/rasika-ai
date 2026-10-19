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
  | "tierlist";

export type BriefField =
  | { id: "url"; label: string; placeholder: string; help: string }
  | { id: "recipe"; label: string; placeholder: string; help: string }
  | { id: "subject"; label: string; placeholder: string; help: string }
  | { id: "topic"; label: string; placeholder: string; help: string }
  | { id: "contenders" }
  | { id: "line" };

export interface BriefKind {
  id: BriefKindId;
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

const URL_FIELD: BriefField = {
  id: "url",
  label: "Website link",
  placeholder: "https://linear.app",
  help: "A public page of the product. We open it, take real screenshots and use its own words; we never invent features or numbers.",
};

export const BRIEF_KINDS: BriefKind[] = [
  {
    id: "launch",
    title: "SaaS launch film",
    blurb: "The polished launch video founders post on X: features, benefits and real screens.",
    youGive: "Your product's website link.",
    youGet: "A 25–30 s launch film: real screenshots in moving browser windows, feature titles, a call to action, scored.",
    fields: [URL_FIELD],
    preset: "saas-launch",
    narrate: false,
    maxSeconds: 32,
    example: { url: "https://linear.app" },
  },
  {
    id: "showreel",
    title: "15-second motion showreel",
    blurb: "A dynamic motion-design reel for a website, as if it were your showreel.",
    youGive: "A website link.",
    youGet: "A 15 s burst of kinetic type on the beat, the site's real screens flying through, the name revealed.",
    fields: [URL_FIELD],
    preset: "showreel-kinetic",
    narrate: false,
    maxSeconds: 16,
    example: { url: "https://vercel.com" },
  },
  {
    id: "app",
    title: "Apple-style app film",
    blurb: "A calm, premium 30-second film of your app: one idea per shot, lots of white space.",
    youGive: "Your app's website or landing page link. Add screenshots on the next step if you have them.",
    youGet: "A 30 s keynote-style film: short declarative lines, your real screens presented on a clean stage.",
    fields: [URL_FIELD],
    preset: "porcelain-keynote",
    narrate: false,
    maxSeconds: 32,
    example: { url: "https://things.app" },
  },
  {
    id: "recipe",
    title: "Recipe explainer",
    blurb: "From an empty glass to the finished drink, every ingredient and measure shown as it pours.",
    youGive: "The recipe: ingredients with their measures, the method, the garnish.",
    youGet: "A 30 s explainer: the glass fills layer by layer with each measure labelled, then the garnish and the name.",
    fields: [
      {
        id: "recipe",
        label: "Recipe",
        placeholder: "Negroni: 30 ml gin, 30 ml Campari, 30 ml sweet vermouth. Stir with ice, strain over a big cube, orange peel.",
        help: "Write it the way you would tell a friend. Your measures are used exactly as written.",
      },
    ],
    preset: "recipe-explainer",
    narrate: false,
    maxSeconds: 32,
    example: {
      recipe: "Negroni: 30 ml gin, 30 ml Campari, 30 ml sweet vermouth. Stir with ice, strain over a big cube, garnish with an orange peel.",
    },
  },
  {
    id: "versus",
    title: "Versus: a comic fight",
    blurb: "A one-minute arcade-style fight with a plot, special moves, a K.O. and a clear winner.",
    youGive: "Two contenders (people, brands, ideas) and, if you like, who wins.",
    youGet: "A 1-minute fight narrated by an announcer: health bars, rounds, absurd special moves, a K.O., the winner's banner.",
    fields: [{ id: "contenders" }],
    preset: "versus-arcade",
    narrate: true,
    maxSeconds: 62,
    example: { a: "Tabs", b: "Spaces", winner: "" },
  },
  {
    id: "machine",
    title: "Music machine",
    blurb: "A line types out on paper, falls apart into a music machine, and the machine plays a beat.",
    youGive: "The line that types out, and the closing words.",
    youGet: "A 20 s film: 12 s of silence while the machine builds, then every block the ball hits plays a note, then your closing words on a final hit.",
    fields: [{ id: "line" }],
    preset: "music-machine",
    narrate: false,
    maxSeconds: 22,
    example: { line: "make it catchy.", end: "ONE PROMPT" },
  },
  {
    id: "journey",
    title: "Storybook journey",
    blurb: "A pastel, symmetrical, chaptered vignette in the Grand Budapest Hotel manner, told through a window.",
    youGive: "What the story is about, in a sentence.",
    youGet: "A 30 s film: a framed window onto the passing seasons, chapter cards, deadpan lines, a waltz.",
    fields: [
      {
        id: "subject",
        label: "What's the story?",
        placeholder: "Four seasons passing outside a train window, a cosy carriage, a cup of coffee on the table.",
        help: "One or two sentences. Name the place, the mood and anything that should be in the frame.",
      },
    ],
    preset: "grand-budapest",
    narrate: false,
    maxSeconds: 32,
    example: { subject: "Four seasons passing outside a train window, a cosy carriage, a cup of coffee on the table." },
  },
  {
    id: "explainer",
    title: "Animated explainer",
    blurb: "A Kurzgesagt-style explainer: an illustrated world in parallax, a little flying host, numbers as characters.",
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
    title: "Editorial explainer",
    blurb: "A Vox-style narrated explainer told with paper evidence: clippings, documents, a red marker.",
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
    title: "Tier list",
    blurb: "The viral ranking format: S to D, each pick flying into its tier on the word, a hot take at the top.",
    youGive: "What to rank (and, if you like, the picks and where they go).",
    youGet: "A 25–40 s narrated tier list: a ranking board, 6–10 picks dropping in with a hit, a funny reason for each, captions in a blue box.",
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
];

export const briefKind = (id: string): BriefKind | undefined => BRIEF_KINDS.find((k) => k.id === id);

/** Presets made for one kind of brief film; they are offered there, not in the style grid of edits. */
export const BRIEF_PRESET_IDS = new Set(
  ["saas-launch", "showreel-kinetic", "recipe-explainer", "versus-arcade", "music-machine", "grand-budapest", "kurz-explainer"],
);
