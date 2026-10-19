import "server-only";

/**
 * HeyGen catalogue for the AI presenter step: voices and stock looks, read server-side with the
 * worker's key and cached for an hour. The web app never renders videos itself — that is the
 * worker's `presenter` job — it only offers the choices.
 */
export interface HeyGenVoice {
  id: string;
  name: string;
  language: string;
  gender: string;
  private: boolean;
  preview?: string | null;
}
export interface HeyGenLook {
  id: string;
  name: string;
  gender?: string;
  preview?: string | null;
  portrait: boolean;
}

const BASE = "https://api.heygen.com";
const TTL = 60 * 60 * 1000;
let cache: { at: number; voices: HeyGenVoice[]; looks: HeyGenLook[] } | null = null;

async function get<T>(path: string): Promise<T> {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) throw new Error("HEYGEN_API_KEY is not set");
  const r = await fetch(BASE + path, { headers: { "X-Api-Key": key }, next: { revalidate: 3600 } });
  if (!r.ok) throw new Error(`HeyGen ${r.status} on ${path}`);
  return (await r.json()) as T;
}

interface VoiceRow {
  voice_id: string;
  name: string;
  language: string;
  gender: string;
  type: string;
  preview_audio_url?: string | null;
}
interface LookRow {
  id: string;
  name: string;
  gender?: string;
  preview_image_url?: string | null;
  preferred_orientation?: string;
  image_width?: number;
  image_height?: number;
  status?: string;
}

export async function heygenCatalogue(): Promise<{ voices: HeyGenVoice[]; looks: HeyGenLook[] }> {
  if (cache && Date.now() - cache.at < TTL) return cache;
  const voices: HeyGenVoice[] = [];
  const seen = new Set<string>();
  const pushVoices = (rows: VoiceRow[], priv: boolean) => {
    for (const v of rows) {
      if (seen.has(v.voice_id)) continue;
      seen.add(v.voice_id);
      voices.push({
        id: v.voice_id,
        name: v.name.trim(),
        language: v.language,
        gender: v.gender,
        private: priv,
        preview: v.preview_audio_url ?? null,
      });
    }
  };
  try {
    const priv = await get<{ data: VoiceRow[] }>("/v3/voices?type=private&limit=50");
    pushVoices(priv.data ?? [], true);
  } catch {
    /* no private voices */
  }
  for (const lang of ["English", "Hindi"]) {
    const pub = await get<{ data: VoiceRow[] }>(`/v3/voices?language=${lang}&limit=24`);
    pushVoices(pub.data ?? [], false);
  }
  // the account's own looks first (photo avatars and digital twins, often portrait), then stock
  const lookRows: LookRow[] = [];
  for (const q of ["ownership=private&limit=50", "avatar_type=photo_avatar&ownership=public&limit=50"]) {
    try {
      const res = await get<{ data: LookRow[] }>(`/v3/avatars/looks?${q}`);
      lookRows.push(...(res.data ?? []));
    } catch {
      /* one of the lists is optional */
    }
  }
  const seenLook = new Set<string>();
  const looks: HeyGenLook[] = lookRows
    .filter((l) => (l.status === "completed" || !l.status) && !seenLook.has(l.id) && seenLook.add(l.id))
    .map((l) => ({
      id: l.id,
      name: l.name,
      gender: l.gender,
      preview: l.preview_image_url ?? null,
      portrait:
        l.preferred_orientation === "portrait" ||
        (l.image_width !== undefined && l.image_height !== undefined && l.image_height > l.image_width),
    }))
    .sort((a, b) => Number(b.portrait) - Number(a.portrait))
    .slice(0, 36);
  cache = { at: Date.now(), voices, looks };
  return cache;
}
