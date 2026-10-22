import type { Metadata } from "next";
import Link from "next/link";
import { Wizard } from "@/components/wizard/wizard";
import { formatPrice, paidPacks, plans } from "@/config/pricing";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { heygenCatalogue } from "@/lib/heygen";
import { aiImagesEnabled } from "@/lib/ai-images";

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
  if (user.credits < 1 && !project)
    return (
      <div className="bg-surface max-w-xl rounded-[8px] p-6">
        <h1 className="text-xl font-semibold">You&apos;ve used your free reel</h1>
        <p className="text-muted mt-2 text-[14px]">
          Buy reels to keep going:{" "}
          {paidPacks.map((p) => `${p.reels} for ${formatPrice(p.inr)}`).join(", ")}. Pay by UPI from any
          app; no subscription.
        </p>
        <Link href="/dashboard/credits" className="button mt-5">
          Buy reels
        </Link>
      </div>
    );
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
      aiImagesEnabled={aiImagesEnabled()}
      presenterEnabled={env.presenterEnabled && catalogue.voices.length > 0}
      voices={catalogue.voices}
      looks={catalogue.looks}
    />
  );
}
