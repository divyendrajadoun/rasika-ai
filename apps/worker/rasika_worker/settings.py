"""Typed settings loaded from the environment (see /.env.example for every key)."""

from __future__ import annotations

import os
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_HERE = Path(__file__).resolve().parent
# apps/worker/rasika_worker → repo root when run from the checkout; in the image there is no repo
_REPO = _HERE.parents[2] if len(_HERE.parents) > 2 else _HERE.parent


def _first_existing(*candidates: Path) -> Path:
    for c in candidates:
        if c.exists():
            return c
    return candidates[0]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    redis_url: str = Field(default="redis://localhost:6379", alias="REDIS_URL")
    job_queue: str = Field(default="rasika:jobs", alias="JOB_QUEUE")
    database_url: str = Field(
        default="postgresql://rasika:rasika@localhost:5432/rasika", alias="DATABASE_URL"
    )

    s3_endpoint: str = Field(default="http://localhost:9000", alias="S3_ENDPOINT")
    s3_region: str = Field(default="auto", alias="S3_REGION")
    s3_bucket: str = Field(default="rasika", alias="S3_BUCKET")
    s3_access_key_id: str = Field(default="rasika", alias="S3_ACCESS_KEY_ID")
    s3_secret_access_key: str = Field(default="rasika-secret", alias="S3_SECRET_ACCESS_KEY")
    s3_force_path_style: bool = Field(default=True, alias="S3_FORCE_PATH_STYLE")

    work_dir: Path = Field(default=Path("./work"), alias="WORKER_WORK_DIR")
    render_parallelism: int | None = Field(default=None, alias="WORKER_RENDER_PARALLELISM")
    job_ttl_sec: int = Field(default=3600, alias="WORKER_JOB_TTL_SEC")
    # Where the built engine harness lives (dist/rasika-engine.js + harness/index.html)
    engine_dir: Path = Field(
        default=_first_existing(_REPO / "packages" / "engine", Path("/app/engine")),
        alias="ENGINE_DIR",
    )
    fonts_dir: Path = Field(
        default=_first_existing(_REPO / "packages" / "engine" / "fonts", Path("/app/fonts")),
        alias="FONTS_DIR",
    )
    ffmpeg_bin: str = Field(default="ffmpeg", alias="FFMPEG_BIN")
    ffprobe_bin: str = Field(default="ffprobe", alias="FFPROBE_BIN")

    whisper_model: str = Field(default="large-v3", alias="WHISPER_MODEL")
    whisper_device: str = Field(default="cpu", alias="WHISPER_DEVICE")
    whisper_compute_type: str = Field(default="int8", alias="WHISPER_COMPUTE_TYPE")
    whisper_cache_dir: Path | None = Field(default=None, alias="WHISPER_CACHE_DIR")
    # "faster-whisper" (default, local) or "hosted" (adapter stub, see transcribe.py)
    transcriber: str = Field(default="faster-whisper", alias="TRANSCRIBER")

    # Optional licensed music bed (wav/mp3). Mixed only when the project asked for music and
    # ENABLE_MUSIC_BED is on.
    music_bed_path: Path | None = Field(default=None, alias="MUSIC_BED_PATH")
    enable_music_bed: bool = Field(default=False, alias="ENABLE_MUSIC_BED")

    log_level: str = Field(default="info", alias="LOG_LEVEL")
    sentry_dsn: str = Field(default="", alias="SENTRY_DSN")

    enable_cutout: bool = Field(default=False, alias="ENABLE_CUTOUT")

    @field_validator("render_parallelism", "whisper_cache_dir", "music_bed_path", mode="before")
    @classmethod
    def _blank_is_none(cls, v: object) -> object:
        """`.env` files often carry `KEY=` for unset values; treat blank as None."""
        return None if isinstance(v, str) and v.strip() == "" else v

    @property
    def effective_parallelism(self) -> int:
        return self.render_parallelism or max(1, os.cpu_count() or 1)

    @property
    def engine_bundle(self) -> Path:
        return self.engine_dir / "dist" / "rasika-engine.js"

    @property
    def engine_harness_html(self) -> Path:
        return _first_existing(
            self.engine_dir / "harness" / "index.html", self.engine_dir / "index.html"
        )


def get_settings() -> Settings:
    return Settings()
