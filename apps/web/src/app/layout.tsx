import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { brand } from "@/config/brand";
import { seo } from "@/content/landing";
import { siteUrl } from "@/lib/site";

const inter = localFont({
  src: [
    { path: "../fonts/Inter-400.woff2", weight: "400" },
    { path: "../fonts/Inter-600.woff2", weight: "600" },
    { path: "../fonts/Inter-800.woff2", weight: "800" },
  ],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});
const anton = localFont({
  src: "../fonts/Anton.woff2",
  variable: "--font-anton",
  display: "swap",
  weight: "400",
  preload: true,
});
const serif = localFont({
  src: "../fonts/InstrumentSerif-Italic.woff2",
  variable: "--font-serif",
  display: "swap",
  weight: "400",
  style: "italic",
  preload: true,
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
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: brand.colors.stage },
    { media: "(prefers-color-scheme: light)", color: brand.colors.ivory },
  ],
  width: "device-width",
  initialScale: 1,
};

/** Runs before paint so the chosen theme never flashes. Default: dark (maroon). */
const themeScript = `(function(){try{var t=localStorage.getItem('rasika-theme');if(t!=='light'&&t!=='dark'){t='dark'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${anton.variable} ${serif.variable} ${tiro.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="focus:bg-gold focus:text-ink sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
