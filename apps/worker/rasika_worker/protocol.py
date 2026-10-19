"""Job protocol between the Next.js producer (BullMQ) and this worker.

The canonical description lives in docs/job-protocol.md. These models are the
single source of truth on the Python side; keep them in sync with
apps/web/src/lib/jobs/protocol.ts.
"""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Final, Literal

from pydantic import BaseModel, Field

PROTOCOL_VERSION: Final[Literal[1]] = 1


class JobType(StrEnum):
    # script-only reels: narrate the script and build the stage clip, then the normal chain
    SYNTH = "synth"
    # AI presenter: HeyGen renders script + photo / stock look into the source clip, then probe
    PRESENTER = "presenter"
    PROBE = "probe"
    # reference matching: measure the reference reel, write a matched style, then PLAN
    ANALYSE_REFERENCE = "analyse_reference"
    TRANSCRIBE = "transcribe"
    PLAN = "plan"
    RENDER_PREVIEW = "render_preview"
    RENDER_FINAL = "render_final"
    CLEANUP = "cleanup"


class JobStatus(StrEnum):
    """Mirrors `edit_jobs.status` in the spec (Section 7)."""

    UPLOADED = "uploaded"
    PROBING = "probing"
    TRANSCRIBING = "transcribing"
    AWAITING_TRANSCRIPT_REVIEW = "awaiting_transcript_review"
    PLANNING = "planning"
    AWAITING_PLAN_REVIEW = "awaiting_plan_review"
    RENDERING_PREVIEW = "rendering_preview"
    READY_PREVIEW = "ready_preview"
    RENDERING_FINAL = "rendering_final"
    DONE = "done"
    FAILED = "failed"
    CANCELED = "canceled"


class JobMessage(BaseModel):
    """What the web app pushes onto the Redis list `JOB_QUEUE`."""

    v: Literal[1] = PROTOCOL_VERSION
    job_id: str = Field(min_length=1)
    project_id: str = Field(min_length=1)
    user_id: str = Field(min_length=1)
    type: JobType
    attempt: int = Field(default=1, ge=1)
    payload: dict[str, object] = Field(default_factory=dict)
    enqueued_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ProgressUpdate(BaseModel):
    """What the worker publishes on the Redis channel `rasika:progress:<job_id>`
    and persists to Postgres (`jobs.progress`, `jobs.message`)."""

    v: Literal[1] = PROTOCOL_VERSION
    job_id: str
    status: JobStatus
    progress: int = Field(ge=0, le=100)
    message: str = ""
    timings: dict[str, float] = Field(default_factory=dict)
    error: str | None = None
    at: datetime = Field(default_factory=lambda: datetime.now(UTC))


# Friendly stage copy shown in the dashboard progress view (Section 10)
STAGE_MESSAGES: dict[JobStatus, str] = {
    JobStatus.PROBING: "Looking at your video…",
    JobStatus.TRANSCRIBING: "Timing every word…",
    JobStatus.AWAITING_TRANSCRIPT_REVIEW: "Transcript ready for your review",
    JobStatus.PLANNING: "Designing your edit…",
    JobStatus.AWAITING_PLAN_REVIEW: "Your edit is ready to preview",
    JobStatus.RENDERING_PREVIEW: "Making a quick preview…",
    JobStatus.READY_PREVIEW: "Preview ready",
    JobStatus.RENDERING_FINAL: "Rendering in full quality…",
    JobStatus.DONE: "Your reel is ready",
    JobStatus.FAILED: "Something went wrong",
    JobStatus.CANCELED: "Canceled",
}
