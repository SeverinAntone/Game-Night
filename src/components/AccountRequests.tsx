"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatGameDate, formatGameTime } from "@/lib/dates";

interface Req {
  id: number;
  name: string;
  username: string;
  requested_at: string;
  expires_at: string;
}

/** Owner/admin only. Approving creates the real account; denying just deletes the request. */
export function AccountRequests({ requests }: { requests: Req[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: number, action: "approve" | "deny") {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/signup-requests/${id}`, {
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
      <h2 className="section-title mb-3">Account requests</h2>
      <ul className="space-y-2">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-white/5 p-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                {r.name} <span className="text-mist-400">· @{r.username}</span>
              </div>
              <div className="text-[11px] text-mist-400">
                Requested {formatGameDate(r.requested_at)} at {formatGameTime(r.requested_at)} —
                expires {formatGameTime(r.expires_at)}
              </div>
            </div>
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
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-rose-brand">{error}</p>}
    </section>
  );
}
