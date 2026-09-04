"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./ui";
import { useMe } from "./useMe";
import type { Player } from "@/lib/types";

/**
 * Two levels of identity (§7):
 *   1. Casual — tap your face. Remembered on this device, used for reactions.
 *   2. PIN     — only for personal pages (your Game Draft, editing your profile).
 */
export function IdentityPicker({
  players,
  signedInId,
}: {
  players: Player[];
  signedInId: number | null;
}) {
  const router = useRouter();
  const [me, setMe] = useMe();
  const [pinFor, setPinFor] = useState<Player | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (!pinFor) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ player_id: pinFor.id, pin }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not sign in.");
      return;
    }
    setMe({ id: pinFor.id, name: pinFor.name, emoji: pinFor.emoji, color: pinFor.color });
    setPinFor(null);
    setPin("");
    router.refresh();
  }

  async function signOut() {
    await fetch("/api/auth", { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section>
        <h2 className="section-title mb-1">On this device</h2>
        <p className="mb-2 text-xs text-mist-400">
          Casual — no PIN. Just says who&apos;s holding this phone, so emoji reactions land under
          your name. Switching here doesn&apos;t sign you in as anyone.
        </p>
        <div className="flex flex-wrap gap-2">
          {players.map((p) => (
            <button
              key={p.id}
              onClick={() => setMe({ id: p.id, name: p.name, emoji: p.emoji, color: p.color })}
              className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                me?.id === p.id
                  ? "border-grape-400/60 bg-grape-500/20"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <Avatar emoji={p.emoji} color={p.color} size={26} />
              {p.name}
              {me?.id === p.id && <span className="text-grape-300">✓</span>}
            </button>
          ))}
        </div>
        {me && (
          <button className="mt-3 text-xs font-semibold text-mist-400" onClick={() => setMe(null)}>
            Forget me on this device
          </button>
        )}
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-1">Personal pages</h2>
        <p className="mb-3 text-xs text-mist-400">
          There&apos;s no PIN to look up and nothing to hand out —{" "}
          <strong className="text-mist-200">you invent it</strong>. Pick your name, type any 4+
          digits, and that becomes your PIN from then on. It only guards your Game Draft and edits
          to your own profile.
        </p>

        {signedInId ? (
          <div className="flex items-center gap-3">
            <span className="text-sm">
              Signed in as{" "}
              <strong>{players.find((p) => p.id === signedInId)?.name ?? "someone"}</strong>
            </span>
            <button className="btn-ghost ml-auto text-xs" onClick={signOut}>
              Sign out
            </button>
          </div>
        ) : pinFor ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Avatar emoji={pinFor.emoji} color={pinFor.color} size={30} />
              <span className="font-semibold">{pinFor.name}</span>
              <button className="ml-auto text-xs text-mist-400" onClick={() => setPinFor(null)}>
                change
              </button>
            </div>
            <input
              className="input text-center text-2xl tracking-[0.4em]"
              inputMode="numeric"
              type="password"
              autoComplete="off"
              placeholder="••••"
              aria-label="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              onKeyDown={(e) => e.key === "Enter" && pin.length >= 4 && signIn()}
              autoFocus
            />
            <p className="text-center text-[11px] text-mist-400">
              {pinFor.has_pin
                ? "Enter your PIN."
                : "No PIN yet — whatever you type now becomes it."}
            </p>
            {error && <p className="text-sm text-rose-brand">{error}</p>}
            <button className="btn-primary w-full" onClick={signIn} disabled={busy || pin.length < 4}>
              {busy ? "…" : "Sign in"}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => setPinFor(p)}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
              >
                <Avatar emoji={p.emoji} color={p.color} size={22} />
                {p.name}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
