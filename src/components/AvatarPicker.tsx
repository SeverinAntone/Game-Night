"use client";

import { useState } from "react";
import { Avatar } from "./ui";
import { AVATAR_COLORS, AVATAR_GROUPS } from "@/lib/palette";

/** Emoji + colour picker, shared by adding a player and editing a profile. */
export function AvatarPicker({
  emoji,
  color,
  onEmoji,
  onColor,
}: {
  emoji: string;
  color: string;
  onEmoji: (e: string) => void;
  onColor: (c: string) => void;
}) {
  const [group, setGroup] = useState(
    Math.max(
      0,
      AVATAR_GROUPS.findIndex((g) => g.emoji.includes(emoji)),
    ),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar emoji={emoji} color={color} size={48} ring />
        <div className="flex-1">
          <div className="label mb-1">Avatar</div>
          <div className="flex flex-wrap gap-1">
            {AVATAR_GROUPS.map((g, i) => (
              <button
                key={g.label}
                type="button"
                onClick={() => setGroup(i)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  group === i
                    ? "bg-grape-500/25 text-grape-200 ring-1 ring-grape-400/40"
                    : "bg-white/5 text-mist-400 hover:bg-white/10"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12">
        {AVATAR_GROUPS[group].emoji.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onEmoji(e)}
            aria-label={e}
            aria-pressed={emoji === e}
            className={`flex aspect-square items-center justify-center rounded-lg text-lg transition ${
              emoji === e ? "bg-grape-500/25 ring-1 ring-grape-400/50" : "bg-white/5 hover:bg-white/10"
            }`}
          >
            {e}
          </button>
        ))}
      </div>

      <div>
        <div className="label">Colour</div>
        <div className="flex flex-wrap gap-2">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onColor(c)}
              aria-label={`colour ${c}`}
              aria-pressed={color === c}
              className={`size-7 rounded-full transition ${
                color === c ? "ring-2 ring-white/70" : "hover:scale-110"
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
