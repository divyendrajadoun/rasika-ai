import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

declare global {
  var __rasikaSql: ReturnType<typeof postgres> | undefined;
}

/** One connection pool per process (survives Next dev HMR). */
const sql = globalThis.__rasikaSql ?? postgres(env.databaseUrl, {
  // serverless (Netlify) runs many small instances against the Supabase pooler: keep each pool small
  max: Number(process.env.DB_POOL_MAX ?? 10),
  prepare: false,
});
if (process.env.NODE_ENV !== "production") globalThis.__rasikaSql = sql;

export const db = drizzle(sql, { schema });
export type Db = typeof db;
export { schema };
