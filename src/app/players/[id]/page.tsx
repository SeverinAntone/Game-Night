import Link from "next/link";
import { notFound } from "next/navigation";
import { BarRow, Legend, LineChart, Radar, type Series } from "@/components/charts";
import { PlayerCardActions } from "@/components/PlayerCardActions";
import { Avatar, MEDALS, TierBadge, formatDate, relativeDate } from "@/components/ui";
import { preferenceVsPerformance } from "@/lib/bradleyterry";
import { currentPlayer } from "@/lib/auth";
import {
  currentRatings,
  getGame,
  getGames,
  getParticipantsForSessions,
  getPlayer,
  getSessions,
  headToHeadAll,
  overallComposite,
  playCounts,
  playerStats,
  trajectory,
  winRateByPlayerCount,
} from "@/lib/queries";
import { TierProgress } from "@/components/TierLadder";
import {
  PROVISIONAL_PLAYS,
  compositeTierProgress,
  tierFor,
  tierForComposite,
  uncertaintyBand,
} from "@/lib/rating";

export const dynamic = "force-dynamic";

const SERIES_COLORS = ["#a78bfa", "#fbbf24", "#34d399", "#38bdf8", "#fb7185", "#f0abfc", "#a3e635"];

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const player = getPlayer(id);
  if (!player) notFound();

  const me = await currentPlayer();
  const stats = playerStats(id);
  const composite = overallComposite().find((c) => c.player.id === id);
  const counts = playCounts();
  const games = new Map(getGames(true).map((g) => [g.id, g]));
  const ratings = currentRatings(undefined, "")
    .filter((r) => r.player_id === id)
    .map((r) => ({
      ...r,
      game: games.get(r.game_id),
      plays: counts.get(`${id}|${r.game_id}`) ?? 0,
    }))
    .filter((r) => r.game)
    .sort((a, b) => b.displayed_rating - a.displayed_rating);

  const h2h = headToHeadAll(id).filter((r) => r.meetings >= 2 || r.together >= 2);
  const byCount = winRateByPlayerCount(id);
  const sessions = getSessions(8, undefined, id);
  const partsBySession = getParticipantsForSessions(sessions.map((s) => s.id));
  const prefVsPerf = preferenceVsPerformance(id);
  // The headline tier comes from the overall composite, so it always agrees
  // with the overall number next to it (#9).
  const tier = tierForComposite(composite?.composite ?? 0, !!composite?.ranked);

  const series: Series[] = ratings.slice(0, 6).map((r, i) => ({
    label: r.game!.name,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
    points: trajectory(id, r.game_id).map((t) => ({
      x: new Date(t.played_at).getTime(),
      y: t.rating,
    })),
  }));

  return (
    <div className="space-y-6">
      {/* ---- Trading card (§10) ------------------------------------------ */}
      <article
        className="card relative overflow-hidden p-5"
        style={{
          background: `radial-gradient(120% 100% at 0% 0%, ${player.color}2e 0%, transparent 60%), rgba(18,21,34,0.75)`,
        }}
      >
        <div className="pointer-events-none absolute inset-0 shimmer opacity-40" aria-hidden />
        <div className="relative flex items-start gap-4">
          <Avatar emoji={player.emoji} color={player.color} size={72} ring />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">{player.name}</h1>
            {player.tagline && <p className="mt-0.5 text-sm italic text-mist-300">“{player.tagline}”</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TierBadge tier={tier} />
              {composite?.ranked && (
                <span className="chip">
                  overall{" "}
                  <strong className={composite.composite >= 0 ? "text-mint" : "text-rose-brand"}>
                    {composite.composite > 0 ? "+" : ""}
                    {composite.composite.toFixed(2)}
                  </strong>
                </span>
              )}
              <span className="chip">since {formatDate(player.join_date)}</span>
            </div>
          </div>
        </div>

        <div className="relative mt-4">
          <TierProgress
            tier={tier}
            progress={composite?.ranked ? compositeTierProgress(composite.composite) : 0}
            label={`${player.name} is ${tier.name}`}
          />
        </div>

        <dl className="relative mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="Plays" value={String(stats.plays)} />
          <Fact label="Wins" value={`${stats.wins} (${Math.round(stats.winRate * 100)}%)`} />
          <Fact
            label="Streak"
            value={
              stats.currentStreak.length
                ? `${stats.currentStreak.kind}${stats.currentStreak.length}`
                : "—"
            }
            accent={stats.currentStreak.kind === "W" ? "#34d399" : "#fb7185"}
          />
          <Fact label="Best win streak" value={String(stats.longestWinStreak)} />
          <Fact
            label="Favourite"
            value={stats.favoriteGame ? stats.favoriteGame.name : "—"}
            href={stats.favoriteGame ? `/games/${stats.favoriteGame.id}` : undefined}
            hint={stats.favoriteGame ? `${stats.favoriteGame.plays} plays` : undefined}
          />
          <Fact
            label="Strongest at"
            value={stats.bestGame ? stats.bestGame.name : "—"}
            href={stats.bestGame ? `/games/${stats.bestGame.id}` : undefined}
            hint={stats.bestGame ? `${Math.round(stats.bestGame.rating)} rating` : undefined}
          />
          <Fact
            label="Nemesis"
            value={stats.nemesis ? stats.nemesis.player.name : "—"}
            href={stats.nemesis ? `/players/${stats.nemesis.player.id}` : undefined}
            hint={stats.nemesis ? `${stats.nemesis.wins}–${stats.nemesis.losses}` : undefined}
            accent="#fb7185"
          />
          <Fact
            label="Favourite victim"
            value={stats.prey ? stats.prey.player.name : "—"}
            href={stats.prey ? `/players/${stats.prey.player.id}` : undefined}
            hint={stats.prey ? `${stats.prey.wins}–${stats.prey.losses}` : undefined}
            accent="#34d399"
          />
        </dl>

        {(stats.coopWins > 0 || stats.coopLosses > 0) && (
          <p className="relative mt-3 text-xs text-mist-400">
            Versus the game: {stats.coopWins}W – {stats.coopLosses}L (never rated)
          </p>
        )}
      </article>

      <PlayerCardActions player={player} isMe={me?.id === player.id} />

      {/* ---- Charts ------------------------------------------------------ */}
      {composite && composite.qualifyingGames.length >= 3 && (
        <section className="card p-4">
          <h2 className="section-title mb-1">Relative strength</h2>
          <p className="mb-2 text-xs text-mist-400">
            z-score per game — how far above or below the group&apos;s average this player sits.
          </p>
          <div className="flex justify-center">
            <Radar
              axes={composite.qualifyingGames.map((g) => ({ label: g.name, value: g.z }))}
              color={player.color}
            />
          </div>
        </section>
      )}

      {series.some((s) => s.points.length > 1) && (
        <section className="card p-4">
          <h2 className="section-title mb-2">Rating over time</h2>
          <LineChart series={series} />
          <div className="mt-2">
            <Legend series={series} />
          </div>
        </section>
      )}

      {ratings.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">Per game</h2>
          <ul className="card divide-y divide-white/5">
            {ratings.map((r) => (
              <li key={r.game_id}>
                <Link href={`/games/${r.game_id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.game!.name}</span>
                  <TierBadge tier={tierFor(r.displayed_rating, r.plays)} small />
                  <span className="hidden text-[11px] text-mist-400 sm:inline">{r.plays} plays</span>
                  <span
                    className="w-20 text-right"
                    title="How confident we are in this rating. Narrows as you play more games."
                  >
                    <span className="font-display font-extrabold tabular-nums">
                      {Math.round(r.displayed_rating)}
                    </span>
                    <span className="ml-1 text-[11px] tabular-nums text-mist-400">
                      ±{uncertaintyBand({ mu: r.mu, sigma: r.sigma })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {byCount.length > 1 && (
        <section className="card p-4">
          <h2 className="section-title mb-3">Win rate by table size</h2>
          <div className="space-y-2">
            {byCount.map((b) => (
              <BarRow
                key={b.field}
                label={`${b.field} players`}
                value={b.plays ? b.wins / b.plays : 0}
                max={1}
                caption={`${b.wins}/${b.plays}`}
                color={player.color}
              />
            ))}
          </div>
        </section>
      )}

      {h2h.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">Rivalries</h2>
          <ul className="card divide-y divide-white/5">
            {h2h.map((r) => {
              const total = r.wins + r.losses + r.ties || 1;
              return (
                <li key={r.opponent.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar emoji={r.opponent.emoji} color={r.opponent.color} size={28} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/players/${r.opponent.id}`} className="block truncate text-sm font-semibold">
                      {r.opponent.name}
                    </Link>
                    <span className="text-[11px] text-mist-400">
                      {r.meetings > 0
                        ? `${r.meetings} head-to-head`
                        : "never on opposite sides"}
                      {r.decisiveWins + r.decisiveLosses > 0 &&
                        ` · ${r.decisiveWins}–${r.decisiveLosses} when one of you won outright`}
                      {r.together > 0 && ` · ${r.together} as teammates (${r.togetherWins}W)`}
                    </span>
                  </div>
                  {r.meetings > 0 && (
                    <>
                      <div className="hidden h-2 w-28 overflow-hidden rounded-full bg-rose-brand/40 sm:flex">
                        <div className="h-full bg-mint" style={{ width: `${(r.wins / total) * 100}%` }} />
                        <div className="h-full bg-ink-500" style={{ width: `${(r.ties / total) * 100}%` }} />
                      </div>
                      <span className="w-20 text-right text-sm tabular-nums">
                        <span className="font-bold text-mint">{r.wins}</span>
                        <span className="text-mist-400"> – </span>
                        <span className="font-bold text-rose-brand">{r.losses}</span>
                        {r.ties > 0 && <span className="text-[11px] text-mist-400"> ·{r.ties}T</span>}
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-mist-400">
            A win means you finished ahead of them — 2nd against their 3rd counts, the same way the
            rating engine reads it. &quot;Won outright&quot; narrows that to nights one of you
            actually took first. Sharing a team in Codenames or a side in Avalon is tallied
            separately rather than as a draw, and co-op nights never count.
          </p>
        </section>
      )}

      {prefVsPerf && (
        <section className="card p-4">
          <h2 className="section-title mb-1">Preference vs. performance</h2>
          <p className="text-xs text-mist-400">
            Spearman ρ ={" "}
            <strong className={prefVsPerf.rho >= 0 ? "text-mint" : "text-rose-brand"}>
              {prefVsPerf.rho.toFixed(2)}
            </strong>{" "}
            across {prefVsPerf.n} games —{" "}
            {prefVsPerf.rho > 0.3
              ? "they like the games they're good at."
              : prefVsPerf.rho < -0.3
                ? "they love the games that beat them. Respect."
                : "no real link between taste and results."}
          </p>
          <ul className="mt-3 space-y-1.5">
            {prefVsPerf.points.map((p) => (
              <li key={p.name} className="flex items-center gap-3 text-sm">
                <span className="w-6 text-center text-xs tabular-nums text-mist-400">#{p.prefRank}</span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="text-xs tabular-nums text-mist-400">
                  {Math.round(p.winRate * 100)}% over {p.plays}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="section-title">Recent sessions</h2>
        <ul className="space-y-2">
          {sessions.map((s) => {
            const parts = partsBySession.get(s.id) ?? [];
            const mine = parts.find((p) => p.player_id === id);
            const game = getGame(s.game_id);
            return (
              <li key={s.id}>
                <Link href={`/session/${s.id}`} className="card card-hover flex items-center gap-3 px-3 py-2.5">
                  <span className="w-7 text-center text-lg">
                    {s.coop_result
                      ? s.coop_result === "win"
                        ? "🏅"
                        : "💀"
                      : (MEDALS[(mine?.placement ?? 9) - 1] ?? `${mine?.placement}`)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{game?.name}</span>
                  {mine?.score != null && (
                    <span className="text-xs tabular-nums text-mist-400">{mine.score} pts</span>
                  )}
                  <span className="text-[11px] text-mist-400">{relativeDate(s.played_at)}</span>
                </Link>
              </li>
            );
          })}
          {sessions.length === 0 && <p className="text-sm text-mist-400">No sessions yet.</p>}
        </ul>
      </section>
    </div>
  );
}

function Fact({
  label,
  value,
  hint,
  href,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  accent?: string;
}) {
  const body = (
    <>
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-mist-400">{label}</dt>
      <dd className="truncate font-display text-sm font-extrabold" style={accent ? { color: accent } : undefined}>
        {value}
      </dd>
      {hint && <dd className="text-[11px] text-mist-400">{hint}</dd>}
    </>
  );
  return href ? (
    <Link href={href} className="min-w-0 rounded-lg bg-white/4 px-3 py-2 transition hover:bg-white/8">
      {body}
    </Link>
  ) : (
    <div className="min-w-0 rounded-lg bg-white/4 px-3 py-2">{body}</div>
  );
}
