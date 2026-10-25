import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Nav } from "@/components/landing/nav";
import { Pricing } from "@/components/landing/pricing";
import { StyleShowcase } from "@/components/landing/style-showcase";
import { Tilt } from "@/components/landing/tilt";
import "@/components/landing/landing.css";
import { brand } from "@/config/brand";
import { paidPacks } from "@/config/pricing";
import { seo } from "@/content/landing";
import { env } from "@/lib/env";
import { siteUrl } from "@/lib/site";

/**
 * The landing page (design handoff "Rasika redesign"): the hero (A/B: styles coverflow or orbit),
 * How it works in six phone screens, the real before/after with notes, the examples, the plans,
 * the questions, the first step already open, one quiet line. Set `NEXT_PUBLIC_SHOW_HOW=0` to hide
 * How it works.
 */
export default function LandingPage() {
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
    <div className="lp">
      <Nav />
      <main id="main">
        <Hero />
        {process.env.NEXT_PUBLIC_SHOW_HOW !== "0" && <HowItWorks />}
        <Features />
        <StyleShowcase />
        <Pricing />
        <Faq />
        <FinalCta presenterEnabled={env.presenterEnabled} />
      </main>
      <Footer />
      <Tilt />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
