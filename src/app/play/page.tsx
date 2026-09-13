import Link from "next/link";
import { SessionEntry } from "@/components/SessionEntry";
import { Empty, PageHeader } from "@/components/ui";
import { currentPlayer } from "@/lib/auth";
import { getGames, getPlayers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PlayPage() {
  const games = getGames();
  const players = getPlayers();
  const me = await currentPlayer();

  if (!games.length || !players.length || !me)
    return (
      <div className="space-y-4">
        <PageHeader title="Log a session" />
        <Empty
          icon="🧰"
          title={games.length ? "No players yet" : "No games yet"}
          body={
            games.length
              ? "Add the regulars first — one tap each while you shuffle."
              : "Add a game with the wizard, then come straight back."
          }
          action={games.length ? { href: "/players", label: "Add players" } : { href: "/games/new", label: "Add a game" }}
        />
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Log a session"
        subtitle="One person, one device, the whole table."
        action={
          <Link href="/sessions" className="hidden text-xs font-semibold text-grape-300 md:block">
            History →
          </Link>
        }
      />
      <SessionEntry games={games} players={players} me={me} />
    </div>
  );
}
