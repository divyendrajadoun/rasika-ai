import "server-only";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";
import { s3 } from "@/lib/storage/s3";

/**
 * AI images for a reel (Higgsfield): submit a prompt, poll its status, keep the result in the
 * project's storage. At most AI_MAX per reel; every image is paid for from the Higgsfield account.
 * The worker (imagegen.py) makes the same images automatically for the key moments.
 */
export const AI_MAX = 6;
const API = "https://api.higgsfield.ai";
const MODEL = "higgsfield-ai/soul/v2/standard";

const auth = () => `Key ${process.env.HIGGSFIELD_API_KEY ?? ""}:${process.env.HIGGSFIELD_API_SECRET ?? ""}`;
export const aiImagesEnabled = () => Boolean(process.env.HIGGSFIELD_API_KEY && process.env.HIGGSFIELD_API_SECRET);

export async function submitImage(prompt: string): Promise<string> {
  const r = await fetch(`${API}/${MODEL}`, {
    method: "POST",
    headers: { Authorization: auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: prompt.slice(0, 1500), aspect_ratio: "9:16" }),
  });
  const j = (await r.json().catch(() => ({}))) as { request_id?: string; detail?: unknown };
  if (!r.ok || !j.request_id) throw new Error(`The image service refused the request (${r.status})`);
  return j.request_id;
}

export type ImageStatus = { state: "working" } | { state: "failed"; reason: string } | { state: "done"; url: string };

export async function imageStatus(requestId: string): Promise<ImageStatus> {
  const r = await fetch(`${API}/requests/${requestId}/status`, { headers: { Authorization: auth() }, cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as { status?: string; images?: { url: string }[] };
  if (!r.ok) return { state: "failed", reason: `status ${r.status}` };
  if (j.status === "completed" && j.images?.[0]?.url) return { state: "done", url: j.images[0].url };
  if (["failed", "error", "canceled", "nsfw"].includes(j.status ?? "")) return { state: "failed", reason: j.status ?? "failed" };
  return { state: "working" };
}

/** Download the finished image (only from the service's own CDN) and keep it under `key`. */
export async function storeImage(url: string, key: string): Promise<number> {
  const host = new URL(url).hostname;
  if (!host.endsWith(".cloudfront.net") && !host.endsWith("higgsfield.ai")) throw new Error("Unexpected image host");
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not fetch the image (${r.status})`);
  const body = Buffer.from(await r.arrayBuffer());
  if (body.length > env.maxImageBytes * 2) throw new Error("The image is too large");
  await s3.send(new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, Body: body, ContentType: "image/jpeg" }));
  return body.length;
}

/** Image prompts for the moments of a script that want a picture (Claude, fast model). */
export async function suggestPrompts(
  script: string,
  n: number,
  pictureStyle: string,
): Promise<{ sayWhen: string; label: string; prompt: string }[]> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-5-5",
      max_tokens: 4000,
      // a quick draft: thinking would triple the time (14 s vs 6 s) and run past serverless limits
      thinking: { type: "disabled" },
      system:
        `You choose up to ${n} moments of a short vertical video script that want a picture and write an image prompt for each. ` +
        'Return ONE JSON object: {"moments":[{"say_when":"one exact word from the script it lands on","label":"<= 4 words","prompt":"vivid, specific, vertical 9:16, in the requested picture style"}]}. ' +
        "Spread them across the script, not the first sentence. No real people's likenesses, no logos, no text in the image. Write from what the script says; invent nothing about the speaker's business.",
      messages: [{ role: "user", content: `## Script\n\n${script.slice(0, 6000)}\n\n## Picture style\n\n${pictureStyle || "photorealistic, natural light"}` }],
    }),
  });
  const j = (await r.json().catch(() => ({}))) as { content?: { type: string; text?: string }[] };
  const text = (j.content ?? []).map((b) => b.text ?? "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[0]) as { moments?: { say_when?: string; label?: string; prompt?: string }[] };
    return (parsed.moments ?? [])
      .filter((x) => x.prompt)
      .slice(0, n)
      .map((x) => ({ sayWhen: (x.say_when ?? "").slice(0, 40), label: (x.label ?? "").slice(0, 40), prompt: (x.prompt ?? "").slice(0, 1200) }));
  } catch {
    return [];
  }
}
