import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { BeforeAfter } from "@/components/landing/before-after";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Features } from "@/components/landing/features";
import { StyleShowcase } from "@/components/landing/style-showcase";
import { Industries } from "@/components/landing/industries";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";
import { brand } from "@/config/brand";
import { plans } from "@/config/pricing";
import { seo } from "@/content/landing";
import { siteUrl } from "@/lib/site";

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
      <Nav />
      <main id="main">
        <Hero />
        <Industries />
        <BeforeAfter />
        <HowItWorks />
        <Features />
        <StyleShowcase />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
