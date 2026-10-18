#!/usr/bin/env python3
"""
Generate apps/worker/rasika_worker/plan.py (pydantic v2) from packages/schema/plan.schema.json.

  pnpm --filter @rasika/schema export        # Zod → JSON Schema
  python tools/gen_plan_models.py            # JSON Schema → pydantic (this script)

CI runs both and fails on a dirty diff, so the TypeScript and Python contracts cannot drift.
Run with the worker's interpreter (datamodel-code-generator + ruff installed).
"""

from __future__ import annotations

import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "packages" / "schema" / "plan.schema.json"
OUT = ROOT / "apps" / "worker" / "rasika_worker" / "plan.py"
HEADER = '''"""
Plan v1 pydantic models — GENERATED from packages/schema/plan.schema.json by tools/gen_plan_models.py.
Do not edit by hand; change the Zod schema in packages/schema/src/plan.ts and regenerate.
"""

'''


def main() -> None:
    py = sys.executable
    subprocess.run(
        [
            py, "-m", "datamodel_code_generator",
            "--input", str(SCHEMA), "--input-file-type", "jsonschema", "--output", str(OUT),
            "--output-model-type", "pydantic_v2.BaseModel", "--target-python-version", "3.11",
            "--use-standard-collections", "--use-union-operator", "--use-schema-description",
            "--field-constraints", "--collapse-root-models", "--disable-timestamp", "--use-double-quotes",
            "--formatters", "ruff-format",
        ],
        check=True,
    )
    text = OUT.read_text(encoding="utf-8")
    # drop the generator's own header (filename + blank), keep ours stable
    lines = text.splitlines(keepends=True)
    while lines and lines[0].startswith("#"):
        lines.pop(0)
    OUT.write_text(HEADER + "".join(lines).lstrip("\n"), encoding="utf-8")
    subprocess.run([py, "-m", "ruff", "format", str(OUT)], check=True)
    subprocess.run([py, "-m", "ruff", "check", "--fix", "--quiet", str(OUT)], check=False)
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
