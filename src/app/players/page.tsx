import Link from "next/link";
import { AddPlayer } from "@/components/AddPlayer";
import { Avatar, Empty, PageHeader, TierBadge } from "@/components/ui";
import { getPlayers, overallComposite, playerStats } from "@/lib/queries";
import { tierForComposite } from "@/lib/rating";

export const dynamic = "force-dynamic";

export default function PlayersPage() {
  const players = getPlayers(true);
  const composite = new Map(overallComposite().map((c) => [c.player.id, c]));

  return (
    <div className="space-y-4">
      <PageHeader
        title="The regulars"
        subtitle={`${players.filter((p) => p.active).length} active`}
        action={<AddPlayer />}
      />

      {players.length === 0 ? (
        <Empty
          icon="🃏"
          title="No players yet"
          body="Add everyone who shows up. Each person gets their own username and password to sign in with."
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {players.map((p) => {
            const stats = playerStats(p.id);
            const c = composite.get(p.id);
            return (
              <li key={p.id}>
                <Link href={`/players/${p.id}`} className="card card-hover flex items-center gap-3 p-3">
                  <Avatar emoji={p.emoji} color={p.color} size={46} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{p.name}</span>
                      {!p.active && <span className="chip px-1.5 py-0 text-[10px]">inactive</span>}
                      {!!p.needs_password_setup && (
                        <span className="chip px-1.5 py-0 text-[10px] text-amber-300">
                          needs password
                        </span>
                      )}
                    </div>
                    <div className="mt-1">
                      <TierBadge tier={tierForComposite(c?.composite ?? 0, !!c?.ranked)} small />
                    </div>
                    <div className="mt-1 text-[11px] text-mist-400">
                      {stats.plays} plays · {Math.round(stats.winRate * 100)}% wins
                      {stats.currentStreak.length > 1 &&
                        ` · ${stats.currentStreak.kind}${stats.currentStreak.length}`}
                    </div>
                  </div>
                  {c?.ranked && (
                    <div className="text-right">
                      <div
                        className="font-display text-base font-extrabold tabular-nums"
                        style={{ color: c.composite >= 0 ? "#34d399" : "#fb7185" }}
                      >
                        {c.composite > 0 ? "+" : ""}
                        {c.composite.toFixed(2)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-mist-400">overall</div>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
