#!/usr/bin/env python3
"""
Listen to the exported slices with earshot (https://github.com/Leonxlnx/earshot): how well each one matches what
its role should sound like, and whether it reads as a real recording. Run with the Python that has earshot installed
(it needs torch and ~1.1 GB of models, so it stays out of the worker):

  <earshot venv>/python tools/sfx/ears.py .work-e2e/sfx/slices

Writes .work-e2e/sfx/slices/ears.json: {"<role>/<file>": {"z": .., "verdict": .., "like": .., "p_real": ..}}.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from earshot import api

#: what each role should sound like, in the words earshot's vocabulary understands
QUERY = {
    "whoosh": "a soft airy whoosh of something moving past",
    "swish": "a quick swish of air",
    "pop": "a soft round pop",
    "click": "a crisp mouse button click",
    "tick": "a small soft tick",
    "tap": "a finger tapping on wood",
    "thud": "a soft dull thud of something landing",
    "impact": "a deep cinematic impact hit",
    "paper": "a sheet of paper sliding",
    "scribble": "a marker pen scribbling on paper",
    "chime": "a bright gentle chime",
    "riser": "a rising whoosh building tension",
    "sub": "a deep sub bass drop",
    "glitch": "a short digital glitch",
    "key": "a single keyboard key press",
    "shutter": "a camera shutter click",
    "stamp": "a rubber stamp pressed on paper",
    "popper": "a party popper burst",
}


def main() -> None:
    root = Path(sys.argv[1])
    out: dict[str, dict] = {}
    for d in sorted(p for p in root.iterdir() if p.is_dir() and p.name in QUERY):
        files = sorted(str(f) for f in d.glob("*.wav"))
        if not files:
            continue
        ranked = api.rank(files, QUERY[d.name])
        real = {Path(r["path"]).name: r for r in api.realness_many(files)["files"]}
        for r in ranked["results"]:
            name = Path(r["path"]).name
            rr = real.get(name) or {}
            out[f"{d.name}/{name}"] = {
                "z": r["z"],
                "verdict": r["verdict"],
                "like": r["sounds_most_like"],
                "p_real": rr.get("p_real"),
            }
        print(d.name, ranked["summary"][:160])
    (root / "ears.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("wrote", root / "ears.json", len(out))


if __name__ == "__main__":
    main()
