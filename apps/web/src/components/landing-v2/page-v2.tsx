import { Instrument_Serif } from "next/font/google";
import { brand } from "@/config/brand";
import { paidPacks } from "@/config/pricing";
import { seo } from "@/content/landing";
import { env } from "@/lib/env";
import { siteUrl } from "@/lib/site";
import { Edit } from "./edit";
import { Examples } from "./examples";
import { Faq } from "./faq";
import { Footer } from "./footer";
import { Hero } from "./hero";
import { How } from "./how";
import { Nav } from "./nav";
import { Pricing } from "./pricing";
import { Reveal } from "./reveal";
import { Start } from "./start";
import "./v2.css";

/** The accent face: one or two italic words per heading, and the prices. */
const serif = Instrument_Serif({
  weight: "400",
  style: "italic",
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

/**
 * Landing v2, "the cut room" (docs/landing-v2-spec.md): cinema sections in near-black carry the
 * footage, ivory sheets that follow the site theme carry the reading. Every link, form and query of
 * v1 is kept; only the presentation changed.
 */
export function LandingV2() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: brand.name,
    description: seo.description,
    url: siteUrl,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    inLanguage: ["en", "hi"],
    offers: paidPacks.map((p) => ({
      "@type": "Offer",
      name: `Rasika · ${p.name}`,
      price: p.inr,
      priceCurrency: "INR",
    })),
  };

  return (
    <div className={`v2 ${serif.variable}`}>
      <Nav />
      <main id="main">
        <Hero />
        {process.env.NEXT_PUBLIC_SHOW_HOW !== "0" && <How />}
        <Edit />
        <Examples />
        <Pricing />
        <Faq />
        <Start presenterEnabled={env.presenterEnabled} />
      </main>
      <Footer />
      <Reveal />
      <div className="v2-grain" aria-hidden />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
