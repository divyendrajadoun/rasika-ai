import type { Metadata } from "next";
import { Wizard } from "@/components/wizard/wizard";
import { plans } from "@/config/pricing";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "New edit", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewEditPage({
  searchParams,
}: {
  searchParams: Promise<{ style?: string; project?: string; industry?: string }>;
}) {
  const user = await requireUser("/dashboard/new");
  const { style, project, industry } = await searchParams;
  const plan = plans.find((p) => p.id === user.plan) ?? plans[0]!;
  return (
    <Wizard
      initialStyle={style}
      initialIndustry={industry}
      resumeProjectId={project}
      credits={user.credits}
      maxSeconds={plan.maxSeconds}
      planName={plan.name}
      stockEnabled={env.stockEnabled}
    />
  );
}
