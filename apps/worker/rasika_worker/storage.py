"""S3-compatible object storage (RustFS locally, Cloudflare R2 in production)."""

from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import Any

import boto3
import structlog
from botocore.config import Config

from rasika_worker.settings import Settings

log = structlog.get_logger("rasika.worker.storage")


class Storage:
    def __init__(self, settings: Settings) -> None:
        self.bucket = settings.s3_bucket
        self._client: Any = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
            config=Config(
                s3={"addressing_style": "path" if settings.s3_force_path_style else "virtual"},
                # RustFS / R2 reject the SDK's default CRC32 flexible checksums (same as the web)
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
                retries={"max_attempts": 4, "mode": "standard"},
            ),
        )

    def download(self, key: str, dest: Path) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        self._client.download_file(self.bucket, key, str(dest))
        log.info("downloaded", key=key, bytes=dest.stat().st_size)
        return dest

    def upload(self, src: Path, key: str, content_type: str | None = None) -> int:
        ct = content_type or mimetypes.guess_type(src.name)[0] or "application/octet-stream"
        self._client.upload_file(str(src), self.bucket, key, ExtraArgs={"ContentType": ct})
        size = src.stat().st_size
        log.info("uploaded", key=key, bytes=size)
        return size

    def delete(self, key: str) -> None:
        self._client.delete_object(Bucket=self.bucket, Key=key)

    def delete_prefix(self, prefix: str) -> int:
        n = 0
        paginator = self._client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            keys = [{"Key": o["Key"]} for o in page.get("Contents", [])]
            if keys:
                self._client.delete_objects(Bucket=self.bucket, Delete={"Objects": keys})
                n += len(keys)
        return n

    def exists(self, key: str) -> bool:
        try:
            self._client.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False


def project_prefix(user_id: str, project_id: str) -> str:
    return f"u/{user_id}/p/{project_id}"
