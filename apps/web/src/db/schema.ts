/**
 * Drizzle schema — SPEC §11. `user_id` columns hold the Supabase Auth user id (auth.users.id).
 * Row-level security policies live in drizzle/0001_rls.sql and apply on Supabase Postgres;
 * on plain Postgres (docker compose) ownership is enforced in the server code instead.
 */
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const ts = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const tsUpdated = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const PROJECT_STATUSES = [
  "draft",
  "uploaded",
  "probing",
  "transcribing",
  "awaiting_transcript_review",
  "planning",
  "awaiting_plan_review",
  "rendering_preview",
  "ready_preview",
  "rendering_final",
  "done",
  "failed",
  "canceled",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const ASSET_KINDS = [
  "source_video",
  "reference_video",
  "presenter_image",
  "image",
  "proxy",
  "frame_bundle",
  "output_1080",
  "output_720",
  "preview_540",
  "keyframe",
  "thumbnail",
  "logo",
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const JOB_TYPES = [
  "synth",
  "compose",
  "presenter",
  "probe",
  "analyse_reference",
  "transcribe",
  "plan",
  "render_preview",
  "render_final",
  "cleanup",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(),
  email: text("email").notNull(),
  plan: text("plan").notNull().default("free"),
  credits: integer("credits").notNull().default(1),
  locale: text("locale").notNull().default("en"),
  createdAt: ts(),
  updatedAt: tsUpdated(),
});

export const brandKits = pgTable(
  "brand_kits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    handle: text("handle"),
    logoAssetId: uuid("logo_asset_id"),
    colors: jsonb("colors").$type<Record<string, string>>().notNull().default({}),
    fonts: jsonb("fonts").$type<Record<string, string>>().notNull().default({}),
    endCard: jsonb("end_card").$type<Record<string, string>>().notNull().default({}),
    createdAt: ts(),
  },
  (t) => [index("brand_kits_user_idx").on(t.userId)],
);

export interface StyleOptions {
  captions: boolean;
  sfxIntensity: number; // 0..1
  music: boolean;
  language: "auto" | "en" | "hi" | "hinglish";
  /** where the reel came from (default "take": an uploaded clip) */
  source?: "take" | "script" | "reference" | "presenter" | "brief";
  /** films made from a brief: the kind of film and the user's inputs (config/briefs.ts) */
  brief?: {
    kind: string;
    url?: string;
    recipe?: string;
    subject?: string;
    a?: string;
    b?: string;
    winner?: string;
    line?: string;
    end?: string;
    narrate?: boolean;
    voice?: string;
  };
  /** written by the worker's compose step: the film's script and data */
  film?: Record<string, unknown>;
  unspokenWords?: Array<Record<string, unknown>> | null;
  musicBed?: Record<string, unknown> | null;
  /** AI presenter: HeyGen voice id and the stock look (or none when a photo was uploaded) */
  presenterVoice?: string;
  presenterLook?: string | null;
  /** script-only reels: no speaker on screen, the planner fills the whole stage */
  faceless?: boolean;
  /** script-only reels: the narration voice id (Deepgram Aura) */
  voice?: string;
  /** stock B-roll from Pexels cut into the reel (needs PEXELS_API_KEY on the worker) */
  broll?: boolean;
  /** recorded takes: cut fillers, repeats and long pauses first (worker cleancut.py) */
  cleanCut?: boolean;
  /** recorded takes: the strongest line moves to the first two seconds (worker cleancut.pick_hook) */
  hookFirst?: boolean;
  /** after transcription, AI draws pictures for the key moments (worker imagegen.py, Higgsfield) */
  aiImages?: boolean;
  aiImageCount?: number;
  aiImageStyle?: string;
  /** reference matching: how much of the reference to honour */
  fidelity?: "pace" | "camera" | "look";
  /** reference matching: the style the worker wrote from the reference (StyleTokens) */
  referenceStyle?: Record<string, unknown>;
  referenceReport?: Record<string, unknown>;
}
export interface BrandInfo {
  name?: string;
  handle?: string;
  endLine?: string;
  cta?: string;
}

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    title: text("title").notNull(),
    status: text("status").$type<ProjectStatus>().notNull().default("draft"),
    stylePreset: text("style_preset").notNull().default("mikku-royal"),
    styleText: text("style_text"),
    styleOptions: jsonb("style_options")
      .$type<StyleOptions>()
      .notNull()
      .default({ captions: true, sfxIntensity: 0.6, music: false, language: "auto" }),
    brand: jsonb("brand").$type<BrandInfo>().notNull().default({}),
    durationSec: real("duration_sec"),
    creditsCost: integer("credits_cost").notNull().default(1),
    thumbnailAssetId: uuid("thumbnail_asset_id"),
    createdAt: ts(),
    updatedAt: tsUpdated(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("projects_user_idx").on(t.userId, t.createdAt)],
);

