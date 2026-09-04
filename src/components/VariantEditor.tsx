"use client";

import type { Variant } from "@/lib/types";

/**
 * Variants turn a game into a small folder of ways to play it (§5.4):
 * Cribbage is classic 1v1, three-handed, four-handed partners, plus whatever
 * house rules a group invents. Each keeps its own rating pool under the parent
 * game, so the leaderboard can show "Cribbage" or drill into one bracket.
 */
export function VariantEditor({
  variants,
  onChange,
  suggestion,
}: {
  variants: Variant[];
  onChange: (v: Variant[]) => void;
  suggestion?: Variant[];
}) {
  const update = (i: number, patch: Partial<Variant>) =>
    onChange(variants.map((v, j) => (i === j ? { ...v, ...patch } : v)));

  const add = () =>
    onChange([...variants, { name: "", min_players: null, max_players: null, allows_teams: false }]);

  return (
    <div className="space-y-3">
      <div>
        <div className="label mb-1">Variants</div>
        <p className="text-xs text-mist-400">
          Leave this empty unless the game genuinely plays differently. Each variant gets its own
          rating pool alongside the game&apos;s overall one, so you can ask &quot;who&apos;s best at
          Cribbage?&quot; and &quot;who&apos;s best at four-handed?&quot; separately.
        </p>
      </div>

      {variants.length === 0 && suggestion && suggestion.length > 0 && (
        <button
          type="button"
          onClick={() => onChange(suggestion)}
          className="btn-ghost w-full text-xs"
        >
          Start from a typical set ({suggestion.map((s) => s.name).join(", ")})
        </button>
      )}

      <ul className="space-y-2">
        {variants.map((v, i) => (
          <li key={i} className="rounded-xl border border-white/8 bg-ink-900/60 p-3">
            <div className="flex items-center gap-2">
              <input
                className="input flex-1"
                placeholder="Classic (1v1)"
                aria-label={`Variant ${i + 1} name`}
                value={v.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <button
                type="button"
                aria-label={`Remove ${v.name || "variant"}`}
                onClick={() => onChange(variants.filter((_, j) => j !== i))}
                className="rounded-lg px-2 py-2 text-sm text-mist-400 hover:bg-white/5 hover:text-rose-brand"
              >
                ✕
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11px] text-mist-400">
                players
                <input
                  type="number"
                  min={1}
                  max={30}
                  aria-label={`${v.name || "Variant"} minimum players`}
                  className="input w-16 px-2 py-1 text-center text-sm"
                  value={v.min_players ?? ""}
                  onChange={(e) =>
                    update(i, { min_players: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
                to
                <input
                  type="number"
                  min={1}
                  max={30}
                  aria-label={`${v.name || "Variant"} maximum players`}
                  className="input w-16 px-2 py-1 text-center text-sm"
                  value={v.max_players ?? ""}
                  onChange={(e) =>
                    update(i, { max_players: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </label>

              <label className="flex items-center gap-2 text-[11px] text-mist-400">
                <input
                  type="checkbox"
                  className="size-3.5 accent-[#8b5cf6]"
                  checked={!!v.allows_teams}
                  onChange={(e) => update(i, { allows_teams: e.target.checked })}
                />
                played in partnerships
              </label>
            </div>
          </li>
        ))}
      </ul>

      <button type="button" onClick={add} className="btn-ghost w-full text-xs">
        ＋ Add a variant
      </button>
    </div>
  );
}

/** A sensible starting point offered for games that are usually bracketed by count. */
export const CRIBBAGE_STYLE_SUGGESTION: Variant[] = [
  { name: "Classic (1v1)", min_players: 2, max_players: 2, allows_teams: false },
  { name: "Three-handed", min_players: 3, max_players: 3, allows_teams: false },
  { name: "Partners (4)", min_players: 4, max_players: 4, allows_teams: true },
];
