import { AccountRequests } from "@/components/AccountRequests";
import { AdminActions } from "@/components/AdminActions";
import { ChangelogView } from "@/components/ChangelogView";
import { PasswordResetRequests } from "@/components/PasswordResetRequests";
import { PageHeader } from "@/components/ui";
import { UserManagement } from "@/components/UserManagement";
import { currentPlayer } from "@/lib/auth";
import { getChangelog, type ChangelogEntry, type ChangelogTargetType } from "@/lib/changelog";
import { all, get, pruneExpiredResetRequests, pruneExpiredSignupRequests } from "@/lib/db";
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

interface ResetRequestRow {
  id: number;
  player_id: number;
  name: string;
  username: string;
  requested_at: string;
  expires_at: string;
  approved_at: string | null;
}

const TARGET_TABLE: Record<ChangelogTargetType, string> = {
  game: "games",
  session: "sessions",
  player: "players",
};

/**
 * Which of the changelog's linked records are still actually there — a
 * game.delete or session.delete entry points at something that, by
 * definition, no longer exists, and this is what tells ChangelogView to
 * show that id as plain text instead of a broken link.
 */
function existingTargets(entries: ChangelogEntry[]): Set<string> {
  const idsByType = new Map<ChangelogTargetType, number[]>();
  for (const e of entries) {
    if (!e.target_type || e.target_id == null) continue;
    const list = idsByType.get(e.target_type) ?? [];
    list.push(e.target_id);
    idsByType.set(e.target_type, list);
  }

  const found = new Set<string>();
  for (const [type, ids] of idsByType) {
    const placeholders = ids.map(() => "?").join(",");
    const rows = all<{ id: number }>(
      `SELECT id FROM ${TARGET_TABLE[type]} WHERE id IN (${placeholders})`,
      ...ids,
    );
    for (const row of rows) found.add(`${type}:${row.id}`);
  }
  return found;
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
  let pendingResets: ResetRequestRow[] = [];
  let allPlayers: ReturnType<typeof getPlayers> = [];
  if (staff) {
    pruneExpiredSignupRequests();
    pruneExpiredResetRequests();
    pendingRequests = all<SignupRequestRow>(
      "SELECT id, name, username, requested_at, expires_at FROM signup_requests ORDER BY id ASC",
    );
    pendingResets = all<ResetRequestRow>(
      `SELECT r.id, r.player_id, p.name, p.username, r.requested_at, r.expires_at, r.approved_at
         FROM password_reset_requests r JOIN players p ON p.id = r.player_id
        ORDER BY r.id ASC`,
    );
    allPlayers = getPlayers(true);
  }

  const changelog = getChangelog();
  const liveTargets = existingTargets(changelog);

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
          <PasswordResetRequests requests={pendingResets} />
          <UserManagement players={allPlayers} me={me} />
          <AdminActions seasons={seasons} />
        </>
      )}

      <ChangelogView entries={changelog} liveTargets={liveTargets} />
    </div>
  );
}
