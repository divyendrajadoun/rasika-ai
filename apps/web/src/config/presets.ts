import { presets as schemaPresets, type StyleTokens } from "@rasika/schema";

/** Style presets come from packages/schema; this adds landing-page preview copy. */
export interface PresetCard {
  tokens: StyleTokens;
  /** Three poster lines shown in the looping mini preview. */
  preview: { kicker: string; big: string; italic: string; caption: string };
  badge?: string;
}

const previewCopy: Record<string, PresetCard["preview"]> = {
  "mikku-royal": {
    kicker: "THE ONE THING",
    big: "NOBODY TELLS YOU",
    italic: "before you buy",
    caption: "honestly",
  },
  "katana-pop": {
    kicker: "STOP SCROLLING",
    big: "READ THIS",
    italic: "no, really.",
    caption: "really",
  },
  "noir-minimal": {
    kicker: "THE ONE THING",
    big: "NOBODY SAYS",
    italic: "about founders",
    caption: "founders",
  },
  "bold-creator": { kicker: "DAY 30", big: "RESULTS", italic: "are in", caption: "results" },
  "creator-yellow": {
    kicker: "THE REAL REASON",
    big: "YOU'RE STUCK",
    italic: "nobody says it",
    caption: "stuck",
  },
  "editorial-ivory": {
    kicker: "THE QUIET LUXURY",
    big: "OF LESS",
    italic: "a note on taste",
    caption: "less",
  },
  "clinic-clean": {
    kicker: "THREE REASONS",
    big: "YOU WAKE AT 3AM",
    italic: "the honest answer",
    caption: "honest",
  },
  "brutalist-acid": {
    kicker: "SHIP IT",
    big: "THIS WEEK",
    italic: "not next quarter",
    caption: "ship",
  },
  "cinema-bebas": {
    kicker: "OLD DELHI",
    big: "AT 5 AM",
    italic: "before the city wakes",
    caption: "dawn",
  },
  "paper-collage": {
    kicker: "HOW RENT",
    big: "ACTUALLY WORKS",
    italic: "clause eleven",
    caption: "clause",
  },
  "neon-pop": { kicker: "STOP", big: "SCROLLING", italic: "this is for you", caption: "you" },
  "sage-wellness": {
    kicker: "ONE BREATH",
    big: "BEFORE YOU EAT",
    italic: "the two-minute rule",
    caption: "breathe",
  },
  "boardroom-navy": {
    kicker: "BEFORE YOU SIGN",
    big: "READ CLAUSE 11",
    italic: "the lock-in period",
    caption: "deposit",
  },
  "festive-bandhani": {
    kicker: "THIS DIWALI",
    big: "GIFT RAS",
    italic: "not just gold",
    caption: "diwali",
  },
  "kinetic-mono": { kicker: "", big: "Your taste", italic: "was taught.", caption: "taught" },
  "whiteboard-marker": {
    kicker: "the rule",
    big: "Buy less",
    italic: "wear it more",
    caption: "wear",
  },
  "chalkboard-maths": {
    kicker: "lemma 1",
    big: "Taste = exposure",
    italic: "× repetition",
    caption: "taste",
  },
  "hype-cut": { kicker: "WAIT", big: "STOP", italic: "watch this", caption: "stop" },
  "launch-spotlight": {
    kicker: "introducing",
    big: "The Ras line",
    italic: "from ₹2,400",
    caption: "line",
  },
  "slam-neon": { kicker: "", big: "NOT READY", italic: "yet", caption: "ready" },
  "spotlight-promo": { kicker: "the offer", big: "Two for one", italic: "this week", caption: "week" },
  "showreel-blocks": { kicker: "01", big: "FIVE", italic: "features", caption: "five" }, // taste-skill-ignore: reel preview copy, a chapter number inside the reel
  "brand-bar": { kicker: "", big: "Taste matters.", italic: "", caption: "taste" },
  "beat-type": { kicker: "", big: "STOP", italic: "scrolling", caption: "stop" },
  motionmaxxed: { kicker: "", big: "Only one brand", italic: "does this.", caption: "one" },
  "sky-cards": { kicker: "step 1", big: "Connect it", italic: "in seconds", caption: "connect" },
  "cinema-navy": { kicker: "THE FREEZE", big: "NOT TRUE", italic: "here is why", caption: "why" },
  "podcast-on-air": { kicker: "ON AIR", big: "HOT TAKE", italic: "episode twelve", caption: "twelve" },
  "impacto-board": { kicker: "Act one", big: "The board", italic: "two bursts, no more", caption: "board" },
  "nativo-clean": { kicker: "", big: "Just the take.", italic: "", caption: "take" },
  "revista": { kicker: "ISSUE 04", big: "THE RULE", italic: "of less", caption: "rule" },
  "thriller-cctv": { kicker: "cam 02", big: "nobody saw it", italic: "until now", caption: "now" },
  "missao-sunset": { kicker: "MISSION 01", big: "Find the hook", italic: "reward: attention", caption: "reward" },
  "window-facecam": { kicker: "window", big: "One blue.", italic: "nothing else", caption: "blue" },
  "tabloid-headline": { kicker: "EXCLUSIVE", big: "THEY LIED", italic: "and we have proof", caption: "proof" },
  "viewfinder": { kicker: "REC 00:12", big: "FOCUS", italic: "on the one thing", caption: "focus" },
  "paper-explainer": { kicker: "01", big: "Start here", italic: "one idea per card", caption: "card" }, // taste-skill-ignore: reel preview copy, a chapter number inside the reel
  "zine-collage": { kicker: "600", big: "ZINE", italic: "cut and paste", caption: "paste" },
  "vibe-life": { kicker: "the rule", big: "Buy less,", italic: "wear it more", caption: "wear" },
  "kinetic-editorial": { kicker: "but", big: "NOT THIS", italic: "this.", caption: "this" },
  "craft-kraft": { kicker: "DAY 30", big: "ONE PEAK", italic: "per reel", caption: "peak" },
  "cyber-lime": { kicker: "SYSTEM", big: "ONLINE", italic: "no excuses", caption: "online" },
  "papercut": { kicker: "TAPED", big: "CUT", italic: "and pasted", caption: "cut" },
  "halftone-collage": { kicker: "// 02", big: "168", italic: "the only number", caption: "number" },
  "retro-terminal": { kicker: "$ run", big: "> the one thing", italic: "nobody tells you_", caption: "run" },
  "pixel-rpg": { kicker: "STAGE 1", big: "LEVEL UP", italic: "press start", caption: "start" },
  "paper-manuscript": { kicker: "\u00a7 1", big: "Taste is exposure", italic: "\u00d7 repetition", caption: "taste" },
  "ohneis": { kicker: "", big: "quiet luxury", italic: "is a habit", caption: "habit" },
  "porcelain-keynote": { kicker: "01", big: "One message", italic: "per frame", caption: "message" }, // taste-skill-ignore: reel preview copy, a chapter number inside the reel
  "paper-blue": { kicker: "// 01", big: "Measured,", italic: "not guessed", caption: "measured" },
  "ai-studio": { kicker: "step 1", big: "Connect it", italic: "then forget it", caption: "connect" },
  "oneshot-paper": { kicker: "the hook", big: "One take.", italic: "No frantic cuts.", caption: "take" },
  "morph-canvas": { kicker: "status", big: "One shape,", italic: "never a cut", caption: "shape" },
  "high-energy": { kicker: "128", big: "SLAM", italic: "on the kick", caption: "kick" },
  "dark-ios": { kicker: "9:41", big: "Tap once.", italic: "It follows you.", caption: "tap" },
  "navy-foil": { kicker: "THE FACT", big: "$4.2M", italic: "verdict: guilty", caption: "verdict" },
  "inema-amber": { kicker: "HOOK", big: "3 SECONDS", italic: "or they scroll", caption: "scroll" },
  "dark-stat": { kicker: "the number", big: "One stat", italic: "per scene", caption: "stat" },
  "memo-pop": { kicker: "", big: "POP", italic: "on the word", caption: "pop" },
  "bold-ad": { kicker: "STOP", big: "SCROLLING", italic: "this is the one", caption: "stop" },
  "premium-serif": { kicker: "", big: "Quiet money", italic: "moves slowly", caption: "quiet" },
  "fun-pop": { kicker: "YAY", big: "Day 30", italic: "results are in", caption: "results" },
  "brew-cards": { kicker: "01", big: "ONE FACT", italic: "per beat", caption: "fact" }, // taste-skill-ignore: reel preview copy, a chapter number inside the reel
  "pi-light": { kicker: "", big: "Out of the blur", italic: "when spoken", caption: "blur" },
  "warm-paper": { kicker: "", big: "Slow desk,", italic: "clear head", caption: "slow" },
  "handdrawn-notes": { kicker: "note to self", big: "Buy less", italic: "wear it more", caption: "wear" },
  "comic-pop": { kicker: "POW!", big: "NOPE", italic: "read the clause", caption: "nope" },
  "guofeng-paper": { kicker: "\u5377\u4e00", big: "Paper and ink", italic: "one red seal", caption: "seal" },
  "swiss-poster": { kicker: "01 / 05", big: "GRID", italic: "swap on the beat", caption: "grid" },
  "neon-hud": { kicker: "SCAN", big: "LOCKED", italic: "target acquired", caption: "locked" },
  "glass-violet": { kicker: "proof", big: "Show it", italic: "behind glass", caption: "glass" },
  "paper-grid": { kicker: "step 2", big: "Type it", italic: "then count it", caption: "count" },
  "breakout-card": { kicker: "card", big: "break out", italic: "of the frame", caption: "break" },
  "visual-journalism": { kicker: "SOURCE: 2024", big: "THE FACT", italic: "that hurts", caption: "fact" },
  "kolase-paper": { kicker: "hal 1", big: "Cut it out", italic: "stick it on", caption: "stick" },
  "vintage-sketch": { kicker: "Chapter I", big: "An old idea", italic: "worn well", caption: "idea" },
  "glass-keynote": { kicker: "keynote", big: "Introducing", italic: "the quiet one", caption: "quiet" },
  "multiverse-comic": { kicker: "BAM", big: "MULTI", italic: "verse", caption: "verse" },
  "ligne-paper": { kicker: "2024", big: "The pivot", italic: "on black", caption: "pivot" },
  "vox-doc": { kicker: "THE QUESTION", big: "WHY", italic: "it costs more", caption: "why" },
  "black-gold-brief": { kicker: "Q3", big: "$40 \u2192 $60", italic: "in one quarter", caption: "quarter" },
  "pencil-notes": { kicker: "notes", big: "Write it down", italic: "then say it", caption: "write" },
  "neon-cyber": { kicker: "2077", big: "SIGNAL", italic: "lost and found", caption: "signal" },
  "museum-doc": { kicker: "1920", big: "The evidence", italic: "in the centre", caption: "evidence" },
  "ghost-clean": { kicker: "", big: "Say less.", italic: "Mean it.", caption: "less" },
  "ghost-editorial": { kicker: "", big: "the previous line", italic: "fades light", caption: "light" },
  "ghost-cinematic": { kicker: "", big: "A quiet word", italic: "glows", caption: "glows" },
  "ghost-launch": { kicker: "v2.0", big: "Ship it", italic: "tonight", caption: "ship" },
  "ghost-kinetic": { kicker: "", big: "WORD", italic: "by word", caption: "word" },
  "ghost-pop": { kicker: "POP", big: "LOUD", italic: "and proud", caption: "loud" },
  "palavra": { kicker: "", big: "palavra", italic: "por palavra", caption: "palavra" },
  "kurgu-ink": { kicker: "// KICKER", big: "ONE MESSAGE", italic: "at a time", caption: "one" },
  "vox-paper": { kicker: "THE QUESTION", big: "FOUR INKS", italic: "and a paper", caption: "inks" },
};

