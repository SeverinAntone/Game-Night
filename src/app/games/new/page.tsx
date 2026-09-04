import { GameWizard } from "@/components/GameWizard";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function NewGamePage() {
  // BGG's API needs a registered token now, so the button only appears when one
  // is configured — no point advertising a lookup that can only fail.
  const bggEnabled = !!process.env.BGG_TOKEN?.trim();

  return (
    <div>
      <PageHeader
        title="New game"
        subtitle="Answer these once. Session entry reads the answers from here on."
      />
      <GameWizard bggEnabled={bggEnabled} />
    </div>
  );
}
