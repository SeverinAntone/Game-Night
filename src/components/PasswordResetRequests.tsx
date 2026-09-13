"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatGameDate, formatGameTime } from "@/lib/dates";

interface Req {
  id: number;
  player_id: number;
  name: string;
  username: string;
  requested_at: string;
  expires_at: string;
  approved_at: string | null;
}

/**
 * Owner/admin only. Distinct from AccountRequests on purpose — this is
 * handing back control of an *existing* account, not creating a fresh
 * low-privilege one, so the copy stays explicit about which account and
 * doesn't try to look like a routine "approve" button.
 */
export function PasswordResetRequests({ requests }: { requests: Req[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: number, action: "approve" | "deny") {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/password-reset-requests/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "That didn't work.");
      return;
    }
    router.refresh();
  }

  if (requests.length === 0) return null;

  return (
    <section className="card p-4">
      <h2 className="section-title mb-3">Password reset requests</h2>
      <ul className="space-y-2">
        {requests.map((r) => (
          <li key={r.id} className="rounded-lg bg-white/5 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  Resetting access for {r.name}{" "}
                  <span className="text-mist-400">· @{r.username}</span>
                </div>
                <div className="text-[11px] text-mist-400">
                  Requested {formatGameDate(r.requested_at)} at {formatGameTime(r.requested_at)} —
                  expires {formatGameTime(r.expires_at)}
                </div>
              </div>
              {r.approved_at ? (
                <span className="chip px-2 py-0.5 text-[10px] text-emerald-300">
                  Approved — waiting on them
                </span>
              ) : (
                <div className="flex gap-2">
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => act(r.id, "deny")}
                    disabled={busy === r.id}
                  >
                    Deny
                  </button>
                  <button
                    className="btn-primary text-xs"
                    onClick={() => act(r.id, "approve")}
                    disabled={busy === r.id}
                  >
                    {busy === r.id ? "…" : "Approve"}
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-rose-brand">{error}</p>}
    </section>
  );
}
