"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AvatarPicker } from "./AvatarPicker";
import type { Player } from "@/lib/types";

/** Personal actions on a profile — only the account itself can edit it. */
export function PlayerCardActions({ player, isMe }: { player: Player; isMe: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(player.name);
  const [emoji, setEmoji] = useState(player.emoji);
  const [color, setColor] = useState(player.color);
  const [tagline, setTagline] = useState(player.tagline ?? "");
  const [active, setActive] = useState(!!player.active);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = { name, emoji, color, tagline, active };
    if (newPassword) {
      body.current_password = currentPassword;
      body.password = newPassword;
    }
    const res = await fetch(`/api/players/${player.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save.");
      return;
    }
    setEditing(false);
    setCurrentPassword("");
    setNewPassword("");
    router.refresh();
  }

  if (!isMe) return null;

  if (!editing)
    return (
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={() => setEditing(true)}>
          Edit profile
        </button>
        <Link href="/draft" className="btn-ghost">
          ⚔️ Game Draft
        </Link>
      </div>
    );

  return (
    <div className="card space-y-3 p-4">
      <div>
        <label className="label" htmlFor="e-name">
          Name
        </label>
        <input id="e-name" name="name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
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

      <div className="border-t border-white/8 pt-3">
        <p className="label mb-2">Change password (optional)</p>
        <div className="space-y-2">
          <input
            type="password"
            name="current-password"
            className="input"
            placeholder="Current password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <input
            type="password"
            name="new-password"
            className="input"
            placeholder="New password (8+ characters)"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
          />
        </div>
      </div>

      {error && <p className="text-sm text-rose-brand">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={() => setEditing(false)} disabled={busy}>
          Cancel
        </button>
        <button
          className="btn-primary flex-1"
          onClick={save}
          disabled={busy || (!!newPassword && (newPassword.length < 8 || !currentPassword))}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
