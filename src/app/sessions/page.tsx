import Link from "next/link";
import { Avatar, Empty, MEDALS, PageHeader } from "@/components/ui";
import { formatGameDate, gameDayKey } from "@/lib/dates";
import { getGames, getParticipantsForSessions, getPlayers, getSessions } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; player?: string }>;
}) {
  const sp = await searchParams;
  const gameId = sp.game ? Number(sp.game) : undefined;
  const playerId = sp.player ? Number(sp.player) : undefined;
  const sessions = getSessions(200, gameId, playerId);
  const games = getGames(true);
  const players = getPlayers(true);
  const partsBySession = getParticipantsForSessions(sessions.map((s) => s.id));

  // Group by day so a whole game night reads as one block. gameDayKey (not a
  // raw slice of the stored UTC timestamp) is what makes a session logged
  // late in the evening land on the day it was actually played, regardless
  // of what timezone the server happens to be running in.
  const byDay = new Map<string, { display: string; sessions: typeof sessions }>();
  for (const s of sessions) {
    const key = gameDayKey(s.played_at);
    const bucket = byDay.get(key);
    if (bucket) bucket.sessions.push(s);
    else byDay.set(key, { display: formatGameDate(s.played_at), sessions: [s] });
  }

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const next = { game: sp.game, player: sp.player, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/sessions?${s}` : "/sessions";
  };

  return (
    <div className="space-y-4">
      <PageHeader title="History" subtitle={`${sessions.length} sessions`} />

      <div className="flex flex-col gap-2">
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          <Chip href={qs({ game: undefined })} active={!gameId} label="All games" />
          {games.map((g) => (
            <Chip key={g.id} href={qs({ game: String(g.id) })} active={gameId === g.id} label={g.name} />
          ))}
        </nav>
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          <Chip href={qs({ player: undefined })} active={!playerId} label="Everyone" />
          {players.map((p) => (
            <Chip
              key={p.id}
              href={qs({ player: String(p.id) })}
              active={playerId === p.id}
              label={`${p.emoji} ${p.name}`}
            />
          ))}
        </nav>
      </div>

      {sessions.length === 0 ? (
        <Empty icon="📜" title="Nothing here" body="No sessions match that filter." action={{ href: "/play", label: "Log a session" }} />
      ) : (
        <div className="space-y-5">
          {[...byDay.entries()].map(([key, { display, sessions: list }]) => (
            <section key={key}>
              <h2 className="section-title mb-2">{display}</h2>
              <ul className="space-y-2">
                {list.map((s) => {
                  const parts = partsBySession.get(s.id) ?? [];
                  return (
                    <li key={s.id}>
                      <Link href={`/session/${s.id}`} className="card card-hover block p-3">
                        <div className="flex items-center gap-3">
                          {s.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.thumbnail} alt="" className="size-10 rounded-lg object-cover" />
                          ) : (
                            <span className="flex size-10 items-center justify-center rounded-lg bg-white/5 text-lg">
                              🎲
                            </span>
                          )}
                          <span className="min-w-0 flex-1 truncate font-semibold">{s.game_name}</span>
                          {s.coop_result && (
                            <span className={s.coop_result === "win" ? "text-mint" : "text-rose-brand"}>
                              {s.coop_result === "win" ? "🏅" : "💀"}
                            </span>
                          )}
                        </div>
                        <ol className="mt-2 flex flex-wrap gap-1.5">
                          {parts.map((p) => (
                            <li key={p.id} className="chip px-2 py-0.5 text-[11px]">
                              {!s.coop_result && (MEDALS[p.placement - 1] ?? `${p.placement}.`)}
                              <Avatar emoji={p.emoji} color={p.color} size={16} />
                              {p.name}
                              {p.score != null && <span className="tabular-nums text-mist-400">{p.score}</span>}
                            </li>
                          ))}
                        </ol>
                        {s.notes && <p className="mt-2 truncate text-xs italic text-mist-400">“{s.notes}”</p>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-grape-400/60 bg-grape-500/20 text-grape-100"
          : "border-white/10 bg-white/5 text-mist-300 hover:bg-white/10"
      }`}
    >
      {label}
    </Link>
  );
}
