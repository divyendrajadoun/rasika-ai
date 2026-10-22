#!/usr/bin/env sh
# Build and deploy the website to Netlify (see DEPLOY.md). The build runs in a Linux container:
# Netlify's Next.js runtime packs the server function for Linux, and built on Windows it ships
# backslash paths and no node_modules (every page 502s). Needs Docker and a logged-in Netlify CLI.
set -e
cd "$(dirname "$0")/../.."
SITE=44bc9a34-2b80-4436-8d86-03cfbc35da57
TAR="${TMPDIR:-${TEMP:-/tmp}}/rasika-web-src.tar"
# the working tree as git sees it (tracked + new files; ignored files such as .env stay out)
git ls-files -co --exclude-standard -z | tar --force-local --null -T - -cf "$TAR"
TOKEN=$(node -e "const c=require(process.env.APPDATA+'/netlify/Config/config.json');const u=c.users[c.userId];process.stdout.write(u.auth.token)")
MSYS_NO_PATHCONV=1 docker run --rm -e NETLIFY_AUTH_TOKEN="$TOKEN" -e CI=1 \
  -v "$TAR:/src.tar:ro" -v rasika-pnpm-store:/pnpm-store \
  node:20-bookworm sh -ec "
    mkdir /app && cd /app && tar -xf /src.tar
    corepack enable >/dev/null && pnpm config set store-dir /pnpm-store >/dev/null
    pnpm install --frozen-lockfile --reporter=silent
    npx -y netlify-cli deploy --prod --filter web --site $SITE
  "
