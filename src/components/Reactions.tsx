"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REACTION_EMOJI, type Player } from "@/lib/types";

interface Row {
  player_id: number;
  name: string;
  emoji: string;
  count: number;
}

/**
 * Spammable post-game reactions (§7). Every tap increments a per-player tally,
 * taps are batched client-side, and other phones catch up by polling every
 * couple of seconds — no websocket machinery for a table of six.
 *
 * `me` is whoever is actually signed in — every visitor is authenticated now
 * (see middleware.ts), so there's no more tap-any-name picker standing in
 * for identity here.
 */
export function Reactions({
  sessionId,
  me,
}: {
  sessionId: number;
  me: Pick<Player, "id" | "name" | "emoji" | "color">;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState<Record<string, number>>({});
  const [floaters, setFloaters] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Record<string, number>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/reactions`, { cache: "no-store" });
      if (res.ok) setRows((await res.json()).reactions);
    } catch {
      /* offline for a moment — the next poll will catch up */
    }
  }, [sessionId]);

  useEffect(() => {
    load();
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 2500);
    return () => clearInterval(poll);
  }, [load]);

  const flush = useCallback(async () => {
    const batch = pendingRef.current;
    pendingRef.current = {};
    setPending({});
    for (const [emoji, by] of Object.entries(batch)) {
      if (!by) continue;
      try {
        const res = await fetch(`/api/sessions/${sessionId}/reactions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ player_id: me.id, emoji, by }),
        });
        if (res.ok) setRows((await res.json()).reactions);
      } catch {
        /* dropped taps are not worth an error dialog */
      }
    }
  }, [me.id, sessionId]);

  function tap(emoji: string, e: React.MouseEvent<HTMLButtonElement>) {
    pendingRef.current[emoji] = (pendingRef.current[emoji] ?? 0) + 1;
    setPending({ ...pendingRef.current });

    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now() + Math.random();
    setFloaters((f) => [...f, { id, emoji, x: rect.left + rect.width / 2 }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 900);

    if (navigator.vibrate) navigator.vibrate(8);
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flush, 700);
  }

  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.emoji, (totals.get(r.emoji) ?? 0) + r.count);
  for (const [e, n] of Object.entries(pending)) totals.set(e, (totals.get(e) ?? 0) + n);

  const leaderboard = [...rows]
    .reduce<{ name: string; player_id: number; total: number }[]>((acc, r) => {
      const found = acc.find((a) => a.player_id === r.player_id);
      if (found) found.total += r.count;
      else acc.push({ name: r.name, player_id: r.player_id, total: r.count });
      return acc;
    }, [])
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <div className="card p-4">
      {floaters.map((f) => (
        <span
          key={f.id}
          className="float-up pointer-events-none fixed bottom-32 z-50 text-3xl"
          style={{ left: f.x - 16 }}
          aria-hidden
        >
          {f.emoji}
        </span>
      ))}

      <div className="mb-3 flex items-center justify-between">
        <span className="section-title">Reactions</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {REACTION_EMOJI.map((emoji) => {
          const n = totals.get(emoji) ?? 0;
          return (
            <button
              key={emoji}
              onClick={(e) => tap(emoji, e)}
              className={`flex flex-col items-center gap-0.5 rounded-xl border py-2.5 text-2xl transition active:scale-90 ${
                n > 0
                  ? "border-grape-400/30 bg-grape-500/12"
                  : "border-white/8 bg-white/5 hover:bg-white/10"
              }`}
            >
              <span>{emoji}</span>
              <span className="text-[11px] font-bold tabular-nums text-mist-400">{n || ""}</span>
            </button>
          );
        })}
      </div>

      {leaderboard.length > 0 && (
        <p className="mt-3 text-[11px] text-mist-400">
          Loudest:{" "}
          {leaderboard.map((l, i) => (
            <span key={l.player_id}>
              {i > 0 && " · "}
              <span className="font-semibold text-mist-300">{l.name}</span> {l.total}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
