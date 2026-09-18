import Link from "next/link";
import { TierLadder, type LadderEntry } from "@/components/TierLadder";
import { Sparkline } from "@/components/charts";
import { Avatar, Empty, MEDALS, PageHeader, TierBadge } from "@/components/ui";
import { gameLeaderboard, getGames, overallComposite, trajectory } from "@/lib/queries";
import { PROVISIONAL_PLAYS, tierFor, tierForComposite, uncertaintyBand } from "@/lib/rating";
import { effectiveConfig, gameVariants } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * One filterable leaderboard (§4). Overall is a composite of per-game z-scores,
 * never a pooled average — raw mu isn't comparable across games. A role
 * sub-filter appears only for `single-tag` games (§5.1).
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; tag?: string; variant?: string }>;
}) {
  const sp = await searchParams;
  const games = getGames();
  const gameId = sp.game ? Number(sp.game) : null;
  const game = games.find((g) => g.id === gameId) ?? null;
  const variants = game ? gameVariants(game) : [];
  const variant = variants.some((v) => v.name === sp.variant) ? sp.variant! : "";
  // A variant with its own role split takes over from the game's — same rule
  // as everywhere else this is resolved (SessionEntry, recompute).
  const config = game ? effectiveConfig(game, variant || null) : null;
  const tag = config?.rating_dimension === "single-tag" ? (sp.tag ?? "") : "";
  // Tag pools are keyed by whichever level they actually belong to — the
  // variant's own name if the split is scoped there, '' if it's the game's
  // (which may still be viewed while a variant with no split of its own is
  // selected) — not necessarily the variant the page is currently filtered
  // to. The plain combined board, with no tag, always uses the raw variant.
  const poolVariant = tag ? (config?.tagPoolVariant ?? "") : variant;

  const rows = game ? gameLeaderboard(game.id, tag, poolVariant) : [];
  const composite = game ? [] : overallComposite();
  const variantQS = variant ? `&variant=${encodeURIComponent(variant)}` : "";
  // Nobody in this pool has enough plays to trust the order yet — a podium
  // here would present a coin-flip as a settled result (see the Golf case).
  const allProvisional = rows.length > 0 && rows.every((r) => r.provisional);
  const rankedComposite = composite.filter((c) => c.ranked);
  const allCompositeProvisional =
    rankedComposite.length > 0 && rankedComposite.every((c) => c.provisional);

  const ladder: LadderEntry[] = game
    ? rows.map((r) => ({
        player: r.player,
        tier: r.tier,
        value: String(Math.round(r.rating)),
        ranked: !r.provisional,
      }))
    : composite.map((c) => ({
        player: c.player,
        tier: tierForComposite(c.composite, c.ranked),
        value: `${c.composite > 0 ? "+" : ""}${c.composite.toFixed(2)}`,
        ranked: c.ranked,
      }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leaderboard"
        subtitle={
          game
            ? tag
              ? `${game.name} · ${tag} pool`
              : variant
                ? `${game.name} · ${variant}`
                : game.name
            : "Composite of every player's z-score across the games they've played 3+ times."
        }
      />

      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        <FilterChip href="/leaderboard" active={!game} label="Overall" />
        {games.map((g) => (
          <FilterChip
            key={g.id}
            href={`/leaderboard?game=${g.id}`}
            active={game?.id === g.id}
            label={g.name}
          />
        ))}
      </nav>

      {variants.length > 0 && game && (
        <nav className="flex flex-wrap gap-2">
          <FilterChip
            href={`/leaderboard?game=${game.id}`}
            active={!variant}
            label={`All of ${game.name}`}
            small
          />
          {variants.map((v) => (
            <FilterChip
              key={v.name}
              href={`/leaderboard?game=${game.id}&variant=${encodeURIComponent(v.name)}`}
              active={variant === v.name}
              label={v.name}
              small
            />
          ))}
        </nav>
      )}

      {config?.rating_dimension === "single-tag" && (
        <nav className="flex flex-wrap gap-2">
          <FilterChip
            href={`/leaderboard?game=${game!.id}${variantQS}`}
            active={!tag}
            label={`All ${config.tag_label?.toLowerCase() ?? "role"}s`}
            small
          />
          {(config.tag_pool ?? []).map((t) => (
            <FilterChip
              key={t}
              href={`/leaderboard?game=${game!.id}${variantQS}&tag=${encodeURIComponent(t)}`}
              active={tag === t}
              label={t}
              small
            />
          ))}
        </nav>
      )}

      {ladder.length > 0 && (
        <TierLadder
          entries={ladder}
          caption={
            game
              ? tag
                ? `${game.name} · ${tag} rating`
                : variant
                  ? `${game.name} · ${variant} rating`
                  : `${game.name} rating`
              : "by composite z-score"
          }
        />
      )}

      {config?.rating_dimension === "multi-tag" && (
        <p className="card px-4 py-3 text-xs text-mist-400">
          Per-{(config.tag_label ?? "tag").toLowerCase()} ratings for {game!.name} live on its{" "}
          <Link href={`/games/${game!.id}`} className="font-semibold text-grape-300">
            analytics page
          </Link>{" "}
          — the main board stays one row per player.
        </p>
      )}

      {game ? (
        rows.length === 0 ? (
          <Empty
            icon="📉"
            title="No ratings in this pool yet"
            body={
              game.scoring_mode === "coop-vs-game"
                ? "Co-op games are never rated — check the game page for win rates by difficulty instead."
                : "Log a session with two or more players and this fills in."
            }
            action={{ href: "/play", label: "Log a session" }}
          />
        ) : (
          <>
            {allProvisional && (
              <p className="card px-4 py-3 text-xs text-mist-400">
                Everyone here is still under {PROVISIONAL_PLAYS} plays — too early to call this a
                ranking. Ratings and ± bands below are real; the podium isn&apos;t, yet.
              </p>
            )}
            <ol className="space-y-2">
            {rows.map((r, i) => {
              const traj = trajectory(r.player.id, game.id, tag, poolVariant)
                .slice(-12)
                .map((t) => t.rating);
              return (
                <li key={r.player.id}>
                  <Link href={`/players/${r.player.id}`} className="card card-hover flex items-center gap-3 p-3">
                    <span className="w-7 text-center font-display text-base font-extrabold tabular-nums text-mist-400">
                      {allProvisional ? "•" : (MEDALS[i] ?? i + 1)}
                    </span>
                    <Avatar emoji={r.player.emoji} color={r.player.color} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{r.player.name}</span>
                        {r.provisional && (
                          <span className="chip px-1.5 py-0 text-[10px] text-amber-brand">
                            provisional
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <TierBadge tier={r.tier} small />
                        <span className="text-[11px] text-mist-400">
                          {r.plays} plays · {Math.round(r.winRate * 100)}% wins
                        </span>
                      </div>
                    </div>
                    <div className="hidden sm:block">
                      <Sparkline values={traj} />
                    </div>
                    <div className="text-right" title="How confident we are in this rating. Narrows as you play more games.">
                      <div className="font-display text-lg font-extrabold tabular-nums">
                        {Math.round(r.rating)}
                      </div>
                      <div className="text-[11px] tabular-nums text-mist-400">
                        ±{uncertaintyBand({ mu: r.mu, sigma: r.sigma })}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
            </ol>
          </>
        )
      ) : composite.filter((c) => c.ranked).length === 0 ? (
        <Empty
          icon="🧮"
          title="Nobody qualifies yet"
          body="A player joins the composite once they have 3+ plays in a game that at least two people have played."
          action={{ href: "/play", label: "Log a session" }}
        />
      ) : (
        <>
          {allCompositeProvisional && (
            <p className="card px-4 py-3 text-xs text-mist-400">
              Nobody has {PROVISIONAL_PLAYS}+ plays in any single game yet — too early to call this
              a ranking. Composites below are real; the podium isn&apos;t, yet.
            </p>
          )}
          <ol className="space-y-2">
          {composite
            .filter((c) => c.ranked)
            .map((c, i) => (
              <li key={c.player.id}>
                <Link href={`/players/${c.player.id}`} className="card card-hover block p-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 text-center font-display text-base font-extrabold tabular-nums text-mist-400">
                      {allCompositeProvisional ? "•" : (MEDALS[i] ?? i + 1)}
                    </span>
                    <Avatar emoji={c.player.emoji} color={c.player.color} size={38} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{c.player.name}</div>
                      <div className="text-[11px] text-mist-400">
                        {c.qualifyingGames.length} qualifying games · {c.totalPlays} plays
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="font-display text-lg font-extrabold tabular-nums"
                        style={{ color: c.composite >= 0 ? "#34d399" : "#fb7185" }}
                      >
                        {c.composite > 0 ? "+" : ""}
                        {c.composite.toFixed(2)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-mist-400">
                        avg z-score
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 pl-10">
                    {c.qualifyingGames.slice(0, 4).map((g) => (
                      <span key={g.game_id} className="chip px-2 py-0.5 text-[10px]">
                        {g.name}{" "}
                        <span className={g.z >= 0 ? "text-mint" : "text-rose-brand"}>
                          {g.z > 0 ? "+" : ""}
                          {g.z.toFixed(2)}
                        </span>
                      </span>
                    ))}
                    {c.qualifyingGames.length > 4 && (
                      <span className="chip px-2 py-0.5 text-[10px]">
                        +{c.qualifyingGames.length - 4} more
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}

      {!game && composite.some((c) => !c.ranked) && (
        <p className="text-xs text-mist-400">
          Still warming up:{" "}
          {composite
            .filter((c) => !c.ranked)
            .map((c) => c.player.name)
            .join(", ")}{" "}
          — 3 plays in a shared game and they&apos;re on the board.
        </p>
      )}

      <details className="card px-4 py-3 text-sm text-mist-300">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-mist-400">
          How the numbers work
        </summary>
        <div className="mt-3 space-y-2 text-[13px] leading-relaxed">
          <p>
            Each game keeps its own OpenSkill rating per player: a skill estimate (μ) and an
            uncertainty (σ). The number shown is μ alone, scaled up to read like a familiar
            4-digit score. The smaller ± number next to it is σ — how confident the system is in
            that estimate. It narrows as you play more games, but never changes the score itself.
          </p>
          <p>
            Only finishing order feeds the engine. Scores are stored for personal bests and
            high-score charts, never for rating.
          </p>
          <p>
            Overall is the average of a player&apos;s z-scores across games with 3+ plays. A z of
            +1.5 means &quot;one and a half standard deviations above this group&apos;s average in
            that specific game&quot; — which compares across games in a way raw μ never can.
          </p>
          <p>Pure co-op games never affect anyone&apos;s rating. There&apos;s no opposing skill to measure.</p>
          <p>
            Tiers: {tierFor(0, 0).emoji} Shrinkwrapped (under {PROVISIONAL_PLAYS} plays) → 🧃 Cardboard Cadet → 🚶
            Meeple Mover → ⚖️ Rules Lawyer → ⚙️ Engine Builder → 🪄 Combo Merchant → 👑 Table
            Tyrant → 🛸 Cardboard Deity.
          </p>
        </div>
      </details>
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
  small,
}: {
  href: string;
  active: boolean;
  label: string;
  small?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 whitespace-nowrap rounded-full border font-semibold transition ${
        small ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"
      } ${
        active
          ? "border-grape-400/60 bg-grape-500/20 text-grape-100"
          : "border-white/10 bg-white/5 text-mist-300 hover:bg-white/10"
      }`}
    >
      {label}
    </Link>
  );
}
