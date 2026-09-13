"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WhoAmI } from "./WhoAmI";

const TABS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/leaderboard", label: "Ranks", icon: "🏆" },
  { href: "/play", label: "Log", icon: "➕", primary: true },
  { href: "/games", label: "Games", icon: "🎲" },
  { href: "/players", label: "Players", icon: "🃏" },
];

const RAIL = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/play", label: "Log a session", icon: "➕" },
  { href: "/leaderboard", label: "Leaderboard", icon: "🏆" },
  { href: "/games", label: "Games", icon: "🎲" },
  { href: "/players", label: "Players", icon: "🃏" },
  { href: "/sessions", label: "History", icon: "📜" },
  { href: "/draft", label: "Game Draft", icon: "⚔️" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Bottom tab bar — phones (§10). */
export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-50 border-t border-white/8 bg-ink-950/85 px-2 pt-1.5 backdrop-blur-xl md:hidden">
      <ul className="flex items-end justify-around">
        {TABS.map((t) => {
          const active = isActive(pathname, t.href);
          if (t.primary)
            return (
              <li key={t.href} className="-mt-6">
                <Link
                  href={t.href}
                  aria-label="Log a session"
                  className="flex size-14 items-center justify-center rounded-2xl bg-grape-500 text-2xl text-white shadow-xl shadow-grape-500/35 transition active:scale-95"
                >
                  {t.icon}
                </Link>
              </li>
            );
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition ${
                  active ? "text-grape-300" : "text-mist-400"
                }`}
              >
                <span className={`text-lg leading-none ${active ? "" : "opacity-70"}`}>{t.icon}</span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Persistent side rail — tablets and desktop. */
export function NavRail({ player }: { player: { name: string } | null }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 py-8 md:flex">
      <Link href="/" className="mb-6 block font-display text-xl font-extrabold tracking-tight">
        <span className="text-grape-400">🎲</span> Game Night
      </Link>
      {RAIL.map((t) => {
        const active = isActive(pathname, t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              active
                ? "bg-grape-500/15 text-grape-200 ring-1 ring-grape-400/25"
                : "text-mist-400 hover:bg-white/5 hover:text-mist-100"
            }`}
          >
            <span className="text-base">{t.icon}</span>
            {t.label}
          </Link>
        );
      })}
      <div className="mt-auto">
        <WhoAmI player={player} />
      </div>
    </aside>
  );
}
