/**
 * Server-side env access. The repo keeps one `.env` at the root; `next.config.ts` and
 * `drizzle.config.ts` load it with `process.loadEnvFile`. Only call these from server code.
 */
import "server-only";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name} (see .env.example)`);
  return v;
}

export const env = {
  get siteUrl() {
    return (
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.SITE_URL ??
      "http://localhost:3000"
    ).replace(/\/$/, "");
  },
  get supabaseUrl() {
    return req("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return req("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get databaseUrl() {
    return req("DATABASE_URL");
  },
  get redisUrl() {
    return process.env.REDIS_URL ?? "redis://localhost:6379";
  },
  get jobQueue() {
    return process.env.JOB_QUEUE ?? "rasika:jobs";
  },
  s3: {
    get endpoint() {
      return req("S3_ENDPOINT");
    },
    get publicEndpoint() {
      return process.env.S3_PUBLIC_ENDPOINT ?? req("S3_ENDPOINT");
    },
    get region() {
      return process.env.S3_REGION ?? "auto";
    },
    get bucket() {
      return req("S3_BUCKET");
    },
    get accessKeyId() {
      return req("S3_ACCESS_KEY_ID");
    },
    get secretAccessKey() {
      return req("S3_SECRET_ACCESS_KEY");
    },
    get forcePathStyle() {
      return (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true";
    },
  },
  /** the worker can fetch stock B-roll (same .env as the web app in dev; set on both in prod) */
  get stockEnabled() {
    return Boolean(process.env.PEXELS_API_KEY);
  },
  get maxUploadBytes() {
    return Number(process.env.MAX_UPLOAD_MB ?? 600) * 1024 * 1024;
  },
  get maxImageBytes() {
    return Number(process.env.MAX_IMAGE_MB ?? 25) * 1024 * 1024;
  },
};
