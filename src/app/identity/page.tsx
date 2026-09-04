import { IdentityPicker } from "@/components/IdentityPicker";
import { PageHeader } from "@/components/ui";
import { currentPlayer } from "@/lib/auth";
import { getPlayers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function IdentityPage() {
  const me = await currentPlayer();
  return (
    <div>
      <PageHeader
        title="Who's this?"
        subtitle="Nothing here is needed to log a session — only for your own reactions, profile and draft."
      />
      <IdentityPicker players={getPlayers()} signedInId={me?.id ?? null} />
    </div>
  );
}
