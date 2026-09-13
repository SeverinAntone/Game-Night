import { AdminActions } from "@/components/AdminActions";
import { PageHeader } from "@/components/ui";
import { all, get } from "@/lib/db";
import { dashboardSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const summary = dashboardSummary();
  const snapshots = get<{ n: number }>("SELECT COUNT(*) AS n FROM rating_snapshots")!;
  const seasons = all<{ id: number; name: string; started_at: string; active: number }>(
    "SELECT * FROM seasons ORDER BY id DESC",
  );

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

      <AdminActions seasons={seasons} />
    </div>
  );
}
