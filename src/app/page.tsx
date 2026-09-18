import Link from "next/link";
import { Heatmap } from "@/components/charts";
import { Avatar, Empty, MEDALS, PageHeader, Stat, relativeDate } from "@/components/ui";
import {
  biggestUpsets,
  dashboardSummary,
  getGames,
  getParticipantsForSessions,
  getPlayers,
  getSessions,
  mostImproved,
  nightHeatmap,
  overallComposite,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function Home() {
  const summary = dashboardSummary();
  const players = getPlayers();
  const games = getGames();
  const sessions = getSessions(6);
  const partsBySession = getParticipantsForSessions(sessions.map((s) => s.id));
  const composite = overallComposite().filter((c) => c.ranked).slice(0, 3);
  // Same rule as the leaderboard: don't hand out a podium for a table where
  // nobody has enough plays anywhere to actually trust the order.
  const compositeAllProvisional = composite.length > 0 && composite.every((c) => c.provisional);
  const improved = mostImproved(90, 3);
  const upsets = biggestUpsets(1);
  const heat = nightHeatmap(200);

  if (players.length === 0 || games.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Welcome to game night" subtitle="Two quick bits of setup and you're logging." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/players" className="card card-hover p-5">
            <div className="text-3xl">🃏</div>
            <div className="mt-2 font-display text-lg font-bold">
              1. Add the regulars {players.length > 0 && "✓"}
            </div>
            <p className="mt-1 text-sm text-mist-400">
              Name and an emoji each. PINs are optional and only guard personal pages.
            </p>
          </Link>
          <Link href="/games/new" className="card card-hover p-5">
            <div className="text-3xl">🎲</div>
            <div className="mt-2 font-display text-lg font-bold">
              2. Add a game {games.length > 0 && "✓"}
            </div>
            <p className="mt-1 text-sm text-mist-400">
              The wizard asks a few questions once, so logging stays fast forever after.
            </p>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Game night"
        subtitle={
          summary.lastPlayed
            ? `Last played ${relativeDate(summary.lastPlayed)} · ${summary.last30} sessions in the last 30 days`
            : "No sessions logged yet — go make some history."
        }
        action={
          <Link href="/play" className="btn-primary hidden md:inline-flex">
            ➕ Log a session
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Sessions" value={summary.sessions} />
        <Stat label="Games" value={summary.games} />
        <Stat label="Players" value={summary.players} />
        <Stat
          label="Last 30 days"
          value={summary.last30}
          accent={summary.last30 > 0 ? "#34d399" : undefined}
        />
      </div>

      {composite.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="section-title">Top of the table</h2>
            <Link href="/leaderboard" className="text-xs font-semibold text-grape-300">
              Full leaderboard →
            </Link>
          </div>
          {compositeAllProvisional && (
            <p className="card mb-2 px-4 py-3 text-xs text-mist-400">
              Too early to call this a ranking — nobody has enough plays anywhere yet.
            </p>
          )}
          <ul className="grid gap-2 sm:grid-cols-3">
            {composite.map((c, i) => (
              <li key={c.player.id}>
                <Link href={`/players/${c.player.id}`} className="card card-hover flex items-center gap-3 p-3">
                  <span className="text-xl">{compositeAllProvisional ? "•" : MEDALS[i]}</span>
                  <Avatar emoji={c.player.emoji} color={c.player.color} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.player.name}</span>
                    <span className="block text-[11px] text-mist-400">
                      {c.qualifyingGames.length} rated games
                    </span>
                  </span>
                  <span className="font-display text-lg font-extrabold tabular-nums text-grape-300">
                    {c.composite > 0 ? "+" : ""}
                    {c.composite.toFixed(2)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="section-title">Recent sessions</h2>
          <Link href="/sessions" className="text-xs font-semibold text-grape-300">
            History →
          </Link>
        </div>
        {sessions.length === 0 ? (
          <Empty
            icon="🎲"
            title="Nothing logged yet"
            body="Log your first session and the ratings engine wakes up."
            action={{ href: "/play", label: "Log a session" }}
          />
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => {
              const parts = partsBySession.get(s.id) ?? [];
              const winners = parts.filter((p) => p.placement === 1);
              return (
                <li key={s.id}>
                  <Link href={`/session/${s.id}`} className="card card-hover flex items-center gap-3 p-3">
                    {s.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.thumbnail} alt="" className="size-11 rounded-lg object-cover" />
                    ) : (
                      <span className="flex size-11 items-center justify-center rounded-lg bg-white/5 text-xl">
                        🎲
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{s.game_name}</div>
                      <div className="truncate text-xs text-mist-400">
                        {s.coop_result
                          ? s.coop_result === "win"
                            ? "🏅 beat the game"
                            : "💀 lost to the game"
                          : `🥇 ${winners.map((w) => w.name).join(" & ") || "—"}`}
                        {" · "}
                        {parts.length} players · {relativeDate(s.played_at)}
                      </div>
                    </div>
                    <div className="flex -space-x-2">
                      {parts.slice(0, 4).map((p) => (
                        <Avatar key={p.id} emoji={p.emoji} color={p.color} size={26} ring />
                      ))}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {improved.length > 0 && (
          <section className="card p-4">
            <h2 className="section-title mb-3">Most improved (90 days)</h2>
            <ul className="space-y-2">
              {improved.map((m) => (
                <li key={m.player.id} className="flex items-center gap-3">
                  <Avatar emoji={m.player.emoji} color={m.player.color} size={30} />
                  <span className="flex-1 truncate text-sm font-semibold">{m.player.name}</span>
                  <span className="font-display font-bold tabular-nums text-mint">+{m.gain}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {upsets.length > 0 && (
          <section className="card p-4">
            <h2 className="section-title mb-3">Biggest upset</h2>
            <Link href={`/session/${upsets[0].session_id}`} className="block">
              <p className="text-sm text-mist-200">
                <strong>{upsets[0].winner.name}</strong> beat{" "}
                <strong>{upsets[0].loser.name}</strong> at {upsets[0].game_name} from{" "}
                <span className="font-bold text-amber-brand tabular-nums">
                  {Math.round(upsets[0].gap)}
                </span>{" "}
                points down.
              </p>
              <p className="mt-1 text-xs text-mist-400">{relativeDate(upsets[0].played_at)}</p>
            </Link>
          </section>
        )}
      </div>

      {summary.sessions > 0 && (
        <section className="card p-4">
          <h2 className="section-title mb-3">Game nights</h2>
          <Heatmap data={heat} />
        </section>
      )}
    </div>
  );
}
