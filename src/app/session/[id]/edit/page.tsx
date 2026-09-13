import { notFound } from "next/navigation";
import { DeleteSessionButton } from "@/components/DeleteSessionButton";
import { SessionEntry } from "@/components/SessionEntry";
import { PageHeader } from "@/components/ui";
import { currentPlayer } from "@/lib/auth";
import { getGames, getParticipants, getPlayers, getSession } from "@/lib/queries";
import { parseTags } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const session = getSession(id);
  if (!session) notFound();
  const me = await currentPlayer();
  if (!me) notFound();

  const parts = getParticipants(id);

  return (
    <div>
      <PageHeader
        title="Edit session"
        subtitle="Every rating after this point is recomputed from scratch when you save."
      />
      <SessionEntry
        games={getGames(true)}
        players={getPlayers(true)}
        sessionId={id}
        me={me}
        initial={{
          game_id: session.game_id,
          variant: session.variant,
          played_at: session.played_at,
          notes: session.notes ?? "",
          difficulty: session.difficulty ?? "",
          coop_result: session.coop_result,
          rows: parts.map((p) => ({
            player_id: p.player_id,
            placement: p.placement,
            score: p.score,
            tags: parseTags(p.tags),
            team: p.team,
          })),
        }}
      />
      <div className="mt-2">
        <DeleteSessionButton id={id} />
      </div>
    </div>
  );
}
