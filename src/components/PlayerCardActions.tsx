"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AvatarPicker } from "./AvatarPicker";
import { useMe } from "./useMe";
import type { Player } from "@/lib/types";

/** Personal actions on a profile — gated by the name+PIN identity (§7). */
export function PlayerCardActions({
  player,
  isMe,
  hasPin,
}: {
  player: Player;
  isMe: boolean;
  hasPin: boolean;
}) {
  const router = useRouter();
  const [, setCasual] = useMe();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(player.name);
  const [emoji, setEmoji] = useState(player.emoji);
  const [color, setColor] = useState(player.color);
  const [tagline, setTagline] = useState(player.tagline ?? "");
  const [active, setActive] = useState(!!player.active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = isMe || !hasPin;

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/players/${player.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, emoji, color, tagline, active }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing)
    return (
      <div className="flex flex-wrap gap-2">
        <button
          className="btn-ghost"
          onClick={() =>
            setCasual({ id: player.id, name: player.name, emoji: player.emoji, color: player.color })
          }
        >
          This is me
        </button>
        {canEdit ? (
          <button className="btn-ghost" onClick={() => setEditing(true)}>
            Edit profile
          </button>
        ) : (
          <Link href="/identity" className="btn-ghost">
            Sign in to edit
          </Link>
        )}
        {isMe && (
          <Link href="/draft" className="btn-ghost">
            ⚔️ Game Draft
          </Link>
        )}
      </div>
    );

  return (
    <div className="card space-y-3 p-4">
      <div>
        <label className="label" htmlFor="e-name">
          Name
        </label>
        <input id="e-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <AvatarPicker emoji={emoji} color={color} onEmoji={setEmoji} onColor={setColor} />
      <div>
        <label className="label" htmlFor="e-tagline">
          Tagline
        </label>
        <input
          id="e-tagline"
          className="input"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="size-4 accent-[#8b5cf6]"
        />
        Still shows up to game night
      </label>
      {error && <p className="text-sm text-rose-brand">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={() => setEditing(false)} disabled={busy}>
          Cancel
        </button>
        <button className="btn-primary flex-1" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
