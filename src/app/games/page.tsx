import Link from "next/link";
import { Empty, PageHeader, relativeDate } from "@/components/ui";
import { all } from "@/lib/db";
import { getGames } from "@/lib/queries";
import { SCORING_MODE_LABELS, tagPool } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function GamesPage() {
  const games = getGames(true);
  const stats = new Map(
    all<{ game_id: number; plays: number; last: string }>(
      `SELECT game_id, COUNT(*) AS plays, MAX(played_at) AS last FROM sessions GROUP BY game_id`,
    ).map((r) => [r.game_id, r]),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="The shelf"
        subtitle={`${games.length} game${games.length === 1 ? "" : "s"} configured`}
        action={
          <Link href="/games/new" className="btn-primary">
            ➕ New game
          </Link>
        }
      />

      {games.length === 0 ? (
        <Empty
          icon="📚"
          title="The shelf is empty"
          body="The wizard asks a few questions once per game, so logging a session stays fast forever after."
          action={{ href: "/games/new", label: "Add your first game" }}
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {games.map((g) => {
            const s = stats.get(g.id);
            const pool = tagPool(g);
            return (
              <li key={g.id}>
                <Link href={`/games/${g.id}`} className="card card-hover flex gap-3 p-3">
                  {g.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.thumbnail} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white/5 text-2xl">
                      🎲
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{g.name}</span>
                      {g.retired ? <span className="chip px-1.5 py-0 text-[10px]">retired</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="chip px-2 py-0.5 text-[10px]">
                        {SCORING_MODE_LABELS[g.scoring_mode]}
                      </span>
                      {g.tracks_score ? (
                        <span className="chip px-2 py-0.5 text-[10px]">score</span>
                      ) : null}
                      {g.rating_dimension !== "none" ? (
                        <span className="chip px-2 py-0.5 text-[10px] text-sky-brand">
                          {pool.length} {(g.tag_label ?? "tag").toLowerCase()}s
                        </span>
                      ) : null}
                      {g.tracks_difficulty ? (
                        <span className="chip px-2 py-0.5 text-[10px]">difficulty</span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[11px] text-mist-400">
                      {s ? `${s.plays} plays · last ${relativeDate(s.last)}` : "never played"}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
