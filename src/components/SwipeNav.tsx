"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Swipe left/right between the top-level tabs (§10), so the app feels native
 * rather than like a browser tab. The session-entry form is deliberately left
 * out of the ring — nobody wants to swipe away a half-logged game.
 */
const ORDER = ["/", "/leaderboard", "/games", "/players", "/sessions"];

/** Don't hijack a swipe that belongs to a horizontally scrollable strip. */
function insideHorizontalScroller(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body) {
    const style = getComputedStyle(el);
    if (
      (style.overflowX === "auto" || style.overflowX === "scroll") &&
      el.scrollWidth > el.clientWidth + 4
    )
      return true;
    el = el.parentElement;
  }
  return false;
}

export function SwipeNav() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const index = ORDER.indexOf(pathname);
    if (index === -1) return;
    if (window.matchMedia("(min-width: 768px)").matches) return; // rail handles desktop

    let x0 = 0;
    let y0 = 0;
    let tracking = false;

    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1 || insideHorizontalScroller(e.target)) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      tracking = true;
    };

    const end = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
      const next = ORDER[index + (dx < 0 ? 1 : -1)];
      if (next) router.push(next);
    };

    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchend", end, { passive: true });
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchend", end);
    };
  }, [pathname, router]);

  return null;
}
