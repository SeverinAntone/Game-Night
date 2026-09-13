"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar, MEDALS, ordinalSuffix } from "./ui";
import { formatGameDateLong } from "@/lib/dates";
import type { Reveal as RevealData } from "@/lib/sessions";

/**
 * Post-game reveal (§10): deltas count up like a post-match screen, personal
 * bests get confetti, and a big underdog win gets an upset banner.
 */

export function RevealScreen({ data }: { data: RevealData }) {
  const anyBest = data.participants.some((p) => p.personalBest);
  const bigWin = data.upset !== null;
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    if (anyBest || bigWin) {
      const t = setTimeout(() => setConfetti(true), 550);
      return () => clearTimeout(t);
    }
  }, [anyBest, bigWin]);

  return (
    <div className="space-y-4">
      {confetti && <Confetti />}

      <div className="animate-pop card overflow-hidden">
        <div className="flex items-center gap-3 bg-gradient-to-r from-grape-500/25 to-transparent px-4 py-3">
          {data.game.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.game.thumbnail} alt="" className="size-12 rounded-xl object-cover" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-xl bg-white/10 text-2xl">
              🎲
            </span>
          )}
          <div className="min-w-0">
            <Link
              href={`/games/${data.game.id}`}
              className="block truncate font-display text-lg font-extrabold"
            >
              {data.game.name}
            </Link>
            <div className="text-xs text-mist-400">
              {formatGameDateLong(data.session.played_at)}
              {data.session.difficulty ? ` · difficulty ${data.session.difficulty}` : ""}
            </div>
          </div>
        </div>

        {data.session.coop_result && (
          <div
            className={`px-4 py-3 text-center font-display text-xl font-extrabold ${
              data.session.coop_result === "win" ? "text-mint" : "text-rose-brand"
            }`}
          >
            {data.session.coop_result === "win" ? "🏅 The table beat the game" : "💀 The game won"}
            <p className="mt-1 font-sans text-xs font-normal text-mist-400">
              Co-op — logged for streaks and difficulty stats, no ratings touched.
            </p>
          </div>
        )}
      </div>

      {data.upset && (
        <div className="animate-rise card border-amber-brand/30 bg-amber-brand/10 px-4 py-3" style={{ animationDelay: "0.35s" }}>
          <div className="font-display text-sm font-extrabold uppercase tracking-widest text-amber-brand">
            ⚡ Upset alert
          </div>
          <p className="mt-1 text-sm text-mist-200">
            <strong>{data.upset.winner.name}</strong> took it while sitting{" "}
            <strong className="tnum">{Math.round(data.upset.gap)}</strong> points below{" "}
            <strong>{data.upset.loser.name}</strong>. Rude.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {data.participants.map((p, i) => (
          <li
            key={p.player.id}
            className="animate-rise card flex items-center gap-3 p-3"
            style={{ animationDelay: `${0.1 + i * 0.09}s` }}
          >
            <span className="w-8 text-center font-display text-lg font-extrabold tabular-nums text-mist-300">
              {data.session.coop_result ? "•" : (MEDALS[p.placement - 1] ?? p.placement)}
            </span>
            <Avatar emoji={p.player.emoji} color={p.player.color} size={38} />
            <div className="min-w-0 flex-1">
              <Link href={`/players/${p.player.id}`} className="block truncate font-semibold">
                {p.player.name}
              </Link>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-mist-400">
                {!data.session.coop_result && <span>{ordinalSuffix(p.placement)}</span>}
                {p.score != null && (
                  <span className="chip px-1.5 py-0.5 text-[10px]">
                    {p.score} pts{p.personalBest ? " · PB 🎉" : ""}
                  </span>
                )}
                {p.tags.map((t) => (
                  <span key={t} className="chip px-1.5 py-0.5 text-[10px] text-sky-brand">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="text-right">
              {p.delta === null ? (
                <span className="text-xs text-ink-500">unrated</span>
              ) : (
                <>
                  <CountUp
                    from={p.before ?? 0}
                    to={p.after ?? 0}
                    delay={400 + i * 90}
                    className="block font-display text-lg font-extrabold tabular-nums"
                  />
                  <DeltaPill value={p.delta} delay={700 + i * 90} />
                </>
              )}
              {p.tagDeltas.map((t) => (
                <div key={t.tag} className="text-[10px] tabular-nums text-mist-400">
                  {t.tag} {t.delta >= 0 ? "+" : ""}
                  {t.delta}
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {data.session.notes && (
        <p className="card px-4 py-3 text-sm italic text-mist-300">“{data.session.notes}”</p>
      )}
    </div>
  );
}

function DeltaPill({ value, delay }: { value: number; delay: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!show) return <span className="block h-5" />;
  const up = value > 0;
  const flat = Math.abs(value) < 0.05;
  return (
    <span
      className={`animate-pop block text-xs font-bold tabular-nums ${
        flat ? "text-mist-400" : up ? "text-mint" : "text-rose-brand"
      }`}
    >
      {flat ? "±0" : `${up ? "+" : ""}${value}`}
    </span>
  );
}

function CountUp({
  from,
  to,
  delay,
  className,
}: {
  from: number;
  to: number;
  delay: number;
  className?: string;
}) {
  const [value, setValue] = useState(from);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(to);
      return;
    }
    const start = performance.now() + delay;
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [from, to, delay]);

  return <span className={className}>{Math.round(value)}</span>;
}

function Confetti() {
  const pieces = Array.from({ length: 44 }, (_, i) => i);
  const colors = ["#a78bfa", "#fbbf24", "#34d399", "#38bdf8", "#fb7185"];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${(i * 97) % 100}%`,
              background: colors[i % colors.length],
              animationDuration: `${2.2 + (i % 7) * 0.28}s`,
              animationDelay: `${(i % 11) * 0.09}s`,
              "--drift": `${((i % 9) - 4) * 26}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
