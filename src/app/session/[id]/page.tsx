import Link from "next/link";
import { notFound } from "next/navigation";
import { Reactions } from "@/components/Reactions";
import { RevealScreen } from "@/components/Reveal";
import { PageHeader } from "@/components/ui";
import { currentPlayer } from "@/lib/auth";
import { buildReveal } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const reveal = buildReveal(id);
  if (!reveal) notFound();
  const me = await currentPlayer();

  return (
    <div className="space-y-4">
      <PageHeader
        title="How it went"
        action={
          <Link href={`/session/${id}/edit`} className="btn-ghost text-xs">
            Fix a mistake
          </Link>
        }
      />
      <RevealScreen data={reveal} />
      {me && <Reactions sessionId={id} me={me} />}
      <div className="flex gap-2">
        <Link href="/play" className="btn-primary flex-1">
          Log another
        </Link>
        <Link href="/leaderboard" className="btn-ghost flex-1">
          Leaderboard
        </Link>
      </div>
    </div>
  );
}
