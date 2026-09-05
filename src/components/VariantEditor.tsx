"use client";

import { useState } from "react";
import type { RatingDimension, Variant } from "@/lib/types";

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

            <VariantTagConfig variant={v} onChange={(patch) => update(i, patch)} />
          </li>
        ))}
      </ul>

      <button type="button" onClick={add} className="btn-ghost w-full text-xs">
        ＋ Add a variant
      </button>
    </div>
  );
}

/**
 * A variant's own role/identity split (§5.1/§5.2) — separate from, and takes
 * priority over, any split the game itself has. Most variants leave this at
 * "No" and just inherit whatever the game does; it exists for the case where
 * one specific way of playing is asymmetric and the rest of the game isn't
 * (Cribbage's 2-vs-1 has a Solo/Duo split; Classic 1v1 has none at all).
 */
function VariantTagConfig({
  variant,
  onChange,
}: {
  variant: Variant;
  onChange: (patch: Partial<Variant>) => void;
}) {
  const dimension: RatingDimension = variant.rating_dimension ?? "none";
  const [tagText, setTagText] = useState((variant.tag_pool ?? []).join(", "));

  const parsePool = (text: string) =>
    text
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter(Boolean);

  function setDimension(d: RatingDimension) {
    onChange({
      rating_dimension: d,
      tag_label: d === "none" ? null : variant.tag_label || "Side",
      tag_pool: d === "none" ? null : parsePool(tagText),
      tags_per_player: d === "multi-tag" ? variant.tags_per_player || 2 : 1,
    });
  }

  return (
    <div className="mt-2 rounded-lg border border-white/8 bg-ink-950/50 p-2.5">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-500">
        Rate players by role for this variant?
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { v: "none" as const, l: "No" },
            { v: "single-tag" as const, l: "One role each" },
            { v: "multi-tag" as const, l: "Several each" },
          ]
        ).map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setDimension(o.v)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              dimension === o.v
                ? "bg-sky-brand/25 text-sky-brand ring-1 ring-sky-brand/40"
                : "bg-white/5 text-mist-400 hover:bg-white/10"
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>

      {dimension !== "none" && (
        <div className="mt-2 space-y-2">
          <input
            className="input py-1 text-sm"
            aria-label={`${variant.name || "Variant"} role label`}
            placeholder="Role / Side / Faction label"
            value={variant.tag_label ?? ""}
            onChange={(e) => onChange({ tag_label: e.target.value })}
          />
          <textarea
            className="input min-h-14 py-1 text-sm"
            aria-label={`${variant.name || "Variant"} role pool`}
            placeholder="Solo, Duo"
            value={tagText}
            onChange={(e) => {
              setTagText(e.target.value);
              onChange({ tag_pool: parsePool(e.target.value) });
            }}
          />
          {dimension === "multi-tag" && (
            <label className="flex items-center gap-2 text-[11px] text-mist-400">
              per player, per game
              <input
                type="number"
                min={1}
                max={6}
                aria-label={`${variant.name || "Variant"} roles per player`}
                className="input w-16 px-2 py-1 text-center text-sm"
                value={variant.tags_per_player ?? 1}
                onChange={(e) =>
                  onChange({ tags_per_player: Math.max(1, Number(e.target.value) || 1) })
                }
              />
            </label>
          )}
          <p className="text-[11px] text-mist-400">
            Scoped to just this variant — separate from any role split on the game itself, and from
            other variants&apos; pools.
          </p>
        </div>
      )}
    </div>
  );
}

/** A sensible starting point offered for games that are usually bracketed by count. */
export const CRIBBAGE_STYLE_SUGGESTION: Variant[] = [
  { name: "Classic (1v1)", min_players: 2, max_players: 2, allows_teams: false },
  { name: "Three-handed", min_players: 3, max_players: 3, allows_teams: false },
  { name: "Partners (4)", min_players: 4, max_players: 4, allows_teams: true },
];
