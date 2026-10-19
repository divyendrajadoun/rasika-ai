import type { Metadata } from "next";
import { Wizard } from "@/components/wizard/wizard";
import { plans } from "@/config/pricing";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { heygenCatalogue } from "@/lib/heygen";

export const metadata: Metadata = { title: "New edit", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewEditPage({
  searchParams,
}: {
  searchParams: Promise<{ style?: string; project?: string; industry?: string; source?: string; title?: string; kind?: string }>;
}) {
  const user = await requireUser("/dashboard/new");
  const { style, project, industry, source, title, kind } = await searchParams;
  const plan = plans.find((p) => p.id === user.plan) ?? plans[0]!;
  const catalogue = env.presenterEnabled
    ? await heygenCatalogue().catch(() => ({ voices: [], looks: [] }))
    : { voices: [], looks: [] };
  return (
    <Wizard
      initialStyle={style}
      initialIndustry={industry}
      initialSource={source}
      initialTitle={title}
      initialKind={kind}
      resumeProjectId={project}
      credits={user.credits}
      maxSeconds={plan.maxSeconds}
      planName={plan.name}
      stockEnabled={env.stockEnabled}
      presenterEnabled={env.presenterEnabled && catalogue.voices.length > 0}
      voices={catalogue.voices}
      looks={catalogue.looks}
    />
  );
}
