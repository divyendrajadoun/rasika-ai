"""Subject detection (SPEC §7.4): face box + free zone from the keyframes, so the planner never
guesses pixels. OpenCV Haar cascade (bundled XML); falls back to a centred default when no face
is found. All boxes are in 1080×1920 stage pixels."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import structlog

log = structlog.get_logger("rasika.worker.face")

CASCADE = Path(__file__).resolve().parent / "data" / "haarcascade_frontalface_default.xml"
STAGE_W, STAGE_H = 1080, 1920
DEFAULT_FACE = {"x": 330, "y": 620, "w": 420, "h": 520}


@dataclass
class Subject:
    face_box: dict[str, int]
    free_zone: dict[str, int]
    detections: int
    prop_point: dict[str, int] | None = None

    def as_plan_subject(self, prop_label: str | None = None) -> dict[str, Any]:
        out: dict[str, Any] = {"faceBox": self.face_box, "freeZone": self.free_zone}
        if self.prop_point:
            out["prop"] = {"label": prop_label or "prop", "point": self.prop_point}
        return out


def detect_faces(image_path: Path) -> list[tuple[int, int, int, int]]:
    """(x, y, w, h) in the image's own pixels."""
    try:
        import cv2
    except ImportError:  # pragma: no cover
        return []
    img = cv2.imread(str(image_path))
    if img is None:
        return []
    cascade = cv2.CascadeClassifier(str(CASCADE))
    if cascade.empty():
        return []
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    min_side = max(40, int(min(img.shape[0], img.shape[1]) * 0.12))
    faces = cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(min_side, min_side)
    )
    return [tuple(int(v) for v in f) for f in faces]  # type: ignore[misc]


def subject_from_keyframes(keyframes: list[Path], frame_width: int | None = None) -> Subject:
    """Median face box across keyframes (largest face per frame), scaled to stage pixels."""
    boxes: list[tuple[float, float, float, float]] = []
    for kf in keyframes:
        faces = detect_faces(kf)
        if not faces:
            continue
        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
        try:
            import cv2

            img = cv2.imread(str(kf))
            iw = img.shape[1] if img is not None else (frame_width or STAGE_W)
        except ImportError:  # pragma: no cover
            iw = frame_width or STAGE_W
        k = STAGE_W / iw
        boxes.append((x * k, y * k, w * k, h * k))
    if not boxes:
        log.info("face_not_found", keyframes=len(keyframes))
        fb: dict[str, int] = dict(DEFAULT_FACE)
        return Subject(fb, free_zone_for(fb), 0, prop_point_for(fb))
    boxes.sort(key=lambda b: b[1])
    mid = boxes[len(boxes) // 2]
    # Haar boxes hug the face; widen a little for hair and chin so text keeps clear of it.
    bx, by, bw, bh = mid
    fb2: dict[str, int] = {
        "x": int(max(0, bx - 0.12 * bw)),
        "y": int(max(0, by - 0.25 * bh)),
        "w": int(min(STAGE_W, bw * 1.24)),
        "h": int(min(STAGE_H, bh * 1.5)),
    }
    log.info("face_found", detections=len(boxes), face=fb2)
    return Subject(fb2, free_zone_for(fb2), len(boxes), prop_point_for(fb2))


def free_zone_for(face: dict[str, int]) -> dict[str, int]:
    """The wall above the head: from y 150 down to 40 px above the face, at least 260 px tall."""
    top = 150
    bottom = max(top + 260, face["y"] - 40)
    return {"x": 0, "y": top, "w": STAGE_W, "h": int(bottom - top)}


def prop_point_for(face: dict[str, int]) -> dict[str, int]:
    """Where a worn/held prop usually is: below the chin, slightly left of centre."""
    return {
        "x": int(face["x"] + face["w"] * 0.45),
        "y": int(min(STAGE_H - 200, face["y"] + face["h"] * 1.15)),
    }
