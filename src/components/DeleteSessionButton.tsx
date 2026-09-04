"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteSessionButton({ id }: { id: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    router.push("/sessions");
    router.refresh();
  }

  if (!confirming)
    return (
      <button className="btn-ghost w-full text-rose-brand" onClick={() => setConfirming(true)}>
        Delete this session
      </button>
    );

  return (
    <div className="card border-rose-brand/30 p-4">
      <p className="text-sm text-mist-200">
        Delete this session for good? Everyone&apos;s ratings will be replayed without it.
      </p>
      <div className="mt-3 flex gap-2">
        <button className="btn-ghost flex-1" onClick={() => setConfirming(false)} disabled={busy}>
          Keep it
        </button>
        <button className="btn-danger flex-1" onClick={remove} disabled={busy}>
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
