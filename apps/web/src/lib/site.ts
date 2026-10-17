/** Public site URL, from env (SITE_URL / NEXT_PUBLIC_SITE_URL / VERCEL_URL) with a local fallback. */
export const siteUrl: string = (() => {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
})();
