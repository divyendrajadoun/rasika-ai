/**
 * All landing-page copy. Edit freely — components only read from here.
 */
import { brand } from "@/config/brand";

export const nav = {
  links: [
    { label: "How it works", href: "#how-it-works" },
    { label: "Styles", href: "#styles" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ],
  cta: { label: "Get started", href: "/dashboard" },
};

export const hero = {
  /** Words rise one by one; the word in `goldWord` is coloured gold. */
  headline: "YOUR REEL. EDITED LIKE A STUDIO DID IT.",
  goldWord: "STUDIO",
  sub: "Upload a talking video. Get poster type, captions, images on the exact word, and sound — in minutes.",
  primary: { label: "Get started — it's free", href: "/dashboard" },
  secondary: { label: "See an example", href: "#before-after" },
  trust: ["Hindi + English captions", "1080p", "Your photos, your story"],
  demo: {
    after: "/demo/after.mp4",
    afterPoster: "/demo/after-poster.webp",
    alt: "A 90-second jewellery reel edited by Rasika: poster typography above the speaker, one-word captions and photo cards landing on spoken words.",
  },
};

export const beforeAfter = {
  eyebrow: "Before / after",
  title: "Same take. Different reel.",
  sub: "Drag the handle. The raw selfie clip is on the left, the Rasika edit on the right — playing in sync.",
  before: { src: "/demo/before.mp4", label: "Raw clip" },
  after: { src: "/demo/after.mp4", label: "Rasika edit" },
  note: "Real footage: the same 90-second take, raw on the left and the Rasika edit on the right.",
};

export const howItWorks = {
  eyebrow: "How it works",
  title: "Three steps. No timeline.",
  steps: [
    {
      n: "01",
      line: "UPLOAD YOUR REEL",
      italic: "a selfie video, 15 s to 3 min",
      body: "Phone footage is fine. HEVC, MOV, MP4 — up to 500 MB, resumable if your network drops.",
    },
    {
      n: "02",
      line: "ADD PHOTOS & PICK A STYLE",
      italic: "“show this when I say payal”",
      body: "Drop in product shots or screenshots, tell us which word they belong to, choose a preset or describe your look.",
    },
    {
      n: "03",
      line: "PREVIEW, TWEAK, DOWNLOAD",
      italic: "change a headline, retime a card",
      body: "A live preview you can edit in the browser. Render a 1080×1920 MP4 with captions, cards and sound.",
    },
  ],
};

export const features = {
  eyebrow: "What the edit does",
  title: "Everything a motion designer would do by hand.",
  items: [
    {
      id: "poster",
      title: "Poster typography",
      body: "Your key line as Anton poster type on the wall above your head — never over your face.",
    },
    {
      id: "captions",
      title: "One-word captions",
      body: "Every word pops in on time. Feelings turn gold, names and numbers turn terracotta.",
    },
    {
      id: "image-on-word",
      title: "Images on the exact word",
      body: "Say “jhumka”, the jhumka lands. Polaroid cards fly in on the word that names them.",
    },
    {
      id: "punch-in",
      title: "Prop punch-in",
      body: "A zoom on the piece you're wearing, with a gold ring drawing around it.",
    },
    {
      id: "pip",
      title: "Picture-in-picture plates",
      body: "Full-bleed photos behind you for “look at this” moments, with labels that read.",
    },
    {
      id: "reveal",
      title: "Mystery-word reveal",
      body: "Tease a word at five seconds. Reveal it near the end with a riser, impact and gold burst.",
    },
    {
      id: "sfx",
      title: "Sound effects",
      body: "Whooshes, pops, ticks and subs placed on the beat sheet, mixed under your voice.",
    },
    {
      id: "hindi",
      title: "Hindi in Devanagari",
      body: "Hinglish is understood. Hindi words appear on screen in proper Devanagari — never romanised.",
    },
  ],
};

export const styles = {
  eyebrow: "Styles",
  title: "Pick a look, or describe one.",
  sub: "Every preset is a full design system: palette, type, captions, pace, end card. Type “vintage Bollywood poster, more yellow” and we map it to the nearest safe tokens.",
  ctaLabel: "Use this style",
};

export const whoFor = {
  eyebrow: "Who it's for",
  title: "Made for people who talk to camera.",
  items: [
    {
      title: "Jewellery & fashion brands",
      body: "Your pieces on screen the moment you name them.",
    },
    { title: "D2C founders", body: "Founder-led content that looks like a studio made it." },
    { title: "Educators", body: "Chapters, counters and equations that land on your words." },
    { title: "Creators", body: "Post daily without opening a timeline." },
    { title: "Agencies", body: "Brand kits per client, renders in minutes, not days." },
  ],
};

export const pricing = {
  eyebrow: "Pricing",
  title: "Start free. Pay when it pays off.",
  sub: "Prices in INR with UPI and cards. International? Toggle to USD.",
  creditsTitle: "Or buy credits",
  creditsSub: "1 credit = 1 reel up to 90 s. Longer reels use more credits.",
  perMonth: "/ mo",
};

export const faq = {
  eyebrow: "FAQ",
  title: "Questions, answered.",
  items: [
    {
      q: "Which languages work?",
      a: "English, Hindi and Hinglish today. We detect the language and verify it on a short probe, so Hindi speech never gets mangled into English (or the other way round). Hindi words appear in Devanagari on screen.",
    },
    {
      q: "How long does it take?",
      a: "Transcription and planning take a couple of minutes. A 90-second final render is usually under four minutes. You can preview and edit in the browser before you render.",
    },
    {
      q: "Do you keep my videos?",
      a: "Source videos and outputs are kept for 30 days by default so you can re-edit, then deleted. Frames extracted for rendering are deleted right after the render. You can delete a project instantly at any time.",
    },
    {
      q: "Can I edit the result?",
      a: "Yes. Fix the transcript, change any headline, swap an image, retime a card to a different word, switch the style — then render again. Every version is saved so you can undo.",
    },
    {
      q: "Can I use the reels commercially?",
      a: "Yes. You own what you render. Fonts are open-licensed (OFL) and sound effects are generated, so there is nothing to clear.",
    },
    {
      q: "What about image rights?",
      a: "You upload your own photos and confirm you have the rights. Rasika never pulls celebrity photos or film stills from the web. The optional image finder uses openly licensed sources only, with attribution stored.",
    },
  ],
};

export const finalCta = {
  title: brand.tagline,
  sub: "Your first reel is free. No card needed.",
  cta: { label: "Get started", href: "/dashboard" },
};

export const footer = {
  columns: [
    {
      title: "Product",
      links: [
        { label: "How it works", href: "#how-it-works" },
        { label: "Styles", href: "#styles" },
        { label: "Pricing", href: "#pricing" },
        { label: "FAQ", href: "#faq" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "Contact", href: `mailto:${brand.email}` },
        { label: "Instagram", href: brand.social.instagram },
        { label: "X", href: brand.social.x },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Terms", href: "/terms" },
        { label: "Privacy", href: "/privacy" },
      ],
    },
  ],
  madeIn: brand.madeIn,
};

export const seo = {
  title: `${brand.name} — Your reel, edited like a studio did it`,
  description: brand.description,
  keywords: [
    "reel editor",
    "AI video editor",
    "motion graphics for reels",
    "Instagram reel captions",
    "Hindi captions",
    "talking head video editor",
  ],
};