const NEW_IDS = new Set([
  "cinema-navy",
  "podcast-on-air",
  "impacto-board",
  "nativo-clean",
  "revista",
  "thriller-cctv",
  "missao-sunset",
  "window-facecam",
  "tabloid-headline",
  "viewfinder",
  "paper-explainer",
  "zine-collage",
  "vibe-life",
  "kinetic-editorial",
  "craft-kraft",
  "cyber-lime",
  "papercut",
  "halftone-collage",
  "retro-terminal",
  "pixel-rpg",
  "paper-manuscript",
  "ohneis",
  "porcelain-keynote",
  "paper-blue",
  "ai-studio",
  "oneshot-paper",
  "morph-canvas",
  "high-energy",
  "dark-ios",
  "navy-foil",
  "inema-amber",
  "dark-stat",
  "memo-pop",
  "bold-ad",
  "premium-serif",
  "fun-pop",
  "brew-cards",
  "pi-light",
  "warm-paper",
  "handdrawn-notes",
  "comic-pop",
  "guofeng-paper",
  "swiss-poster",
  "neon-hud",
  "glass-violet",
  "paper-grid",
  "breakout-card",
  "visual-journalism",
  "kolase-paper",
  "vintage-sketch",
  "glass-keynote",
  "multiverse-comic",
  "ligne-paper",
  "vox-doc",
  "black-gold-brief",
  "pencil-notes",
  "neon-cyber",
  "museum-doc",
  "ghost-clean",
  "ghost-editorial",
  "ghost-cinematic",
  "ghost-launch",
  "ghost-kinetic",
  "ghost-pop",
  "palavra",
  "kurgu-ink",
  "vox-paper",
]);

