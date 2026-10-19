import type { Metadata } from "next";
import Link from "next/link";
import { ProjectCard } from "@/components/dashboard/project-card";
import { TryGallery } from "@/components/dashboard/try-gallery";
import { requireUser } from "@/lib/auth";
import { listProjects } from "@/lib/projects";

export const metadata: Metadata = { title: "Projects", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The creator's list of reels: a noun title, the one action, the projects as tiles. */
export default async function DashboardPage() {
  const user = await requireUser();
  const projects = await listProjects(user.id);

  if (projects.length === 0) {
    return (
      <div className="py-10">
        <div className="max-w-xl">
        <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em]">No edits yet</h1>
        <p className="text-muted mt-2">
          Upload a talking reel, or paste a script, and the first preview is back in about a minute.
        </p>
        <div className="bg-surface mt-8 rounded-[8px] p-6">
          <p className="font-medium">Your first reel is free.</p>
          <p className="text-muted mt-1 text-[14px]">
            {user.credits} credit{user.credits === 1 ? "" : "s"} on the {user.plan} plan · 1 credit = 1 reel up to 90 s.
          </p>
          <Link href="/dashboard/new" className="button mt-5">
            Create your first edit
          </Link>
        </div>
        </div>
        <TryGallery />
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em]">Projects</h1>
          <p className="text-muted mt-1 text-[14px]">
            {projects.length} reel{projects.length === 1 ? "" : "s"} · {user.credits} credit
            {user.credits === 1 ? "" : "s"} left
          </p>
        </div>
        <Link href="/dashboard/new" className="button">
          New edit
        </Link>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {projects.map((p) => (
          <li key={p.id}>
            <ProjectCard project={p} />
          </li>
        ))}
      </ul>
      <TryGallery />
    </>
  );
}
