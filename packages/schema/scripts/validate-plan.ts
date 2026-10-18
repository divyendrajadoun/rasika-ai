/**
 * CLI: validate a plan against a transcript.
 *   pnpm --filter @rasika/schema validate ../../plans/baisa_bling.json ../../plans/baisa_bling.words.json [imageId,...]
 */
import { readFileSync } from "node:fs";
import { validatePlan } from "../src/validate";

const [planPath, wordsPath, imageList] = process.argv.slice(2);
if (!planPath || !wordsPath) {
  console.error("usage: validate-plan <plan.json> <words.json> [imageId,imageId,...]");
  process.exit(2);
}
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const words = JSON.parse(readFileSync(wordsPath, "utf8")).words;
const r = validatePlan(plan, words, imageList ? { imageIds: imageList.split(",") } : {});
const counts: Record<string, number> = {};
for (const i of r.issues) counts[i.level] = (counts[i.level] ?? 0) + 1;
console.log(`ok=${r.ok}`, counts);
for (const i of r.issues) {
  if (i.code === "anchor.inferred") continue;
  console.log(
    `${i.level.padEnd(5)} ${i.code.padEnd(16)} ${(i.elementId ?? "").padEnd(16)} ${i.message}`,
  );
}
console.log(`${r.issues.filter((i) => i.code === "anchor.inferred").length} anchors inferred`);
process.exit(r.ok ? 0 : 1);
