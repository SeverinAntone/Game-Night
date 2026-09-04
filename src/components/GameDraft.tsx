"use client";

import { useCallback, useEffect, useState } from "react";
import type { Game } from "@/lib/types";

interface Standing {
  game: Game;
  strength: number;
  score: number;
  rank: number;
  comparisons: number;
  wins: number;
}

/**
 * The pairwise duel UI behind the Bradley-Terry preference ranking (§7).
 * Deliberately low-stakes: answer one, answer twenty, or wander off.
 */
export function GameDraft() {
  const [duel, setDuel] = useState<[Game, Game] | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [undone, setUndone] = useState<{ winner: string; loser: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/draft", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setDuel(data.duel);
    setStandings(data.standings);
    setAnswered(data.answered ?? 0);
  }, []);

  /** Take back the last answer and put that pair straight back on the table. */
  async function undo() {
    if (busy || answered === 0) return;
    setBusy(true);
    const res = await fetch("/api/draft", { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      setDuel(data.duel);
      setStandings(data.standings);
      setAnswered(data.answered ?? 0);
      setUndone(data.undone);
      setPicked(null);
    }
    setBusy(false);
  }

  useEffect(() => {
    load();
  }, [load]);

  async function vote(winner: Game, loser: Game) {
    if (busy) return;
    setBusy(true);
    setPicked(winner.id);
    const res = await fetch("/api/draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ winner_game_id: winner.id, loser_game_id: loser.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setAnswered(data.answered ?? 0);
      setUndone(null);
      // Let the pick register visually before swapping in the next pair.
      setTimeout(() => {
        setDuel(data.duel);
        setStandings(data.standings);
        setPicked(null);
        setBusy(false);
      }, 260);
    } else {
      setPicked(null);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {duel && (
        <section>
          <p className="mb-3 text-center text-sm text-mist-400">
            Given the choice tonight — which one?
          </p>
          <div className="grid grid-cols-2 gap-3">
            {duel.map((g, i) => (
              <button
                key={g.id}
                onClick={() => vote(g, duel[1 - i])}
                disabled={busy}
                className={`card card-hover flex flex-col items-center gap-3 p-4 text-center transition ${
                  picked === g.id ? "ring-2 ring-grape-400" : ""
                } ${picked && picked !== g.id ? "opacity-40" : ""}`}
              >
                {g.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.thumbnail} alt="" className="size-24 rounded-xl object-cover" />
                ) : (
                  <span className="flex size-24 items-center justify-center rounded-xl bg-white/5 text-4xl">
                    🎲
                  </span>
                )}
                <span className="font-display text-base font-bold leading-tight">{g.name}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-mist-400">
            <span>
              {answered} duel{answered === 1 ? "" : "s"} answered
            </span>
            <button
              onClick={undo}
              disabled={busy || answered === 0}
              className="font-semibold text-grape-300 disabled:cursor-not-allowed disabled:text-ink-500"
            >
              ↩ Undo last
            </button>
            <button onClick={load} disabled={busy} className="font-semibold text-grape-300">
              Skip this pair
            </button>
          </div>

          {undone && (
            <p className="animate-pop mt-2 text-center text-xs text-amber-brand">
              Took back <strong>{undone.winner}</strong> over <strong>{undone.loser}</strong> — have
              another go.
            </p>
          )}
        </section>
      )}

      {standings.length > 0 ? (
        <section>
          <h2 className="section-title mb-2">Your ranking so far</h2>
          <ol className="card divide-y divide-white/5">
            {standings.map((s) => (
              <li key={s.game.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-6 text-center font-display font-extrabold tabular-nums text-mist-400">
                  {s.rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.game.name}</span>
                <div className="hidden h-2 w-28 overflow-hidden rounded-full bg-white/8 sm:block">
                  <div
                    className="h-full rounded-full bg-grape-400"
                    style={{ width: `${Math.max(3, s.score)}%` }}
                  />
                </div>
                <span className="w-16 text-right text-[11px] tabular-nums text-mist-400">
                  {s.wins}/{s.comparisons}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-mist-400">
            Fitted with a Bradley-Terry model, so a game that keeps beating strong rivals climbs
            faster than one that only beats the games nobody likes.
          </p>
        </section>
      ) : (
        <p className="text-center text-sm text-mist-400">
          Answer a couple of duels and your ranking appears here.
        </p>
      )}
    </div>
  );
}
