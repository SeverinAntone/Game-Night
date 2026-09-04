"use client";

import Link from "next/link";
import { useMe } from "./useMe";

/** Small "who's holding this phone" pill. Tapping opens the identity picker. */
export function WhoAmI() {
  const [me, , ready] = useMe();
  if (!ready) return <div className="h-9 w-24 rounded-full bg-white/5" />;

  return (
    <Link
      href="/identity"
      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-3 text-sm font-semibold text-mist-200 transition hover:bg-white/10"
    >
      <span
        className="flex size-7 items-center justify-center rounded-full text-base"
        style={{ background: me ? `${me.color}33` : "rgba(255,255,255,0.06)" }}
      >
        {me?.emoji ?? "👤"}
      </span>
      <span className="max-w-24 truncate">{me?.name ?? "Who's this?"}</span>
    </Link>
  );
}
