import type { Metadata } from "next";
import Link from "next/link";
import { ProjectCard } from "@/components/dashboard/project-card";
import { requireUser } from "@/lib/auth";
import { listProjects } from "@/lib/projects";

export const metadata: Metadata = { title: "Projects", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const projects = await listProjects(user.id);

  if (projects.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center py-10 text-center">
        <div
          className="arch ring-gold/80 flex h-56 w-40 items-end justify-center bg-[linear-gradient(180deg,var(--mar),var(--stage))] pb-4 ring-[3px]"
          aria-hidden
        >
          <span className="font-devanagari text-gold text-5xl">रस</span>
        </div>
        <h1 className="poster mt-8 text-5xl">No edits yet</h1>
        <p className="font-accent text-muted-foreground mt-3 text-2xl italic">
          Upload a talking reel and we&apos;ll do the rest.
        </p>
        <Link href="/dashboard/new" className="btn-ter h-13 mt-8 px-8 text-base">
          Create your first edit
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker text-goldd dark:text-gold mb-2">Your reels</p>
          <h1 className="poster text-5xl">Projects</h1>
        </div>
        <Link href="/dashboard/new" className="btn-ter">
          + New edit
        </Link>
      </div>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {projects.map((p) => (
          <li key={p.id}>
            <ProjectCard project={p} />
          </li>
        ))}
      </ul>
    </>
  );
}
