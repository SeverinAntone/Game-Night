"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { AvatarPicker } from "./AvatarPicker";
import { randomAvatar } from "@/lib/palette";

export function AddPlayer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [{ emoji: initialEmoji, color: initialColor }] = useState(randomAvatar);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [color, setColor] = useState(initialColor);
  const [tagline, setTagline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), emoji, color, tagline: tagline.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not add player.");
      return;
    }
    setName("");
    setTagline("");
    const next = randomAvatar();
    setEmoji(next.emoji);
    setColor(next.color);
    setOpen(false);
    router.refresh();
  }

  if (!open)
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        ➕ Add player
      </button>
    );

  return (
    <div className="card w-full space-y-3 p-4">
      <div>
        <label className="label" htmlFor="p-name">
          Name
        </label>
        <input
          id="p-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && add()}
          autoFocus
        />
      </div>

      <AvatarPicker emoji={emoji} color={color} onEmoji={setEmoji} onColor={setColor} />

      <div>
        <label className="label" htmlFor="p-tagline">
          Tagline <span className="normal-case tracking-normal text-ink-500">(optional)</span>
        </label>
        <input
          id="p-tagline"
          className="input"
          placeholder="Reads the rulebook out loud"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-rose-brand">{error}</p>}

      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
        <button className="btn-primary flex-1" onClick={add} disabled={busy || !name.trim()}>
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
    </div>
  );
}
