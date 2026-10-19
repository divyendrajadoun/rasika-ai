"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface DemoVideoProps {
  src: string;
  poster?: string;
  alt: string;
  className?: string;
  /** "load" = start after window load (hero). "view" = start when scrolled into view. */
  start?: "load" | "view";
  /** Give the poster LCP priority (hero only). */
  priority?: boolean;
}

/**
 * A muted looping demo clip that never competes with first paint: the poster is a plain
 * <img> (so it is the LCP candidate), and the <video> only gets its `src` after the page has
 * loaded (or when it scrolls into view). Exposes the underlying <video> via ref for syncing.
 */
export const DemoVideo = forwardRef<HTMLVideoElement | null, DemoVideoProps>(function DemoVideo(
  { src, poster, alt, className, start = "view", priority = false },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [armed, setArmed] = useState(false);
  const [playing, setPlaying] = useState(false);
  useImperativeHandle<HTMLVideoElement | null, HTMLVideoElement | null>(
    ref,
    () => videoRef.current,
  );

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const arm = () => setArmed(true);
    let io: IntersectionObserver | null = null;
    let timer = 0;
    // Never fetch media before the page has finished loading (keeps it off the LCP path).
    const afterLoad = () => {
      if (start === "load") {
        timer = window.setTimeout(arm, 600);
        return;
      }
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            arm();
            io?.disconnect();
          }
        },
        { rootMargin: "200px 0px" },
      );
      io.observe(el);
    };
    if (document.readyState === "complete") timer = window.setTimeout(afterLoad, 300);
    else window.addEventListener("load", afterLoad, { once: true });
    return () => {
      window.removeEventListener("load", afterLoad);
      window.clearTimeout(timer);
      io?.disconnect();
    };
  }, [start]);

  useEffect(() => {
    const el = videoRef.current;
    if (!armed || !el) return;
    el.src = src;
    el.load();
    void el.play().catch(() => {});
  }, [armed, src]);

  return (
    <div className={cn("relative", className)}>
      {poster && (
        // eslint-disable-next-line @next/next/no-img-element -- static asset, exact size via CSS
        <img
          src={poster}
          alt={alt}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
            playing && "opacity-0",
          )}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
        />
      )}
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        poster={poster}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden={poster ? true : undefined}
        aria-label={poster ? undefined : alt}
        onPlaying={() => setPlaying(true)}
      />
    </div>
  );
});
