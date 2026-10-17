import { Copy, Download, Trash2 } from "lucide-react";
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

export function ProjectCard({ project: p }: { project: Project }) {
  const preset =
    presetCards.find((c) => c.tokens.id === p.stylePreset)?.tokens.name ?? p.stylePreset;
  const created = new Date(p.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <article className="bg-card group flex h-full flex-col overflow-hidden rounded-2xl border shadow-[0_20px_50px_rgba(30,0,5,.12)]">
      <Link
        href={`/dashboard/p/${p.id}`}
        className="bg-stage relative block aspect-[9/12] overflow-hidden"
      >
        {p.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL
          <img
            src={p.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="jaali flex h-full items-end justify-center pb-6">
            <div
              className="arch ring-gold/70 h-2/3 w-1/2 bg-[linear-gradient(180deg,var(--mar),var(--stage))] ring-2"
              aria-hidden
            />
          </div>
        )}
        <div className="absolute left-3 top-3">
          <StatusPill
            projectId={p.id}
            status={p.job?.status ?? p.status}
            progress={p.job?.progress ?? 0}
          />
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="poster truncate text-2xl">
          <Link href={`/dashboard/p/${p.id}`}>{p.title}</Link>
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {fmtDuration(p.durationSec)} · {preset} · {created}
        </p>
        <div className="mt-auto flex items-center gap-1 pt-4">
          <Link href={`/dashboard/p/${p.id}`} className="btn-outline-gold h-9 flex-1 text-sm">
            Open
          </Link>
          <form action={duplicateProject}>
            <input type="hidden" name="id" value={p.id} />
            <button type="submit" className="icon-btn" aria-label="Duplicate" title="Duplicate">
              <Copy className="size-4" aria-hidden />
            </button>
          </form>
          <Link
            href={`/dashboard/p/${p.id}#download`}
            className="icon-btn"
            aria-label="Download"
            title="Download"
          >
            <Download className="size-4" aria-hidden />
          </Link>
          <form action={deleteProject}>
            <input type="hidden" name="id" value={p.id} />
            <button
              type="submit"
              className="icon-btn hover:text-[#ff8a66]"
              aria-label="Delete"
              title="Delete"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
