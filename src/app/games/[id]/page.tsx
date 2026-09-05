import Link from "next/link";
import { notFound } from "next/navigation";
import { GameConfigEditor } from "@/components/GameConfigEditor";
import { BarRow, Legend, LineChart, type Series } from "@/components/charts";
import { Avatar, Empty, MEDALS, PageHeader, TierBadge, relativeDate } from "@/components/ui";
import {
  coopByDifficulty,
  comboStats,
  gameLeaderboard,
  getGame,
  getParticipantsForSessions,
  getSessions,
  highScores,
  tagRatings,
  trajectory,
  variantPlayCounts,
} from "@/lib/queries";
import { SCORING_MODE_LABELS, gameVariants, tagPool } from "@/lib/types";

export const dynamic = "force-dynamic";

const SERIES_COLORS = ["#a78bfa", "#fbbf24", "#34d399", "#38bdf8", "#fb7185", "#f0abfc", "#a3e635"];

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const game = getGame(id);
  if (!game) notFound();

  const board = gameLeaderboard(id);
  const sessions = getSessions(12, id);
  const partsBySession = getParticipantsForSessions(sessions.map((s) => s.id));
  const scores = game.tracks_score ? highScores(id, 8) : [];
  const tags = game.rating_dimension !== "none" ? tagRatings(id) : [];
  const combos = game.rating_dimension === "multi-tag" ? comboStats(id) : [];
  const coop = game.scoring_mode === "coop-vs-game" ? coopByDifficulty(id) : [];
  const pool = tagPool(game);
  const variants = gameVariants(game);
  const variantPlays = new Map(variantPlayCounts(id).map((v) => [v.variant, v.plays]));

  const series: Series[] = board.slice(0, 7).map((r, i) => ({
    label: r.player.name,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
    points: trajectory(r.player.id, id).map((t) => ({
      x: new Date(t.played_at).getTime(),
      y: t.rating,
    })),
  }));

  const coopTotals = coop.reduce(
    (a, c) => ({ plays: a.plays + c.plays, wins: a.wins + c.wins }),
    { plays: 0, wins: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        {game.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={game.thumbnail} alt="" className="size-20 shrink-0 rounded-2xl object-cover" />
        ) : (
          <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-4xl">
            🎲
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">{game.name}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="chip">{SCORING_MODE_LABELS[game.scoring_mode]}</span>
            {!!game.tracks_score && (
              <span className="chip">{game.high_score_wins ? "high score wins" : "low score wins"}</span>
            )}
            {game.rating_dimension !== "none" && (
              <span className="chip text-sky-brand">
                {game.rating_dimension === "single-tag" ? "one" : `${game.tags_per_player}`}{" "}
                {(game.tag_label ?? "tag").toLowerCase()}
                {game.rating_dimension === "single-tag" ? "" : "s"} per player
              </span>
            )}
            {game.result_mode === "winner-only" && (
              <span className="chip">winner takes it</span>
            )}
            {!game.rated && <span className="chip text-amber-brand">not rated</span>}
            {!!game.tracks_difficulty && <span className="chip">difficulty tracked</span>}
            {!!game.bgg_id && (
              <a
                className="chip hover:bg-white/10"
                href={`https://boardgamegeek.com/boardgame/${game.bgg_id}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                BGG ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {game.scoring_mode === "coop-vs-game" ? (
        <section className="space-y-3">
          <h2 className="section-title">Versus the game</h2>
          <div className="card p-4">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-3xl font-extrabold tabular-nums">
                {coopTotals.plays ? Math.round((coopTotals.wins / coopTotals.plays) * 100) : 0}%
              </span>
              <span className="text-sm text-mist-400">
                win rate over {coopTotals.plays} attempt{coopTotals.plays === 1 ? "" : "s"}
              </span>
            </div>
            {coop.length > 0 && (
              <div className="mt-4 space-y-2">
                {coop.map((c) => (
                  <BarRow
                    key={c.difficulty}
                    label={c.difficulty}
                    value={c.plays ? c.wins / c.plays : 0}
                    max={1}
                    caption={`${c.wins}/${c.plays}`}
                    color="#34d399"
                  />
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-mist-400">
              Co-op plays are logged for streaks and difficulty stats. They never touch anyone&apos;s
              rating — there&apos;s no opposing skill to measure.
            </p>
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Standings</h2>
            <Link href={`/leaderboard?game=${id}`} className="text-xs font-semibold text-grape-300">
              Full board →
            </Link>
          </div>
          {board.length === 0 ? (
            <Empty icon="📉" title="No ratings yet" body="Log a session to start the pool." action={{ href: "/play", label: "Log a session" }} />
          ) : (
            <ol className="space-y-2">
              {board.slice(0, 6).map((r, i) => (
                <li key={r.player.id}>
                  <Link href={`/players/${r.player.id}`} className="card card-hover flex items-center gap-3 p-3">
                    <span className="w-6 text-center font-display font-extrabold tabular-nums text-mist-400">
                      {MEDALS[i] ?? i + 1}
                    </span>
                    <Avatar emoji={r.player.emoji} color={r.player.color} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{r.player.name}</div>
                      <TierBadge tier={r.tier} small />
                    </div>
                    <div className="text-right">
                      <div className="font-display font-extrabold tabular-nums">
                        {Math.round(r.rating)}
                      </div>
                      <div className="text-[11px] text-mist-400">
                        {r.wins}/{r.plays}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}

          {series.some((s) => s.points.length > 1) && (
            <div className="card p-4">
              <h3 className="section-title mb-2">Rating over time</h3>
              <LineChart series={series} />
              <div className="mt-2">
                <Legend series={series} />
              </div>
            </div>
          )}
        </section>
      )}

      {variants.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-title">Ways of playing</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {variants.map((v) => {
              const board = gameLeaderboard(id, "", v.name);
              const plays = variantPlays.get(v.name) ?? 0;
              const variantTagged = (v.rating_dimension ?? "none") !== "none";
              const variantTags = variantTagged ? tagRatings(id, v.name) : [];
              const variantPool = v.tag_pool ?? [];
              return (
                <div key={v.name} className="card p-4">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="font-display font-bold">{v.name}</span>
                    <Link
                      href={`/leaderboard?game=${id}&variant=${encodeURIComponent(v.name)}`}
                      className="text-[11px] font-semibold text-grape-300"
                    >
                      board →
                    </Link>
                  </div>
                  <div className="mb-2 text-[11px] text-mist-400">
                    {[
                      v.min_players && v.max_players
                        ? v.min_players === v.max_players
                          ? `${v.min_players} players`
                          : `${v.min_players}–${v.max_players} players`
                        : null,
                      v.allows_teams ? "partnerships" : null,
                      variantTagged ? `by ${(v.tag_label ?? "side").toLowerCase()}` : null,
                      `${plays} play${plays === 1 ? "" : "s"}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {board.length === 0 ? (
                    <p className="text-xs text-mist-400">Not played yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {board.slice(0, 5).map((r) => (
                        <li key={r.player.id} className="flex items-center gap-2 text-sm">
                          <Avatar emoji={r.player.emoji} color={r.player.color} size={22} />
                          <span className="min-w-0 flex-1 truncate">{r.player.name}</span>
                          <span className="text-[11px] text-mist-400">
                            {r.wins}/{r.plays}
                          </span>
                          <span className="w-12 text-right font-semibold tabular-nums">
                            {Math.round(r.rating)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {variantTagged && variantTags.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-white/8 pt-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
                        By {(v.tag_label ?? "side").toLowerCase()}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {variantPool.map((t) => {
                          const rows = variantTags.filter((r) => r.tag === t);
                          if (!rows.length) return null;
                          return (
                            <div key={t}>
                              <div className="mb-1 flex items-center justify-between">
                                <span className="text-xs font-bold text-sky-brand">{t}</span>
                                <Link
                                  href={`/leaderboard?game=${id}&variant=${encodeURIComponent(v.name)}&tag=${encodeURIComponent(t)}`}
                                  className="text-[11px] font-semibold text-grape-300"
                                >
                                  board →
                                </Link>
                              </div>
                              <ul className="space-y-1">
                                {rows.slice(0, 5).map((r) => (
                                  <li key={r.player.id} className="flex items-center gap-2 text-sm">
                                    <Avatar emoji={r.player.emoji} color={r.player.color} size={20} />
                                    <span className="min-w-0 flex-1 truncate">{r.player.name}</span>
                                    <span className="text-[11px] text-mist-400">
                                      {r.wins}/{r.plays}
                                    </span>
                                    <span className="w-12 text-right font-semibold tabular-nums">
                                      {Math.round(r.rating)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-mist-400">
            Every session still counts toward {game.name} overall — a variant is a second, narrower
            pool, not a separate game. Sessions logged as &quot;Unspecified&quot; only count toward
            the overall pool.
          </p>
        </section>
      )}

      {tags.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-title">
            By {(game.tag_label ?? "tag").toLowerCase()}
            {game.rating_dimension === "multi-tag" ? " (analytics only — not on the main board)" : ""}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {pool.map((t) => {
              const rows = tags.filter((r) => r.tag === t);
              if (!rows.length) return null;
              return (
                <div key={t} className="card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-display font-bold text-sky-brand">{t}</span>
                    {game.rating_dimension === "single-tag" && (
                      <Link
                        href={`/leaderboard?game=${id}&tag=${encodeURIComponent(t)}`}
                        className="text-[11px] font-semibold text-grape-300"
                      >
                        board →
                      </Link>
                    )}
                  </div>
                  <ul className="space-y-1.5">
                    {rows.slice(0, 6).map((r) => (
                      <li key={r.player.id} className="flex items-center gap-2 text-sm">
                        <Avatar emoji={r.player.emoji} color={r.player.color} size={22} />
                        <span className="min-w-0 flex-1 truncate">{r.player.name}</span>
                        <span className="text-[11px] text-mist-400">
                          {r.wins}/{r.plays}
                        </span>
                        <span className="w-12 text-right font-semibold tabular-nums">
                          {Math.round(r.rating)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          {game.rating_dimension === "single-tag" && (
            <p className="text-xs text-mist-400">
              Each {(game.tag_label ?? "tag").toLowerCase()} is its own pool, so a rarely-drawn side
              keeps a higher uncertainty for longer — the engine says &quot;we don&apos;t know yet&quot;
              instead of guessing.
            </p>
          )}
        </section>
      )}

      {combos.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-title">Combos that actually work</h2>
          <div className="card space-y-2 p-4">
            {combos.slice(0, 10).map((c) => (
              <BarRow
                key={c.combo.join("+")}
                label={c.combo.join(" + ")}
                value={c.wins / c.plays}
                max={1}
                caption={`${c.wins}/${c.plays}`}
                color="#38bdf8"
              />
            ))}
            <p className="pt-1 text-xs text-mist-400">
              Combos are an analytics question, not a rating one — there are far too many pairs to
              ever gather meaningful per-combo data.
            </p>
          </div>
        </section>
      )}

      {scores.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-title">High scores</h2>
          <ol className="card divide-y divide-white/5">
            {scores.map((s, i) => (
              <li key={`${s.session_id}-${s.player_id}`} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-6 text-center text-sm tabular-nums text-mist-400">{i + 1}</span>
                <span className="text-lg">{s.emoji}</span>
                <Link href={`/players/${s.player_id}`} className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {s.name}
                </Link>
                <Link href={`/session/${s.session_id}`} className="text-[11px] text-mist-400">
                  {relativeDate(s.played_at)}
                </Link>
                <span className="w-16 text-right font-display font-extrabold tabular-nums">
                  {s.score}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="section-title">Recent plays</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-mist-400">Never played. Rectify that.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => {
              const parts = partsBySession.get(s.id) ?? [];
              const winners = parts.filter((p) => p.placement === 1);
              return (
                <li key={s.id}>
                  <Link href={`/session/${s.id}`} className="card card-hover flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1 text-sm">
                      <span className="font-semibold">
                        {s.coop_result
                          ? s.coop_result === "win"
                            ? "🏅 beat the game"
                            : "💀 lost"
                          : `🥇 ${winners.map((w) => w.name).join(" & ")}`}
                      </span>
                      <span className="text-mist-400"> · {parts.length} players</span>
                    </div>
                    <span className="text-[11px] text-mist-400">{relativeDate(s.played_at)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <GameConfigEditor game={game} />
    </div>
  );
}
