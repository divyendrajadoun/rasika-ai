import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { Showcase } from "@/components/landing/showcase";
import { StyleShowcase } from "@/components/landing/style-showcase";
import { brand } from "@/config/brand";
import { plans } from "@/config/pricing";
import { seo } from "@/content/landing";
import { env } from "@/lib/env";
import { siteUrl } from "@/lib/site";

/**
 * The landing page, in the order of its argument: the sentence set live (hero), a line you can type
 * (showcase), call and response (how it works), the real before/after with notes (features), the
 * 93 renders (styles), the plans table, the questions, the first step already open, one quiet line.
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
    offers: plans
      .filter((p) => p.price.INR !== null)
      .map((p) => ({
        "@type": "Offer",
        name: p.name,
        price: p.price.INR,
        priceCurrency: "INR",
        category: "subscription",
      })),
  };

  return (
    <>
      <main id="main">
        <Hero />
        <Showcase />
        <HowItWorks />
        <Features />
        <StyleShowcase />
        <Pricing />
        <Faq />
        <FinalCta presenterEnabled={env.presenterEnabled} />
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