/**
 * Where a community look's numbers were measured (repo · style). Shown as text in the wizard; the
 * presets are built from the rules in those repos, never from their code or media.
 */
export const PRESET_SOURCE: Record<string, string> = {
  "cinema-navy": "pycodebr/heditor \u00b7 cinema",
  "podcast-on-air": "pycodebr/heditor \u00b7 podcast",
  "impacto-board": "pycodebr/heditor \u00b7 impacto",
  "nativo-clean": "pycodebr/heditor \u00b7 nativo",
  "revista": "pycodebr/heditor \u00b7 revista",
  "thriller-cctv": "pycodebr/heditor \u00b7 thriller",
  "missao-sunset": "pycodebr/heditor \u00b7 missao",
  "window-facecam": "RahmanBuildsAI/ravyn-reel-kit \u00b7 window",
  "tabloid-headline": "RahmanBuildsAI/ravyn-reel-kit \u00b7 headline",
  "viewfinder": "RahmanBuildsAI/ravyn-reel-kit \u00b7 camera",
  "paper-explainer": "RahmanBuildsAI/ravyn-reel-kit \u00b7 paper",
  "zine-collage": "RahmanBuildsAI/ravyn-reel-kit \u00b7 collage",
  "vibe-life": "adriiita/vertical-video-editing-skill \u00b7 vibe-life",
  "kinetic-editorial": "ouerf-man/kinetic-editorial-skill",
  "craft-kraft": "mcdenil-skills/AutoMontage-Agent \u00b7 craft",
  "cyber-lime": "mcdenil-skills/AutoMontage-Agent \u00b7 cyber",
  "papercut": "0xS4N4TG/papercut-explainer",
  "halftone-collage": "pyang5166/gbro-collage-info",
  "retro-terminal": "yammaku/typewriter-video \u00b7 retro-terminal",
  "pixel-rpg": "yammaku/typewriter-video \u00b7 pixel-art + heditor \u00b7 game",
  "paper-manuscript": "TryWorld2026/paper-algorithm (skill: MIT)",
  "ohneis": "Maartenlouis/remotion-ads \u00b7 ohneis",
  "porcelain-keynote": "isaachang/motion-video-workflow",
  "paper-blue": "adunext/adu-motion-video \u00b7 default route",
  "ai-studio": "hassancs91/claude-youtube-editor \u00b7 brand.md",
  "oneshot-paper": "kvrancic/oneshot-video \u00b7 paper",
  "morph-canvas": "Barty-Bart/motion-graphics \u00b7 motion-broll",
  "high-energy": "Barty-Bart/motion-graphics \u00b7 explainer-high-energy",
  "dark-ios": "Barty-Bart/motion-graphics \u00b7 explainer-engaging",
  "navy-foil": "generalizingai/shadowcast \u00b7 demo brand",
  "inema-amber": "inematds/skill-video-plan-editor (values measured; no licence file)",
  "dark-stat": "marketcalls/story-telling \u00b7 reel template",
  "memo-pop": "Kimeur/motion-launch-videos \u00b7 motion-captions (acme-memo)",
  "bold-ad": "Neelshah1810/Claude-Video-Skills \u00b7 Bold",
  "premium-serif": "Neelshah1810/Claude-Video-Skills \u00b7 Premium",
  "fun-pop": "Neelshah1810/Claude-Video-Skills \u00b7 Fun",
  "brew-cards": "Finderchangchang/promo-video-skill \u00b7 cards / warm-emotion",
  "pi-light": "ahmdd4vd/MotionCraft \u00b7 pi-v2",
  "warm-paper": "ahmdd4vd/MotionCraft \u00b7 warm-paper",
  "handdrawn-notes": "Changroro/code-video \u00b7 handdrawn",
  "comic-pop": "Changroro/code-video \u00b7 comic",
  "guofeng-paper": "AllenAI2014/remotion-guofeng-starter",
  "swiss-poster": "crawfordxx/xiaoma-studio \u00b7 swiss + HRuiCcc/RuiC-motion-reel \u00b7 swiss-editorial",
  "neon-hud": "HRuiCcc/RuiC-motion-reel \u00b7 neon-hud + chuspeeism/dashi \u00b7 \u9713\u8679\u8d5b\u535a",
  "glass-violet": "alisadiq-ai/favstash-ai-video-editing-skills \u00b7 adaptive-glass (soft-violet)",
  "paper-grid": "alisadiq-ai/favstash-ai-video-editing-skills \u00b7 paper-grid",
  "breakout-card": "alisadiq-ai/favstash-ai-video-editing-skills \u00b7 breakout-card",
  "visual-journalism": "bangtutorial/bang-motion \u00b7 jurnalisme visual",
  "kolase-paper": "bangtutorial/bang-motion \u00b7 kartun kolase",
  "vintage-sketch": "bangtutorial/bang-motion \u00b7 sketsa vintage",
  "glass-keynote": "bestagentkits/motion-video-skill \u00b7 glass keynote",
  "multiverse-comic": "bestagentkits/motion-video-skill \u00b7 comic multiverse",
  "ligne-paper": "cblain100-prog/motion-design-claude-code \u00b7 ligne du temps v8",
  "vox-doc": "charlie947/motion-graphics-skills \u00b7 vox-explainer",
  "black-gold-brief": "jackjls/jtxvideo-skill + chuspeeism/dashi \u00b7 \u9ed1\u5e95\u79d1\u6280",
  "pencil-notes": "chuspeeism/dashi-animationstyle \u00b7 \u624b\u7ed8\u7b14\u8bb0",
  "neon-cyber": "chuspeeism/dashi-animationstyle \u00b7 \u9713\u8679\u8d5b\u535a",
  "museum-doc": "crawfordxx/xiaoma-studio \u00b7 museum",
  "ghost-clean": "kurbaitaev/ghost-editor \u00b7 clean",
  "ghost-editorial": "kurbaitaev/ghost-editor \u00b7 editorial",
  "ghost-cinematic": "kurbaitaev/ghost-editor \u00b7 cinematic",
  "ghost-launch": "kurbaitaev/ghost-editor \u00b7 launch",
  "ghost-kinetic": "kurbaitaev/ghost-editor \u00b7 kinetic",
  "ghost-pop": "kurbaitaev/ghost-editor \u00b7 pop",
  "palavra": "nomicsadmin/editor-video-ia \u00b7 rosto e ideia",
  "kurgu-ink": "onuryildriim/claude-kurgu-atolyesi",
  "vox-paper": "jaredcassoutt/vox-editorial \u00b7 vox-skill",
};

