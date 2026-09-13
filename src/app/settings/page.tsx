import { AccountRequests } from "@/components/AccountRequests";
import { AdminActions } from "@/components/AdminActions";
import { ChangelogView } from "@/components/ChangelogView";
import { PageHeader } from "@/components/ui";
import { UserManagement } from "@/components/UserManagement";
import { currentPlayer } from "@/lib/auth";
import { getChangelog } from "@/lib/changelog";
import { all, get, pruneExpiredSignupRequests } from "@/lib/db";
import { dashboardSummary, getPlayers } from "@/lib/queries";
import { isStaff } from "@/lib/roles";

export const dynamic = "force-dynamic";

interface SignupRequestRow {
  id: number;
  name: string;
  username: string;
  requested_at: string;
  expires_at: string;
}

export default async function SettingsPage() {
  const me = await currentPlayer();
  const staff = !!me && isStaff(me.role);

  const summary = dashboardSummary();
  const snapshots = get<{ n: number }>("SELECT COUNT(*) AS n FROM rating_snapshots")!;
  const seasons = all<{ id: number; name: string; started_at: string; active: number }>(
    "SELECT * FROM seasons ORDER BY id DESC",
  );

  let pendingRequests: SignupRequestRow[] = [];
  let allPlayers: ReturnType<typeof getPlayers> = [];
  if (staff) {
    pruneExpiredSignupRequests();
    pendingRequests = all<SignupRequestRow>(
      "SELECT id, name, username, requested_at, expires_at FROM signup_requests ORDER BY id ASC",
    );
    allPlayers = getPlayers(true);
  }

  const changelog = getChangelog();

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Housekeeping for the database this runs on." />

      <section className="card p-4">
        <h2 className="section-title mb-3">Database</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-mist-400">Sessions</dt>
            <dd className="font-display text-lg font-bold tabular-nums">{summary.sessions}</dd>
          </div>
          <div>
            <dt className="text-xs text-mist-400">Rating rows</dt>
            <dd className="font-display text-lg font-bold tabular-nums">{snapshots.n}</dd>
          </div>
          <div>
            <dt className="text-xs text-mist-400">Games</dt>
            <dd className="font-display text-lg font-bold tabular-nums">{summary.games}</dd>
          </div>
          <div>
            <dt className="text-xs text-mist-400">Players</dt>
            <dd className="font-display text-lg font-bold tabular-nums">{summary.players}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-mist-400">
          Everything lives in <code className="text-mist-300">data/boardgames.db</code>. Use the
          backup button below for a safe copy — it checkpoints the write-ahead log first. Copying
          the file by hand while the app is running needs the{" "}
          <code className="text-mist-300">-wal</code> and{" "}
          <code className="text-mist-300">-shm</code> files alongside it.
        </p>
      </section>

      {staff && me && (
        <>
          <AccountRequests requests={pendingRequests} />
          <UserManagement players={allPlayers} me={me} />
          <AdminActions seasons={seasons} />
        </>
      )}

      <ChangelogView entries={changelog} />
    </div>
  );
}
