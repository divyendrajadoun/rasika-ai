# Rasika worker — Playwright Chromium + ffmpeg + faster-whisper (GPU when passed through, CPU otherwise).
# Build from the repo root:  docker build -f apps/worker/Dockerfile .

# ── stage 1: build the engine harness bundle (dist/rasika-engine.js) ──
FROM node:22-bookworm-slim AS engine
RUN corepack enable && corepack prepare pnpm@10.3.0 --activate
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs ./
COPY packages/schema packages/schema
COPY packages/engine packages/engine
RUN pnpm install --frozen-lockfile --filter @rasika/engine... \
 && pnpm --filter @rasika/engine build
# researched explainer reels are drawn with HyperFrames (Apache-2.0); pinned, with GSAP vendored so a
# render never fetches a script from the network
RUN npm install --no-audit --no-fund --prefix /opt/hyperframes hyperframes@0.8.206 gsap@3.14.2

# ── stage 2: the worker ──
FROM mcr.microsoft.com/playwright/python:v1.63.0-noble

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    WORKER_WORK_DIR=/work \
    ENGINE_DIR=/app/engine \
    FONTS_DIR=/app/fonts \
    WHISPER_CACHE_DIR=/models

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg fonts-noto-core \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Fonts shipped with the engine are needed by headless Chromium for stills/renders
COPY packages/engine/fonts /app/fonts
# Engine harness: bundle + page (the worker points Chromium at /app/engine/index.html)
COPY --from=engine /repo/packages/engine/dist/rasika-engine.js /app/engine/dist/rasika-engine.js
COPY packages/engine/harness/index.html /app/engine/harness/index.html
# HyperFrames: Node from the build stage, the CLI and GSAP, and the image's own Chromium for capture
COPY --from=engine /usr/local/bin/node /usr/local/bin/node
COPY --from=engine /opt/hyperframes /opt/hyperframes
# its own chrome-headless-shell (fetched once, at build): frame capture by BeginFrame, much faster
RUN HYPERFRAMES_NO_TELEMETRY=1 node /opt/hyperframes/node_modules/hyperframes/bin/hyperframes.mjs browser ensure
ENV HYPERFRAMES_CLI="node /opt/hyperframes/node_modules/hyperframes/bin/hyperframes.mjs"     HYPERFRAMES_GSAP=/opt/hyperframes/node_modules/gsap/dist/gsap.min.js     HYPERFRAMES_NO_TELEMETRY=1     HYPERFRAMES_NO_UPDATE_CHECK=1     DO_NOT_TRACK=1

COPY apps/worker/pyproject.toml /app/pyproject.toml
COPY apps/worker/rasika_worker /app/rasika_worker
COPY apps/worker/prompts /app/prompts
# Planner inputs: the Plan JSON Schema, style presets, the few-shot plan and the craft guide
COPY packages/schema/plan.schema.json /app/schema/plan.schema.json
COPY packages/schema/presets /app/presets
COPY plans/baisa_bling.json plans/baisa_bling.words.json /app/plans/
COPY reference/mikku/references/style-guide.md /app/prompts/style-guide.md
RUN pip install --no-cache-dir -e ".[ml]" \
 && pip install --no-cache-dir "nvidia-cublas-cu12" "nvidia-cudnn-cu12==9.*" \
 && mkdir -p /work /models
# CUDA runtime libraries for faster-whisper on a GPU host (docker compose passes the GPU through);
# without a GPU the worker falls back to CPU int8 automatically.
ENV LD_LIBRARY_PATH=/usr/local/lib/python3.12/dist-packages/nvidia/cublas/lib:/usr/local/lib/python3.12/dist-packages/nvidia/cudnn/lib:/usr/local/lib/python3.12/dist-packages/nvidia/cuda_nvrtc/lib

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -m rasika_worker.main --healthcheck || exit 1

CMD ["python", "-m", "rasika_worker.main"]
