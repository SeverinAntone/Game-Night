"use client";

import { useRouter } from "next/navigation";

/**
 * "Signed in as X" pill + logout. The player comes from the server (root
 * layout already knows who's signed in — see auth.ts's `currentPlayer`), so
 * there's no client-side fetch or loading flicker like the old
 * localStorage-backed version had.
 */
export function WhoAmI({ player }: { player: { name: string } | null }) {
  const router = useRouter();
  if (!player) return null;

  async function signOut() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pl-3 pr-3 text-sm font-semibold text-mist-200 transition hover:bg-white/10"
      title="Sign out"
    >
      <span className="max-w-24 truncate">{player.name}</span>
      <span className="text-mist-400">·</span>
      <span className="text-mist-400">Sign out</span>
    </button>
  );
}
