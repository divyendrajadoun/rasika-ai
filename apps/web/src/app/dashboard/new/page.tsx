import type { Metadata } from "next";
import { Wizard } from "@/components/wizard/wizard";
import { plans } from "@/config/pricing";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "New edit", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewEditPage({
  searchParams,
}: {
  searchParams: Promise<{ style?: string; project?: string }>;
}) {
  const user = await requireUser("/dashboard/new");
  const { style, project } = await searchParams;
  const plan = plans.find((p) => p.id === user.plan) ?? plans[0]!;
  return (
    <Wizard
      initialStyle={style}
      resumeProjectId={project}
      credits={user.credits}
      maxSeconds={plan.maxSeconds}
      planName={plan.name}
    />
  );
}
