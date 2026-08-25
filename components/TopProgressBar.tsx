"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const TRICKLE_INTERVAL_MS = 200;
const FINISH_HOLD_MS = 150;
const FADE_MS = 200;
const SAFETY_TIMEOUT_MS = 8000;

export default function TopProgressBar() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [instant, setInstant] = useState(false);

  const loadingRef = useRef(false);
  const scrollWidthRef = useRef(0);

  const trickleTimer = useRef<ReturnType<typeof setInterval>>(undefined);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const safetyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const clearTimers = useCallback(() => {
    clearInterval(trickleTimer.current);
    clearTimeout(holdTimer.current);
    clearTimeout(fadeTimer.current);
    clearTimeout(safetyTimer.current);
  }, []);

  const measureScroll = useCallback(() => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const pct = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) * 100 : 0;
    scrollWidthRef.current = pct;
    if (!loadingRef.current) setProgress(pct);
  }, []);

  const finish = useCallback(() => {
    if (!loadingRef.current) return;
    loadingRef.current = false;
    clearInterval(trickleTimer.current);
    clearTimeout(safetyTimer.current);

    setProgress(100);
    holdTimer.current = setTimeout(() => {
      setOpacity(0);
      fadeTimer.current = setTimeout(() => {
        setProgress(scrollWidthRef.current);
        requestAnimationFrame(() => setOpacity(1));
      }, FADE_MS);
    }, FINISH_HOLD_MS);
  }, []);

  const start = useCallback(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    clearTimers();
    setOpacity(1);
    setInstant(true);
    setProgress(0);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => setInstant(false));
    });

    trickleTimer.current = setInterval(() => {
      setProgress((p) => (p < 90 ? p + (90 - p) * 0.12 + 1 : p));
    }, TRICKLE_INTERVAL_MS);

    safetyTimer.current = setTimeout(finish, SAFETY_TIMEOUT_MS);
  }, [clearTimers, finish]);

  useEffect(() => {
    measureScroll();
    window.addEventListener("scroll", measureScroll, { passive: true });
    return () => window.removeEventListener("scroll", measureScroll);
  }, [measureScroll]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      start();
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [start]);

  useEffect(() => {
    window.addEventListener("popstate", start);
    return () => window.removeEventListener("popstate", start);
  }, [start]);

  useEffect(() => {
    measureScroll();
    finish();
  }, [pathname, measureScroll, finish]);

  useEffect(() => clearTimers, [clearTimers]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-999 h-0.75" aria-hidden="true">
      <div
        className={`h-full bg-brand-green shadow-[0_0_8px_rgba(95,194,74,0.65)] ease-out ${
          instant ? "" : "transition-[width,opacity] duration-300"
        }`}
        style={{ width: `${progress}%`, opacity }}
      />
    </div>
  );
}
