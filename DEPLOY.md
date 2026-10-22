# Deploying Rasika

| Piece | Where | Notes |
|---|---|---|
| Website (Next.js) | Netlify — https://rasika-ai.netlify.app | `apps/web`, Next.js runtime plugin; env set on the site |
| Database + auth | Supabase (Sydney, `ap-southeast-2`) | website: transaction pooler :6543; worker + migrations: session pooler :5432 |
| File storage | Supabase Storage via S3, private bucket `rasika` | every read/write is a signed URL |
| Job queue | Upstash Redis `rasika-queue` (Sydney, free) | worker waits 30 s per BLPOP to keep command counts low |
| Worker (renders) | this PC, Docker + GPU | pulls jobs; needs no open ports. **Reels only render while the PC is on.** |

## Secrets

All gitignored, never committed:

- `.env.cloud`: the cloud values (database password, pooler URIs, S3 keys, Upstash URL).
- `.env.netlify` and `.env.worker-cloud`: written from `.env` + `.env.cloud` by `tools/cloud/setup.py`.

## Set up or refresh

```sh
apps/worker/.venv/Scripts/python.exe tools/cloud/setup.py https://rasika-ai.netlify.app
```

This writes both env files, creates and tests the bucket, runs the migrations, applies the RLS policies (`0001_rls.sql`, which is not in the drizzle journal) and pings Upstash.

## Deploy the website

Every push to `main` on GitHub (private repo `divyendrajadoun/rasika-ai`) builds and deploys it:
`.github/workflows/deploy-web.yml`, on Linux, with the `NETLIFY_AUTH_TOKEN` repo secret. To deploy
without a code change, run that workflow by hand (Actions tab, or `gh workflow run deploy-web.yml`).

When keys change, push them to the site, then redeploy:

```sh
npx netlify-cli env:import .env.netlify --filter web
```

Do not build it on Windows: Netlify's Next.js runtime then ships backslash paths and no
`node_modules`, and every page 502s. `tools/cloud/deploy-web.sh` builds in a Linux container
instead (Docker), if GitHub is not an option. Deploy from the repo root with `--filter web`:
from `apps/web` the CLI doubles the package path and the server function never uploads.

## Run the worker

```sh
docker compose -f docker-compose.cloud.yml -p rasika-cloud up -d --build
docker logs -f rasika-cloud-worker-1
```

## After rotating a key

1. Update `.env` or `.env.cloud`.
2. Re-run `setup.py`.
3. `env:import`, then redeploy.
4. Restart the worker with the `up -d` command above.

## Supabase Auth

Under Authentication → URL Configuration:

- Site URL: `https://rasika-ai.netlify.app`
- Redirect URLs: `https://rasika-ai.netlify.app/**` and `http://localhost:3000/**`

## Limits to know

- Netlify functions run in the US, so each database round trip to Sydney adds latency.
- Supabase free storage is 1 GB.
- Upstash free tier allows 500k commands a month.
