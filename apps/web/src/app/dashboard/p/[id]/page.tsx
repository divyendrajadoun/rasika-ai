import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteProject, duplicateProject } from "@/app/dashboard/actions";
import { fmtDuration } from "@/components/dashboard/project-card";
import { ProgressView } from "@/components/dashboard/progress-view";
import { ClipsPanel } from "@/components/dashboard/clips-panel";
import { EditRoom } from "@/components/dashboard/edit-room";
import { ExportShapes } from "@/components/dashboard/export-shapes";
import { TranscriptPanel } from "@/components/dashboard/transcript-panel";
import { projectStyleLabel } from "@/config/presets";
import { requireUser } from "@/lib/auth";
import { ACTIVE_STATUSES, getEditor, getProject } from "@/lib/projects";

export const metadata: Metadata = { title: "Project", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const data = await getProject(user.id, id);
  if (!data) notFound();
  const { project, assets, job, transcript, plan } = data;
  const busy = Boolean(job && ACTIVE_STATUSES.has(job.status));
  // the editor works on recorded takes (a brief film has no take to cut)
  const editor = project.styleOptions.source === "brief" ? null : await getEditor(project.id, assets);
  const exports = Object.fromEntries(
    assets.filter((a) => a.kind === "export" && a.meta.format).map((a) => [a.meta.format!, a.url]),
  );
  const source = assets.find((a) => a.kind === "source_video");
  // many clips: the joined take records what became of each clip
  const joined = assets.find((a) => a.kind === "source_video" && a.meta.assembled);
  const clipUrls = Object.fromEntries(
    assets.filter((a) => a.kind === "source_clip").map((a) => [a.id, a.url]),
  );
  const images = assets
    .filter((a) => a.kind === "image")
    .sort((a, b) => (a.meta.order ?? 0) - (b.meta.order ?? 0));
  const output = assets.find((a) => a.kind === "output_1080");
  const share = assets.find((a) => a.kind === "output_720");
  const preview = assets.find((a) => a.kind === "preview_540");
  const proxy = assets.find((a) => a.kind === "proxy");
  const preset = projectStyleLabel(project.stylePreset, project.styleOptions);
  // stock footage credits (Pexels asks for attribution where possible; the plan keeps the source)
  const stockCredits = (() => {
    const els = (plan?.plan as { elements?: Array<Record<string, unknown>> } | undefined)?.elements ?? [];
    const seen = new Map<string, string>();
    for (const e of els) {
      const src = e["source"] as { provider?: string; author?: string; url?: string } | undefined;
      if (e["type"] === "broll" && src?.author && !seen.has(src.author)) seen.set(src.author, src.url ?? "");
    }
    return [...seen.entries()];
  })();

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <Link href="/dashboard" className="link text-muted text-[14px]">
          Projects
        </Link>
        <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-[-0.02em]">{project.title}</h1>
        <p className="text-muted mt-1 text-[14px]">
          {fmtDuration(project.durationSec)} · {preset} · {project.creditsCost} credit
          {project.creditsCost === 1 ? "" : "s"}
          {project.styleText ? ` · “${project.styleText}”` : ""}
        </p>

        {project.status === "draft" ? (
          <div className="bg-surface mt-8 rounded-[8px] p-6">
            <p className="font-medium">This reel hasn&apos;t been submitted yet.</p>
            <Link href={`/dashboard/new?project=${project.id}`} className="button mt-4">
              Continue setup
            </Link>
          </div>
        ) : (
          <ProgressView
            key={job?.id ?? "none"}
            projectId={project.id}
            initial={{
              status: job?.status ?? project.status,
              progress: job?.progress ?? 0,
              message: job?.message ?? "",
              updatedAt: job?.updatedAt?.toISOString() ?? null,
            }}
          />
        )}

        {joined?.meta.arrangement && (
          <ClipsPanel
            key={joined.id}
            projectId={project.id}
            arrangement={joined.meta.arrangement}
            arrangedBy={joined.meta.arrangedBy}
            urls={clipUrls}
            busy={busy}
          />
        )}

        {editor ? (
          <EditRoom
            key={`${editor.cutId}:${editor.version}`}
            projectId={project.id}
            data={editor}
            busy={busy}
            studioSound={Boolean(project.styleOptions.studioSound)}
          />
        ) : (
          transcript && <TranscriptPanel transcript={transcript} />
        )}

        <section id="download" className="mt-10">
          <h2 className="text-xl font-semibold leading-tight tracking-[-0.02em]">Export</h2>
          {output ? (
            <div className="mt-4 space-y-4">
              <video
                src={output.url}
                crossOrigin="anonymous"
                controls
                playsInline
                preload="metadata"
                className="bg-[#111] aspect-[9/16] w-full max-w-xs rounded-[8px]"
              />
              <div className="flex flex-wrap gap-2">
                <a href={output.url} className="button" download>
                  Download 1080p MP4
                </a>
                {share && (
                  <a href={share.url} className="button button-ghost" download>
                    720p share copy
                  </a>
                )}
              </div>
              <p className="text-muted-foreground text-[13px]">
                {(output.sizeBytes / 1024 / 1024).toFixed(1)} MB · plan v
                {output.meta.planVersion ?? plan?.version ?? "?"} · rendered in{" "}
                {output.meta.chunks ?? "?"} parallel chunks
              </p>
              {stockCredits.length > 0 && (
                <p className="text-muted-foreground text-[13px]">
                  Stock footage via Pexels:{" "}
                  {stockCredits.map(([author, url], i) => (
                    <span key={author}>
                      {i > 0 && ", "}
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer" className="underline">
                          {author}
                        </a>
                      ) : (
                        author
                      )}
                    </span>
                  ))}
                </p>
              )}
              <ExportShapes projectId={project.id} ready={exports} busy={busy} />
            </div>
          ) : preview ? (
            <div className="mt-4 space-y-3">
              <video
                src={preview.url}
                crossOrigin="anonymous"
                controls
                playsInline
                preload="metadata"
                className="bg-[#111] aspect-[9/16] w-full max-w-xs rounded-[8px]"
              />
              <p className="text-muted-foreground text-[13px]">
                540p preview · the full-quality render follows.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">
              {plan
                ? "A plan exists; the final MP4 appears here once the render finishes."
                : "Your reel appears here as soon as it is rendered."}
            </p>
          )}
          <p className="text-muted-foreground mt-3 text-[13px]">
            <Link href={`/dev/engine?project=${project.id}`} className="hover:underline">
              Open in the engine dev player
            </Link>
            {proxy ? " · normalised 1080p proxy ready" : ""}
          </p>
        </section>
      </div>

      <aside className="space-y-6">
        <div className="bg-surface rounded-[8px] p-4">
          <p className="label">Your reel</p>
          {source ? (
            <>
              <video
                src={source.url}
                crossOrigin="anonymous"
                controls
                playsInline
                preload="metadata"
                className="bg-[#111] aspect-[9/16] w-full rounded-[8px]"
              />
              <p className="text-muted-foreground mt-2 truncate text-[13px]">
                {source.filename} · {(source.sizeBytes / 1024 / 1024).toFixed(0)} MB
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No video uploaded.</p>
          )}
        </div>
        {images.length > 0 && (
          <div className="bg-surface rounded-[8px] p-4">
            <p className="label">Photos ({images.length})</p>
            <ul className="grid grid-cols-3 gap-2">
              {images.map((img) => (
                <li key={img.id} className="bg-surface rounded-[6px] p-1 pb-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL */}
                  <img
                    src={img.url}
                    crossOrigin="anonymous"
                    alt={img.meta.label ?? ""}
                    className="aspect-[4/5] w-full rounded-sm object-cover"
                  />
                  <p className="font-semibold tracking-[-0.02em] text-text mt-1 truncate text-center text-[12px]">
                    {img.meta.label || "—"}
                  </p>
                  {img.meta.sayWhen && (
                    <p className="text-muted truncate text-center text-[11px]">
                      “{img.meta.sayWhen}”
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="bg-surface rounded-[8px] p-4">
          <p className="label">Brand & ending</p>
          <dl className="text-sm">
            <dt className="text-muted-foreground">Brand</dt>
            <dd>
              {project.brand.name || "—"} {project.brand.handle ? `· ${project.brand.handle}` : ""}
            </dd>
            <dt className="text-muted-foreground mt-2">End card line</dt>
            <dd>{project.brand.endLine || "Speaker's last sentence (default)"}</dd>
            <dt className="text-muted-foreground mt-2">CTA</dt>
            <dd>{project.brand.cta || "—"}</dd>
          </dl>
        </div>
        <div className="flex gap-2">
          <form action={duplicateProject} className="flex-1">
            <input type="hidden" name="id" value={project.id} />
            <button type="submit" className="button button-ghost w-full">
              Duplicate
            </button>
          </form>
          <form action={deleteProject} className="flex-1">
            <input type="hidden" name="id" value={project.id} />
            <button type="submit" className="button button-ghost w-full hover:text-[#ff8a66]">
              Delete
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
