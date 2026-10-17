import "server-only";
import Redis from "ioredis";
import { env } from "@/lib/env";
import type { JobType } from "@/db/schema";

declare global {
  var __rasikaRedis: Redis | undefined;
}

function redis(): Redis {
  globalThis.__rasikaRedis ??= new Redis(env.redisUrl, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
  });
  return globalThis.__rasikaRedis;
}

/** Message shape shared with apps/worker/rasika_worker/protocol.py (docs/job-protocol.md). */
export interface JobMessage {
  v: 1;
  job_id: string;
  project_id: string;
  user_id: string;
  type: JobType;
  attempt: number;
  payload: Record<string, unknown>;
  enqueued_at: string;
}

export async function enqueueJob(
  msg: Omit<JobMessage, "v" | "enqueued_at" | "attempt"> & { attempt?: number },
) {
  const full: JobMessage = { v: 1, attempt: 1, enqueued_at: new Date().toISOString(), ...msg };
  await redis().lpush(env.jobQueue, JSON.stringify(full));
  return full;
}
