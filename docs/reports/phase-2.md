# Phase 2 report — Auth, dashboard shell, uploads (2026-10-18)

## Built

- **Supabase Auth** (`@supabase/ssr`): magic link via email OTP, plus email + password sign-in /
  sign-up as a second option, `/auth/callback` for PKCE codes and token hashes, session refresh and
  `/dashboard` gating in `middleware.ts`. The Phase 1 mock cookie is gone.
- **Database** (Drizzle + postgres.js): all SPEC §11 tables (`profiles`, `brand_kits`, `projects`,
  `assets`, `transcripts`, `edit_plans`, `jobs`, `credit_ledger`, `payments`, `audit_log`), migration
  `drizzle/0000_*.sql`, and `drizzle/0001_rls.sql` with row-level-security policies keyed on
  `auth.uid()` that apply automatically when the database is Supabase (no-op on plain Postgres,
  where the server code enforces ownership). `pnpm --filter web db:migrate`.
- **Resumable multipart uploads** straight from the browser to S3 (presigned part URLs, 8 MiB parts,
  3 in flight, per-part retry with backoff). Sessions persist in `localStorage`; on reload the
  client asks S3 which parts exist and continues. Completion is verified server-side against S3's
  own part list and total byte count. Client-side probe reads duration/size and grabs a first-frame
  thumbnail (uploaded as a `thumbnail` asset).
- **Dashboard**: project grid with thumbnail, live status pill (SSE), duration, style, date and
  open / duplicate / download / delete; the illustrated empty state; project page with a progress
  view (stage list + %), assets, brand summary, export slot.
- **4-step wizard** (`/dashboard/new`): drag-drop reel upload with pause/resume; up to 15 photos
  with label + "show when I say…", a crop dialog (react-easy-crop) with **auto-trim screenshot UI**
  (edge-band detection, unit-tested); preset cards + free-text style box + captions / SFX / music /
  language controls; brand & ending; consent checkbox; credit cost shown before "Create my edit".
- **Job hand-off**: creating an edit writes the project, photo metadata, a `jobs` row and an audit
  entry in one transaction, then pushes `probe` onto Redis. The worker now **persists progress to
  Postgres** (`jobs` + `projects.status`), which the dashboard streams via
  `/api/projects/[id]/events`.

## Acceptance (scripted with Playwright on a 390 px viewport)

| Check                                                      | Result |
| ---------------------------------------------------------- | ------ |
| Sign in (password), land on `/dashboard/new`               | ✅     |
| Upload a 102 MB HEVC phone video with progress             | ✅ 13 parts, ~28 MB/s locally |
| Reload mid-upload (at 24 %), pick the same file → resumes  | ✅ resumed at 55 %, no re-upload of done parts |
| Add a photo, label it, crop with auto-trim                 | ✅     |
| Choose Katana Pop + free-text style, brand, consent        | ✅     |
| "Create my edit" shows cost (2 credits for 90 s) and creates the project | ✅ |
| Project page streams worker progress to **Done**           | ✅     |
| Project appears in the grid with thumbnail and status pill | ✅     |
| Web: lint · typecheck · 12 tests · build; worker: ruff · mypy · 7 tests | ✅ |

The spec's "300 MB from a phone over a network drop" was approximated with the 102 MB raw take and a
page reload; the retry path (6 attempts with backoff per part) covers transient drops.

## Mocked / deferred

- Worker handler is still the Phase 0 `noop`: it reports "Upload received…" and ends at `done`.
  Real probe/transcribe/render land in Phase 4; the project page says so.
- Credits are displayed and checked, not deducted (Phase 7).
- Google sign-in is wired to Supabase but not enabled in the project (needs a Google OAuth client).
- Email arrives in Phase 8; the progress view says the dashboard updates live meanwhile.

## Decisions to review

1. **Local Postgres for data, Supabase for auth.** Per your "working prototype first": `DATABASE_URL`
   points at the docker-compose Postgres. Switching to Supabase's Postgres later is a connection
   string change plus `db:migrate` (the RLS migration then activates).
2. **Password sign-in added** next to magic links because Supabase's built-in mailer allows only a
   few emails per hour, which would block testing. If you want magic-link only, delete the two
   password actions.
3. **Plain Redis list instead of BullMQ.** BullMQ's job format can't be consumed by a Python worker
   without re-implementing its Lua protocol, so the documented JSON list protocol stays.
4. **AWS SDK checksums disabled** (`requestChecksumCalculation: WHEN_REQUIRED`): the SDK's default
   CRC32 flexible checksums make RustFS/MinIO/R2 reject presigned part uploads with `BadDigest`.
5. Free plan allows 60 s per the spec, so the 90 s test reel needed the Creator plan; the test user
   `tester@rasika.local` is on Creator with 10 credits.

## Next

Phase 3: `packages/schema` full Plan JSON + JSON Schema export, the engine with all element types
and video modes, the hand-written `baisa_bling.json`, and the `/dev/engine` player + golden SSIM test.
