import Link from "next/link";
import { deleteProject, duplicateProject } from "@/app/dashboard/actions";
import { StatusPill } from "@/components/dashboard/status-pill";
import { presetCards } from "@/config/presets";
import type { listProjects } from "@/lib/projects";

type Project = Awaited<ReturnType<typeof listProjects>>[number];

export function fmtDuration(sec: number | null | undefined): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m ? `${m}:${String(s).padStart(2, "0")}` : `${s} s`;
}

/** One reel: its frame, its status, and the three things you do with it. */
export function ProjectCard({ project: p }: { project: Project }) {
  const preset =
    presetCards.find((c) => c.tokens.id === p.stylePreset)?.tokens.name ?? p.stylePreset;
  const created = new Date(p.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <article className="bg-surface group flex h-full flex-col overflow-clip rounded-[8px]">
      <Link href={`/dashboard/p/${p.id}`} className="relative block aspect-[9/12] overflow-clip bg-[#111]">
        {p.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL
          <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-end justify-center pb-6">
            <div className="bg-raised h-2/3 w-1/2 rounded-t-full" aria-hidden />
          </div>
        )}
        <div className="absolute left-3 top-3">
          <StatusPill projectId={p.id} status={p.job?.status ?? p.status} progress={p.job?.progress ?? 0} />
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="truncate text-base font-medium leading-snug">
          <Link href={`/dashboard/p/${p.id}`}>{p.title}</Link>
        </h2>
        <p className="text-muted mt-1 text-[13px]">
          {fmtDuration(p.durationSec)} · {preset} · {created}
        </p>
        <div className="mt-auto flex items-center gap-4 pt-4 text-[14px]">
          <Link href={`/dashboard/p/${p.id}`} className="link font-medium">
            Open
          </Link>
          <form action={duplicateProject}>
            <input type="hidden" name="id" value={p.id} />
            <button type="submit" className="link text-muted">
              Duplicate
            </button>
          </form>
          <Link href={`/dashboard/p/${p.id}#download`} className="link text-muted">
            Download
          </Link>
          <form action={deleteProject} className="ml-auto">
            <input type="hidden" name="id" value={p.id} />
            <button type="submit" className="link text-muted hover:text-destructive">
              Delete
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
