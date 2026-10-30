import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ReelQa } from "@/db/schema";
import { presignGet } from "@/lib/storage/s3";

const LEVEL_STYLE: Record<string, string> = {
  PASS: "bg-[#2f6b3a] text-white",
  WARN: "bg-[#b07a1a] text-white",
  FAIL: "bg-[#9b2c2c] text-white",
};

function Chip({ level }: { level: string }) {
  return (
    <span
      className={`inline-block rounded-[4px] px-2 py-0.5 text-[12px] font-semibold ${LEVEL_STYLE[level] ?? "bg-raised"}`}
    >
      {level}
    </span>
  );
}

/** The last finished reels as the worker measured them (qa.py): what went out without anyone
 *  watching it, and the checks that most often fall short. */
export async function ReelChecks({
  emailOf,
  when,
}: {
  emailOf: Map<string, string>;
  when: (d: Date | string | null) => string;
}) {
  const rows = await db
    .select({ asset: schema.assets, title: schema.projects.title })
    .from(schema.assets)
    .innerJoin(schema.projects, eq(schema.assets.projectId, schema.projects.id))
    .where(eq(schema.assets.kind, "output_1080"))
    .orderBy(desc(schema.assets.createdAt))
    .limit(30);
  const checked = rows.filter((r) => r.asset.meta?.qa);
  const tally = { PASS: 0, WARN: 0, FAIL: 0 };
  const problems = new Map<string, number>();
  for (const r of checked) {
    const qa = r.asset.meta.qa as ReelQa;
    tally[qa.verdict] += 1;
    for (const c of qa.checks)
      if (c.level === "WARN" || c.level === "FAIL")
        problems.set(c.check, (problems.get(c.check) ?? 0) + 1);
  }
  const links = await Promise.all(
    rows.map(async (r) => ({
      reel: await presignGet(r.asset.storageKey).catch(() => null),
      sheet: r.asset.meta?.qa?.sheetKey
        ? await presignGet(r.asset.meta.qa.sheetKey).catch(() => null)
        : null,
    })),
  );

  return (
    <section>
      <h2 className="text-xl font-semibold">Reel checks</h2>
      <p className="text-muted mt-1 text-[14px]">
        Every finished reel is measured by the worker: first frame, flashes, frozen picture, blank
        frames, loudness and gaps in the sound. The contact sheet shows the first 3 seconds (can you
        tell what it is with the sound off?) and the whole reel.
      </p>
      {checked.length === 0 ? (
        <p className="text-muted mt-3 text-[14px]">
          No checked reels yet: reels finished after this update are checked.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[14px]">
          <span>
            Last {checked.length}: <Chip level="PASS" /> {tally.PASS} <Chip level="WARN" />{" "}
            {tally.WARN} <Chip level="FAIL" /> {tally.FAIL}
          </span>
          {problems.size > 0 && (
            <span className="text-muted">
              Most often:{" "}
              {[...problems.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([k, n]) => `${k} (${n})`)
                .join(", ")}
            </span>
          )}
        </div>
      )}
      <ul className="mt-4 space-y-2">
        {rows.map((r, i) => {
          const qa = r.asset.meta?.qa;
          const bad = qa?.checks.filter((c) => c.level === "WARN" || c.level === "FAIL") ?? [];
          return (
            <li key={r.asset.id} className="bg-surface rounded-[8px] p-3 text-[14px]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {qa ? <Chip level={qa.verdict} /> : <span className="text-muted">not checked</span>}
                <span className="font-medium">{r.title}</span>
                <span className="text-muted">{emailOf.get(r.asset.userId) ?? r.asset.userId}</span>
                <span className="text-muted">{when(r.asset.createdAt)}</span>
                {qa?.info && <span className="text-muted">{Math.round(qa.info.dur)} s</span>}
                {links[i]?.reel && (
                  <a href={links[i].reel} target="_blank" rel="noreferrer" className="link">
                    Reel
                  </a>
                )}
                {links[i]?.sheet && (
                  <a href={links[i].sheet} target="_blank" rel="noreferrer" className="link">
                    Contact sheet
                  </a>
                )}
              </div>
              {bad.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {bad.map((c) => (
                    <li key={c.check}>
                      <Chip level={c.level} /> <span className="font-medium">{c.check}</span>
                      <span className="text-muted"> · {c.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
