import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { Nav } from "@/components/landing/nav";
import { LiquidGlass } from "@/components/motion/liquid-glass";
import { Pricing } from "@/components/landing/pricing";
import { StyleShowcase } from "@/components/landing/style-showcase";
import { brand } from "@/config/brand";
import { paidPacks } from "@/config/pricing";
import { seo } from "@/content/landing";
import { env } from "@/lib/env";
import { siteUrl } from "@/lib/site";

/**
 * The landing page, in the order of its argument: the sentence set live (hero), a line you can type
 * (showcase), call and response (how it works), the real before/after with notes (features), the
 * 94 renders (styles), the plans table, the questions, the first step already open, one quiet line.
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
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Features />
        <StyleShowcase />
        <Pricing />
        <Faq />
        <FinalCta presenterEnabled={env.presenterEnabled} />
      </main>
      <Footer />
      <LiquidGlass />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
