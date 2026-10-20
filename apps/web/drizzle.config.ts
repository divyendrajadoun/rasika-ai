import { defineConfig } from "drizzle-kit";

// tools/cloud/setup.py points DATABASE_URL at Supabase; the local .env must not replace it
if (!process.env.RASIKA_CLOUD_BUILD) {
  try {
    process.loadEnvFile("../../.env");
  } catch {
    /* CI / prod: env comes from the environment */
  }
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://rasika:rasika@localhost:5432/rasika",
  },
  strict: true,
  verbose: true,
});
