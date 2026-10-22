/**
 * Calls a server action from the browser without ever crashing the page. The usual failure is a
 * page opened before a deploy: its actions no longer exist on the new server ("Failed to find
 * Server Action"), and Next throws. The user's work is saved, so a reload is all it takes.
 */
export const STALE_PAGE =
  "Rasika was just updated. Reload the page and try again; your upload and settings are saved.";

export async function safeAction<T extends { ok: boolean }>(
  call: () => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  try {
    return await call();
  } catch (e) {
    console.error("[action]", e);
    return { ok: false, error: STALE_PAGE };
  }
}
