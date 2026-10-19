import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { brand } from "@/config/brand";
import { seo } from "@/content/landing";
import { siteUrl } from "@/lib/site";

/** The page face (direction sheet: Switzer, 600 for headings, 400/500 for text). */
const switzer = localFont({
  src: [
    { path: "../fonts/Switzer-400.woff2", weight: "400" },
    { path: "../fonts/Switzer-500.woff2", weight: "500" },
    { path: "../fonts/Switzer-600.woff2", weight: "600" },
  ],
  variable: "--font-switzer",
  display: "swap",
  preload: true,
});
/* The reel's own faces: only inside [data-ui] fragments and the dev engine page. */
const reelText = localFont({
  src: [
    { path: "../fonts/Inter-400.woff2", weight: "400" },
    { path: "../fonts/Inter-600.woff2", weight: "600" },
    { path: "../fonts/Inter-800.woff2", weight: "800" },
  ],
  variable: "--font-inter",
  display: "swap",
  preload: false,
});
const anton = localFont({
  src: "../fonts/Anton.woff2",
  variable: "--font-anton",
  display: "swap",
  weight: "400",
  preload: false,
});
const tiro = localFont({
  src: "../fonts/TiroDevanagariHindi.woff2",
  variable: "--font-tiro",
  display: "swap",
  weight: "400",
  preload: false,
  // only fetched when Devanagari text is on the page
  declarations: [{ prop: "unicode-range", value: "U+0900-097F, U+A8E0-A8FF" }],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: seo.title, template: `%s · ${brand.name}` },
  description: seo.description,
  keywords: [...seo.keywords],
  applicationName: brand.name,
  authors: [{ name: brand.name, url: siteUrl }],
  creator: brand.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: brand.name,
    title: seo.title,
    description: seo.description,
    url: "/",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: seo.title,
    description: seo.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: brand.colors.stage,
  width: "device-width",
  initialScale: 1,
};

/**
 * Runs before paint so the chosen theme never flashes. The site is light (bone) by default and the
 * app screens under /dashboard are dark by default; a saved choice wins on both. Also marks the
 * document `js` so motion start states apply only when scripts run.
 */
const themeScript = `(function(){var d=document.documentElement;d.classList.add('js');try{var t=localStorage.getItem('rasika-theme');if(t!=='light'&&t!=='dark'){t=location.pathname.indexOf('/dashboard')===0?'dark':'light'}d.setAttribute('data-theme',t)}catch(e){d.setAttribute('data-theme','light')}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${switzer.variable} ${reelText.variable} ${anton.variable} ${tiro.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="focus:bg-accent focus:text-accent-ink sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
