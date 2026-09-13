"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./ui";
import { canGrantRole, canManage } from "@/lib/roles";
import type { Player, Role } from "@/lib/types";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  standard: "Standard",
  disabled: "Disabled",
};
const ROLE_ORDER: Role[] = ["owner", "admin", "standard", "disabled"];
// Only true promotions get the heavier warning copy; moving sideways or down
// still confirms, just without implying new power was just handed out.
const RANK: Record<Role, number> = { owner: 3, admin: 2, standard: 1, disabled: 0 };

export function UserManagement({ players, me }: { players: Player[]; me: Player }) {
  const router = useRouter();
  const [pending, setPending] = useState<{ target: Player; role: Role } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Player | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function applyRole(target: Player, role: Role) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/players/${target.id}/role`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setPending(null);
    if (!res.ok) {
      setError(data.error ?? "That didn't work.");
      return;
    }
    router.refresh();
  }

  async function doDelete(target: Player) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/players/${target.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setConfirmDelete(null);
    if (!res.ok) {
      setError(data.error ?? "That didn't work.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="card p-4">
      <h2 className="section-title mb-3">User management</h2>
      <ul className="space-y-2">
        {players.map((p) => {
          const isSelf = p.id === me.id;
          const manageable = !isSelf && canManage(me.id, me.role, p.id, p.role);
          return (
            <li key={p.id} className="rounded-lg bg-white/5 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar emoji={p.emoji} color={p.color} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {p.name} {isSelf && <span className="text-mist-400">(you)</span>}
                  </div>
                  <div className="text-[11px] text-mist-400">@{p.username}</div>
                </div>
                <span className="chip px-2 py-0.5 text-[10px]">{ROLE_LABEL[p.role]}</span>
              </div>

              {manageable && pending?.target.id !== p.id && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ROLE_ORDER.filter((r) => r !== p.role && canGrantRole(me.role, r)).map((r) => (
                    <button
                      key={r}
                      className="btn-ghost px-2 py-1 text-[11px]"
                      onClick={() => setPending({ target: p, role: r })}
                      disabled={busy}
                    >
                      Make {ROLE_LABEL[r]}
                    </button>
                  ))}
                  <button
                    className="btn-ghost px-2 py-1 text-[11px] text-rose-brand"
                    onClick={() => setConfirmDelete(p)}
                    disabled={busy}
                  >
                    Remove
                  </button>
                </div>
              )}

              {pending?.target.id === p.id && (
                <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3">
                  <p className="text-xs leading-relaxed text-amber-200">
                    {RANK[pending.role] > RANK[p.role] ? (
                      <>
                        Make <strong>{p.name}</strong> {ROLE_LABEL[pending.role]}?{" "}
                        {pending.role === "owner"
                          ? "Owners can manage every account, including other owners' roles below their own, and can never be demoted from the admin panel."
                          : "Admins can approve new accounts, manage roles below their own, and remove users."}
                      </>
                    ) : (
                      <>
                        Change <strong>{p.name}</strong> to {ROLE_LABEL[pending.role]}?
                        {pending.role === "disabled" &&
                          " They'll still be able to view everything, but can't log sessions or make any changes."}
                      </>
                    )}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="btn-ghost flex-1 text-xs"
                      onClick={() => setPending(null)}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn-primary flex-1 text-xs"
                      onClick={() => applyRole(pending.target, pending.role)}
                      disabled={busy}
                    >
                      {busy ? "…" : "Confirm"}
                    </button>
                  </div>
                </div>
              )}

              {confirmDelete?.id === p.id && (
                <div className="mt-3 rounded-lg border border-rose-brand/30 bg-rose-brand/10 p-3">
                  <p className="text-xs leading-relaxed text-rose-200">
                    Remove <strong>{p.name}</strong> from the roster? Their session history and
                    ratings stay intact — this just deactivates the account.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="btn-ghost flex-1 text-xs"
                      onClick={() => setConfirmDelete(null)}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn-primary flex-1 text-xs"
                      onClick={() => doDelete(p)}
                      disabled={busy}
                    >
                      {busy ? "…" : "Remove"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-3 text-xs text-rose-brand">{error}</p>}
    </section>
  );
}
