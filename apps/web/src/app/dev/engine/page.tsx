import type { Metadata } from "next";
import { EngineDev, type DevProject } from "@/components/dev/engine-dev";
import { requireUser } from "@/lib/auth";
import { getProject } from "@/lib/projects";

export const metadata: Metadata = { title: "Engine dev", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * /dev/engine — Storybook-style player: any plan against any video (SPEC Phase 3).
 * Defaults to the Baisa Bling plan over the raw demo take; `?project=<id>` loads one of your
 * uploads (source video + photos, presigned) so a plan can be previewed on real footage.
 */
export default async function EngineDevPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requireUser("/dev/engine");
  const { project: projectId } = await searchParams;
  let project: DevProject | null = null;
  if (projectId) {
    const data = await getProject(user.id, projectId);
    if (data) {
      const source = data.assets.find((a) => a.kind === "source_video");
      project = {
        id: data.project.id,
        title: data.project.title,
        videoUrl: source?.url ?? null,
        durationSec: data.project.durationSec,
        images: data.assets
          .filter((a) => a.kind === "image")
          .sort((a, b) => (a.meta.order ?? 0) - (b.meta.order ?? 0))
          .map((a) => ({ id: a.id, label: a.meta.label ?? a.filename, url: a.url })),
      };
    }
  }
  return <EngineDev project={project} />;
}
