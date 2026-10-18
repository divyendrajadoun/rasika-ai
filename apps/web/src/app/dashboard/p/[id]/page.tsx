import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteProject, duplicateProject } from "@/app/dashboard/actions";
import { fmtDuration } from "@/components/dashboard/project-card";
import { ProgressView } from "@/components/dashboard/progress-view";
import { TranscriptPanel } from "@/components/dashboard/transcript-panel";
import { presetCards } from "@/config/presets";
import { requireUser } from "@/lib/auth";
import { getProject } from "@/lib/projects";

export const metadata: Metadata = { title: "Project", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const data = await getProject(user.id, id);
  if (!data) notFound();
  const { project, assets, job, transcript, plan } = data;
  const source = assets.find((a) => a.kind === "source_video");
  const images = assets
    .filter((a) => a.kind === "image")
    .sort((a, b) => (a.meta.order ?? 0) - (b.meta.order ?? 0));
  const output = assets.find((a) => a.kind === "output_1080");
  const share = assets.find((a) => a.kind === "output_720");
  const preview = assets.find((a) => a.kind === "preview_540");
  const proxy = assets.find((a) => a.kind === "proxy");
  const preset =
    presetCards.find((c) => c.tokens.id === project.stylePreset)?.tokens.name ??
    project.stylePreset;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <Link href="/dashboard" className="text-muted-foreground text-sm hover:underline">
          ← Projects
        </Link>
        <h1 className="poster mt-3 text-5xl">{project.title}</h1>
        <p className="text-muted-foreground mt-2">
          {fmtDuration(project.durationSec)} · {preset} · {project.creditsCost} credit
          {project.creditsCost === 1 ? "" : "s"}
          {project.styleText ? ` · “${project.styleText}”` : ""}
        </p>

        {project.status === "draft" ? (
          <div className="mt-8 rounded-2xl border border-dashed p-6">
            <p className="font-accent text-2xl italic">This reel hasn&apos;t been submitted yet.</p>
            <Link href={`/dashboard/new?project=${project.id}`} className="btn-ter mt-4">
              Continue setup
            </Link>
          </div>
        ) : (
          <ProgressView
            projectId={project.id}
            initial={{
              status: job?.status ?? project.status,
              progress: job?.progress ?? 0,
              message: job?.message ?? "",
            }}
          />
        )}

        {transcript && <TranscriptPanel transcript={transcript} />}

        <section id="download" className="mt-10">
          <h2 className="poster text-3xl">Export</h2>
          {output ? (
            <div className="mt-4 space-y-4">
              <video
                src={output.url}
                controls
                playsInline
                preload="metadata"
                className="bg-stage aspect-[9/16] w-full max-w-xs rounded-xl"
              />
              <div className="flex flex-wrap gap-2">
                <a href={output.url} className="btn-ter" download>
                  Download 1080p MP4
                </a>
                {share && (
                  <a href={share.url} className="btn-outline-gold" download>
                    720p share copy
                  </a>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                {(output.sizeBytes / 1024 / 1024).toFixed(1)} MB · plan v
                {output.meta.planVersion ?? plan?.version ?? "?"} · rendered in{" "}
                {output.meta.chunks ?? "?"} parallel chunks
              </p>
            </div>
          ) : preview ? (
            <div className="mt-4 space-y-3">
              <video
                src={preview.url}
                controls
                playsInline
                preload="metadata"
                className="bg-stage aspect-[9/16] w-full max-w-xs rounded-xl"
              />
              <p className="text-muted-foreground text-xs">
                540p preview · the full-quality render follows.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">
              {plan
                ? "A plan exists; the final MP4 appears here once the render finishes."
                : "Your transcript is ready. The edit plan (Phase 5) and the final MP4 appear here after that step."}
            </p>
          )}
          <p className="text-muted-foreground mt-3 text-xs">
            <Link href={`/dev/engine?project=${project.id}`} className="hover:underline">
              Open in the engine dev player
            </Link>
            {proxy ? " · normalised 1080p proxy ready" : ""}
          </p>
        </section>
      </div>

      <aside className="space-y-6">
        <div className="bg-card rounded-2xl border p-4">
          <p className="kicker text-goldd dark:text-gold mb-3">Your reel</p>
          {source ? (
            <>
              <video
                src={source.url}
                controls
                playsInline
                preload="metadata"
                className="bg-stage aspect-[9/16] w-full rounded-xl"
              />
              <p className="text-muted-foreground mt-2 truncate text-xs">
                {source.filename} · {(source.sizeBytes / 1024 / 1024).toFixed(0)} MB
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No video uploaded.</p>
          )}
        </div>
        {images.length > 0 && (
          <div className="bg-card rounded-2xl border p-4">
            <p className="kicker text-goldd dark:text-gold mb-3">Photos ({images.length})</p>
            <ul className="grid grid-cols-3 gap-2">
              {images.map((img) => (
                <li key={img.id} className="polaroid !p-1 !pb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL */}
                  <img
                    src={img.url}
                    alt={img.meta.label ?? ""}
                    className="aspect-[4/5] w-full rounded-sm object-cover"
                  />
                  <p className="poster text-mar mt-1 truncate text-center text-[10px]">
                    {img.meta.label || "—"}
                  </p>
                  {img.meta.sayWhen && (
                    <p className="text-mar/70 truncate text-center text-[9px] italic">
                      “{img.meta.sayWhen}”
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="bg-card rounded-2xl border p-4">
          <p className="kicker text-goldd dark:text-gold mb-3">Brand & ending</p>
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
            <button type="submit" className="btn-outline-gold w-full">
              Duplicate
            </button>
          </form>
          <form action={deleteProject} className="flex-1">
            <input type="hidden" name="id" value={project.id} />
            <button type="submit" className="btn-outline-gold w-full hover:text-[#ff8a66]">
              Delete
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
