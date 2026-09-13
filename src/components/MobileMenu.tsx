"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RAIL } from "./Nav";
import { WhoAmI } from "./WhoAmI";

/**
 * The bottom tab bar only has room for 5 quick-access items, but the app has
 * 9 top-level destinations now (History, Game Draft, Profile and Settings
 * don't fit down there). This is how the rest stay reachable on a phone —
 * a hamburger button in the header opens a full list, the same one the
 * desktop rail shows. Also carries its own copy of sign-out, so there are
 * two independent ways to reach it on mobile rather than one.
 */
export function MobileMenu({ player }: { player: { name: string } | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Closing on navigation (not just on link click) covers back/forward too.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="-ml-1.5 flex size-9 items-center justify-center rounded-lg text-xl text-mist-200 transition hover:bg-white/5"
      >
        ☰
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="pb-safe absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col gap-1 overflow-y-auto bg-ink-950 p-4 pt-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-lg font-extrabold tracking-tight">
                <span className="text-grape-400">🎲</span> Game Night
              </span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg text-lg text-mist-400 transition hover:bg-white/5"
              >
                ✕
              </button>
            </div>
            {RAIL.map((t) => {
              const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "bg-grape-500/15 text-grape-200 ring-1 ring-grape-400/25"
                      : "text-mist-300 hover:bg-white/5"
                  }`}
                >
                  <span className="text-base">{t.icon}</span>
                  {t.label}
                </Link>
              );
            })}
            <div className="mt-auto border-t border-white/8 pt-4">
              <WhoAmI player={player} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