/** Human labels for a preset's motion family and sound kit (wizard + landing chips). */
export const FAMILY_LABEL: Record<StyleTokens["motion"]["family"], string> = {
  editorial: "Editorial",
  kinetic: "Kinetic type",
  whiteboard: "Whiteboard",
  chalk: "Chalkboard",
  hype: "Hype cut",
  launch: "Launch film",
  collage: "Paper collage",
  blocks: "Colour blocks",
  beat: "Beat type",
};
export const SFX_LABEL: Record<StyleTokens["motion"]["sfxKit"], string> = {
  pop: "Pop & whoosh",
  click: "Soft clicks",
  marker: "Marker on board",
  chalk: "Chalk",
  hype: "Zaps & drops",
  cinematic: "Cinematic",
  none: "Silent",
};

/** Every preset, for lookups (a project's style, a brief film's look). */
export const allPresetCards: PresetCard[] = schemaPresets.map((tokens) => ({
  tokens,
  preview: previewCopy[tokens.id] ?? {
    kicker: "YOUR STORY",
    big: "YOUR WORDS",
    italic: "your style",
    caption: "style",
  },
  badge: tokens.id === "mikku-royal" ? "Default" : NEW_IDS.has(tokens.id) ? "New" : undefined,
}));

/**
 * Looks made for one kind of brief film (config/briefs.ts); they are chosen with the film, not in
 * the style grid of an edit. Mirrors BRIEF_PRESET_IDS there (kept here to avoid an import cycle).
 */
const BRIEF_ONLY = new Set(["saas-launch", "showreel-kinetic", "recipe-explainer", "versus-arcade", "music-machine", "grand-budapest"]);
/** Styles whose demo render (public/demo/styles/<id>.mp4) is not made yet: not offered in a grid until it is. */
const DEMO_PENDING = new Set<string>([]);

/** The styles offered for an edit (a take, a script, a presenter): every one has a real demo render. */
export const presetCards: PresetCard[] = allPresetCards.filter(
  (c) => !BRIEF_ONLY.has(c.tokens.id) && !DEMO_PENDING.has(c.tokens.id),
);

export const defaultPresetId = "mikku-royal";

/**
 * How a project's style is named in the dashboard. A "Match a reference" project has no picked
 * preset: its look is written from the uploaded reel, so it is named after that.
 */
export function projectStyleLabel(stylePreset: string, styleOptions: unknown): string {
  const o = (styleOptions ?? {}) as { source?: string; referenceStyle?: { name?: string } };
  if (o.source === "reference") {
    const name = o.referenceStyle?.name;
    return name ? `${name} (from your reference)` : "Matched from your reference";
  }
  return allPresetCards.find((c) => c.tokens.id === stylePreset)?.tokens.name ?? stylePreset;
}
