import os from "node:os";
import { headers } from "next/headers";
import { AdminActions } from "@/components/AdminActions";
import { ShareLink } from "@/components/ShareLink";
import { PageHeader } from "@/components/ui";
import { all, get } from "@/lib/db";
import { dashboardSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Every LAN address this machine answers on, paired with the port in use. */
function localUrls(port: string) {
  const seen = new Set<string>();
  const urls: { label: string; url: string }[] = [];

  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family !== "IPv4" || addr.internal || seen.has(addr.address)) continue;
      seen.add(addr.address);
      urls.push({ label: name, url: `http://${addr.address}:${port}` });
    }
  }
  // Wired/wifi adapters first; virtual ones (Docker, VPNs, Hyper-V) rarely work.
  const virtual = /virtual|vmware|vbox|docker|hyper-v|loopback|wsl/i;
  return urls.sort((a, b) => Number(virtual.test(a.label)) - Number(virtual.test(b.label)));
}

export default async function SettingsPage() {
  const host = (await headers()).get("host") ?? "";
  const port = host.includes(":") ? host.split(":").pop()! : "3000";
  const shareUrls = localUrls(port);
  const summary = dashboardSummary();
  const snapshots = get<{ n: number }>("SELECT COUNT(*) AS n FROM rating_snapshots")!;
  const seasons = all<{ id: number; name: string; started_at: string; active: number }>(
    "SELECT * FROM seasons ORDER BY id DESC",
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Housekeeping for the one machine this runs on." />

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

      <section className="card p-4">
        <h2 className="section-title mb-1">Share with the table</h2>
        <p className="mb-3 text-[13px] leading-relaxed text-mist-300">
          Send this to anyone on the wifi. It&apos;s the same app you&apos;re looking at — there is
          no separate admin site, so whoever opens it can log sessions and react. Tell them to hit
          &quot;Add to Home Screen&quot; and it behaves like an installed app.
        </p>
        <ShareLink urls={shareUrls} />
        <p className="mt-3 text-xs text-mist-400">
          Nothing works? Windows Firewall usually asks once, the first time the server starts —
          if it was dismissed, allow Node.js on private networks. Phones must be on the same wifi
          (not guest wifi, not cellular).
        </p>
      </section>
    </div>
  );
}
