"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavTabs, NavRail } from "./Nav";
import { SwipeNav } from "./SwipeNav";
import { WhoAmI } from "./WhoAmI";

/**
 * Everything that makes this feel like "the app" — side rail, mobile header,
 * bottom tabs, swipe gestures — all hidden on /login, which should show
 * nothing but the sign-in card. A client component because hiding chrome
 * for exactly one route needs the current path, and layouts (server
 * components) don't have a clean way to read that without restructuring the
 * whole route tree into groups — this is the much smaller change for the
 * same result.
 */
export function AppChrome({
  player,
  children,
}: {
  player: { name: string } | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;

  return (
    <>
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl md:gap-6 md:px-6">
        <NavRail player={player} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 -mx-0 border-b border-white/5 bg-ink-950/70 px-4 py-3 backdrop-blur-lg md:hidden">
            <div className="flex items-center justify-between">
              <Link href="/" className="font-display text-lg font-extrabold tracking-tight">
                <span className="text-grape-400">🎲</span> Game Night
              </Link>
              <WhoAmI player={player} />
            </div>
          </header>
          <main className="flex-1 px-4 pb-28 pt-4 md:px-0 md:pb-12 md:pt-8">{children}</main>
        </div>
      </div>
      <NavTabs />
      <SwipeNav />
    </>
  );
}
