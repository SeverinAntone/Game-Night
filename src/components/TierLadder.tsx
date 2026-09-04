import { Avatar } from "./ui";
import { PROVISIONAL_TIER, TIERS, tierRung, type Tier } from "@/lib/rating";
import type { Player } from "@/lib/types";

export interface LadderEntry {
  player: Player;
  tier: Tier;
  /** The number behind the placement — a composite z, or a game rating. */
  value: string;
  ranked: boolean;
}

/**
 * The tier ladder, made visible (#9). Every rung is shown even when empty, so
 * it reads as a ladder someone can climb rather than a list of labels — and
 * you can see at a glance who is bunched where.
 */
export function TierLadder({
  entries,
  caption,
  highlightPlayerId,
}: {
  entries: LadderEntry[];
  caption?: string;
  highlightPlayerId?: number;
}) {
  const unranked = entries.filter((e) => !e.ranked);
  const rungs = TIERS.map((tier, i) => ({
    tier,
    // Top rung first: climbing goes up the page.
    players: entries.filter((e) => e.ranked && tierRung(e.tier) === i),
  })).reverse();

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="section-title">The ladder</h2>
        {caption ? <span className="text-[11px] text-mist-400">{caption}</span> : null}
      </div>

      <ol className="space-y-1.5">
        {rungs.map(({ tier, players }) => (
          <li
            key={tier.name}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${
              players.length ? "" : "opacity-45"
            }`}
            style={{
              background: players.length ? `${tier.color}12` : "rgba(255,255,255,0.02)",
              boxShadow: players.length ? `inset 3px 0 0 0 ${tier.color}` : undefined,
            }}
          >
            <span className="w-6 text-center text-lg" aria-hidden>
              {tier.emoji}
            </span>
            <span
              className="w-32 shrink-0 truncate text-xs font-bold uppercase tracking-wider"
              style={{ color: tier.color }}
            >
              {tier.name}
            </span>
            <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {players.map((e) => (
                <li
                  key={e.player.id}
                  className={`flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 text-xs font-semibold ${
                    e.player.id === highlightPlayerId
                      ? "bg-white/15 ring-1 ring-white/30"
                      : "bg-white/6"
                  }`}
                >
                  <Avatar emoji={e.player.emoji} color={e.player.color} size={20} />
                  <span className="max-w-24 truncate">{e.player.name}</span>
                  <span className="tabular-nums text-mist-400">{e.value}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      {unranked.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-mist-400">
          <span className="mr-1">
            {PROVISIONAL_TIER.emoji} {PROVISIONAL_TIER.name} —
          </span>
          {unranked.map((e) => (
            <span key={e.player.id} className="chip px-1.5 py-0 text-[10px]">
              {e.player.emoji} {e.player.name}
            </span>
          ))}
          <span className="w-full">Still short of 3 plays in a shared game.</span>
        </p>
      )}
    </div>
  );
}

/** Compact single-player version for the profile card. */
export function TierProgress({
  tier,
  progress,
  label,
}: {
  tier: Tier;
  progress: number;
  label: string;
}) {
  const rung = tierRung(tier);
  const next = TIERS[rung + 1];
  return (
    <div>
      <div className="flex items-end justify-between text-[11px]">
        <span className="font-semibold" style={{ color: tier.color }}>
          {tier.emoji} {tier.name}
        </span>
        <span className="text-mist-400">
          {next ? `next: ${next.emoji} ${next.name}` : "top of the ladder"}
        </span>
      </div>
      <div className="mt-1.5 flex gap-1" role="img" aria-label={label}>
        {TIERS.map((t, i) => (
          <div
            key={t.name}
            className="h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ background: i <= rung ? `${tier.color}33` : "rgba(255,255,255,0.07)" }}
          >
            {i === rung && (
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.round(progress * 100)}%`, background: tier.color }}
              />
            )}
            {i < rung && <div className="h-full rounded-full" style={{ background: tier.color }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
