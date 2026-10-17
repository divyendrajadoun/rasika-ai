# Rasika worker — Python 3.11 + Playwright Chromium + ffmpeg.
# Build from the repo root:  docker build -f apps/worker/Dockerfile .
FROM mcr.microsoft.com/playwright/python:v1.49.0-noble

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    WORKER_WORK_DIR=/work

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg fonts-noto-core \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Fonts shipped with the engine are needed by headless Chromium for stills/renders
COPY packages/engine/fonts /app/fonts

COPY apps/worker/pyproject.toml /app/pyproject.toml
COPY apps/worker/rasika_worker /app/rasika_worker
COPY apps/worker/prompts /app/prompts
RUN pip install --no-cache-dir -e . \
 && mkdir -p /work

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -m rasika_worker.main --healthcheck || exit 1

CMD ["python", "-m", "rasika_worker.main"]