export interface AssetMeta {
  label?: string;
  /** "ai": drawn by the image service (prompt + request kept for the record), "site": a website capture */
  source?: string;
  prompt?: string;
  requestId?: string;
  sayWhen?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  fps?: number;
  codec?: string;
  crop?: { x: number; y: number; w: number; h: number };
  order?: number;
  rotation?: number;
  autoCrop?: boolean;
  /** keyframes: the source time of the still */
  t?: number;
  /** outputs: which edit plan version was rendered, and how many parallel chunks */
  planVersion?: number;
  chunks?: number;
}

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    kind: text("kind").$type<AssetKind>().notNull(),
    storageKey: text("storage_key").notNull(),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
    meta: jsonb("meta").$type<AssetMeta>().notNull().default({}),
    license: jsonb("license").$type<Record<string, string>>(),
    createdAt: ts(),
  },
  (t) => [index("assets_project_idx").on(t.projectId, t.kind)],
);

export const transcripts = pgTable(
  "transcripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    words: jsonb("words").$type<Array<{ w: string; t: number; end?: number }>>().notNull(),
    version: integer("version").notNull().default(1),
    createdAt: ts(),
  },
  (t) => [index("transcripts_project_idx").on(t.projectId, t.version)],
);

export const editPlans = pgTable(
  "edit_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    version: integer("version").notNull().default(1),
    plan: jsonb("plan").notNull(),
    validatorReport: jsonb("validator_report"),
    createdBy: text("created_by").$type<"llm" | "user">().notNull().default("llm"),
    createdAt: ts(),
  },
  (t) => [index("edit_plans_project_idx").on(t.projectId, t.version)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    type: text("type").$type<JobType>().notNull(),
    status: text("status").$type<ProjectStatus>().notNull().default("uploaded"),
    progress: integer("progress").notNull().default(0),
    message: text("message").notNull().default(""),
    timings: jsonb("timings").$type<Record<string, number>>().notNull().default({}),
    error: text("error"),
    attempt: integer("attempt").notNull().default(1),
    createdAt: ts(),
    updatedAt: tsUpdated(),
  },
  (t) => [index("jobs_project_idx").on(t.projectId, t.createdAt)],
);

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    jobId: uuid("job_id"),
    createdAt: ts(),
  },
  (t) => [index("credit_ledger_user_idx").on(t.userId, t.createdAt)],
);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  provider: text("provider").notNull(),
  providerRef: text("provider_ref"),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull().default("INR"),
  status: text("status").notNull().default("created"),
  raw: jsonb("raw"),
  createdAt: ts(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: ts(),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  assets: many(assets),
  jobs: many(jobs),
}));
export const assetsRelations = relations(assets, ({ one }) => ({
  project: one(projects, { fields: [assets.projectId], references: [projects.id] }),
}));
export const jobsRelations = relations(jobs, ({ one }) => ({
  project: one(projects, { fields: [jobs.projectId], references: [projects.id] }),
}));

/** `now()` helper for updates. */
export const now = sql`now()`;
