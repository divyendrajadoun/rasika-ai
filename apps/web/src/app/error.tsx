"use client";

import { useEffect } from "react";

/**
 * Anything that throws while a page runs lands here instead of Next's bare "Application error".
 * The usual cause is a page opened before a deploy (its server actions are gone): a reload fixes it,
 * and uploads, drafts and credits are saved on the server.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="wrap flex min-h-[60dvh] flex-col items-start justify-center py-16">
      <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em]">Something needs a reload</h1>
      <p className="text-muted mt-2 max-w-[52ch]">
        Rasika may have been updated while this page was open. Your uploads, drafts and credits are
        saved; reloading picks up where you left off.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="button" onClick={() => window.location.reload()}>
          Reload the page
        </button>
        <button type="button" className="button button-ghost" onClick={() => reset()}>
          Try again
        </button>
      </div>
      {error.digest && <p className="text-muted mt-6 text-[12px]">Reference {error.digest}</p>}
    </main>
  );
}
