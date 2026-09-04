"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminActions({
  seasons,
}: {
  seasons: { id: number; name: string; started_at: string; active: number }[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [seasonName, setSeasonName] = useState("");
  const [confirmSeason, setConfirmSeason] = useState(false);

  async function run(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setStatus(null);
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setStatus(data.error ?? "That didn't work.");
      return;
    }
    if (action === "recompute")
      setStatus(`Replayed ${data.sessions} sessions into ${data.snapshots} rating rows.`);
    else if (action === "backup") setStatus(`Backed up to ${data.file}`);
    else setStatus("Done.");
    router.refresh();
  }

  return (
    <section className="card space-y-4 p-4">
      <div>
        <h2 className="section-title mb-2">Maintenance</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => run("recompute")} disabled={!!busy}>
            {busy === "recompute" ? "Replaying…" : "Replay all ratings"}
          </button>
          <button className="btn-ghost" onClick={() => run("backup")} disabled={!!busy}>
            {busy === "backup" ? "Backing up…" : "Back up database"}
          </button>
        </div>
        <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-mist-400">
          <p>
            <strong className="text-mist-300">Replay</strong> throws away every stored rating and
            recalculates them from scratch, walking the sessions oldest to newest. Nobody&apos;s
            history changes — the sessions are the record, ratings are just derived from them —
            so the numbers land exactly where they were unless something they depend on changed.
          </p>
          <p>
            It already runs by itself after every session you log, edit or delete, and after a
            change to a game&apos;s config. This button is only here for the rare case: you edited
            the database by hand, restored a backup, or something looks wrong and you want to be
            certain. It&apos;s safe to press any time and takes well under a second.
          </p>
        </div>
      </div>

      <div>
        <h2 className="section-title mb-2">Seasons</h2>
        {seasons.length > 0 ? (
          <ul className="mb-3 space-y-1 text-sm">
            {seasons.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <span className={s.active ? "font-semibold" : "text-mist-400"}>{s.name}</span>
                {s.active ? <span className="chip px-2 py-0 text-[10px] text-mint">current</span> : null}
                <span className="text-xs text-mist-400">
                  from {new Date(s.started_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-xs text-mist-400">
            No seasons yet — everything is one continuous run of history.
          </p>
        )}

        {confirmSeason ? (
          <div className="space-y-2">
            <input
              className="input"
              placeholder="Season name, e.g. Winter 2026"
              value={seasonName}
              onChange={(e) => setSeasonName(e.target.value)}
            />
            <p className="text-xs text-mist-400">
              New sessions get stamped with the new season. Existing history and ratings are kept
              exactly as they are.
            </p>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setConfirmSeason(false)}>
                Cancel
              </button>
              <button
                className="btn-primary flex-1"
                onClick={() => {
                  run("new-season", { name: seasonName });
                  setConfirmSeason(false);
                  setSeasonName("");
                }}
                disabled={!!busy}
              >
                Start it
              </button>
            </div>
          </div>
        ) : (
          <button className="btn-ghost" onClick={() => setConfirmSeason(true)}>
            Start a new season
          </button>
        )}
      </div>

      {status && <p className="break-all text-xs text-mint">{status}</p>}
    </section>
  );
}
