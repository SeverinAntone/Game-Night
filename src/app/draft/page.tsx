import Link from "next/link";
import { GameDraft } from "@/components/GameDraft";
import { Empty, PageHeader } from "@/components/ui";
import { currentPlayer } from "@/lib/auth";
import { getGames } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DraftPage() {
  const me = await currentPlayer();
  const games = getGames();

  if (!me)
    return (
      <div>
        <PageHeader title="Game Draft" subtitle="Your own taste, built one duel at a time." />
        <Empty
          icon="⚔️"
          title="Sign in first"
          body="The draft is personal — it needs your name and PIN so it doesn't mix up whose taste is whose."
          action={{ href: "/identity", label: "Sign in" }}
        />
      </div>
    );

  if (games.length < 2)
    return (
      <div>
        <PageHeader title="Game Draft" />
        <Empty icon="🎲" title="Not enough games" body="Add at least two games and the duels can start." action={{ href: "/games/new", label: "Add a game" }} />
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Game Draft"
        subtitle={`${me.name}'s taste — no pressure, no 1-10 scales, just "which one?"`}
        action={
          <Link href={`/players/${me.id}`} className="hidden text-xs font-semibold text-grape-300 md:block">
            Your card →
          </Link>
        }
      />
      <GameDraft />
    </div>
  );
}
