/**
 * Small hand-rolled SVG charts. Deliberately dependency-free: the shapes here
 * are simple, and a charting library would outweigh them several times over.
 */

import { formatGameDate, formatMonthYear } from "@/lib/dates";

export function Sparkline({
  values,
  width = 120,
  height = 32,
  color = "#a78bfa",
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 2) + 1;
    const y = height - 2 - ((v - min) / span) * (height - 4);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const rising = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={d} fill="none" stroke={rising ? color : "#fb7185"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill={rising ? color : "#fb7185"} />
    </svg>
  );
}

export interface Series {
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

/** Multi-series rating-trajectory chart (§8). x is a timestamp in ms. */
export function LineChart({
  series,
  height = 220,
  yLabel,
}: {
  series: Series[];
  height?: number;
  yLabel?: string;
}) {
  const pts = series.flatMap((s) => s.points);
  if (pts.length < 2)
    return (
      <div className="flex h-40 items-center justify-center text-sm text-mist-400">
        Not enough history yet — play a few more sessions.
      </div>
    );

  const W = 640;
  const H = height;
  const pad = { l: 44, r: 14, t: 14, b: 26 };
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yPad = Math.max(12, (yMax - yMin) * 0.15);
  const lo = yMin - yPad;
  const hi = yMax + yPad;

  const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0 || 1)) * (W - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - (y - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);

  const ticks = 4;
  const gridY = Array.from({ length: ticks + 1 }, (_, i) => lo + ((hi - lo) * i) / ticks);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={yLabel ?? "chart"}>
      {gridY.map((g, i) => (
        <g key={i}>
          <line
            x1={pad.l}
            x2={W - pad.r}
            y1={sy(g)}
            y2={sy(g)}
            stroke="rgba(255,255,255,0.07)"
            strokeDasharray={i === 0 ? undefined : "3 5"}
          />
          <text x={8} y={sy(g) + 4} fill="#8f9bc4" fontSize="11">
            {Math.round(g)}
          </text>
        </g>
      ))}
      {series.map((s) => {
        const sorted = [...s.points].sort((a, b) => a.x - b.x);
        const d = sorted
          .map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`)
          .join(" ");
        return (
          <g key={s.label}>
            <path d={d} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
            {sorted.map((p, i) => (
              <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="2.6" fill={s.color}>
                <title>{`${s.label}: ${Math.round(p.y)} — ${formatGameDate(p.x)}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
      <text x={pad.l} y={H - 6} fill="#8f9bc4" fontSize="11">
        {formatMonthYear(x0)}
      </text>
      <text x={W - pad.r} y={H - 6} fill="#8f9bc4" fontSize="11" textAnchor="end">
        {formatMonthYear(x1)}
      </text>
    </svg>
  );
}

export function Legend({ series }: { series: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {series.map((s) => (
        <span key={s.label} className="flex items-center gap-1.5 text-xs text-mist-300">
          <span className="size-2.5 rounded-full" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/** GitHub-style calendar of game nights (§8). */
export function Heatmap({ data, weeks = 27 }: { data: { day: string; sessions: number }[]; weeks?: number }) {
  const counts = new Map(data.map((d) => [d.day, d.sessions]));
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1));
  start.setDate(start.getDate() - start.getDay());

  const cols: { date: Date; count: number }[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < weeks; w++) {
    const col: { date: Date; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const key = cursor.toISOString().slice(0, 10);
      col.push({ date: new Date(cursor), count: counts.get(key) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    cols.push(col);
  }

  const shade = (n: number) => {
    if (n === 0) return "rgba(255,255,255,0.05)";
    if (n === 1) return "rgba(139,92,246,0.35)";
    if (n === 2) return "rgba(139,92,246,0.6)";
    if (n <= 4) return "rgba(167,139,250,0.85)";
    return "#fbbf24";
  };

  const cell = 12;
  const gap = 3;
  return (
    <div className="overflow-x-auto">
      <svg
        width={cols.length * (cell + gap)}
        height={7 * (cell + gap) + 16}
        className="min-w-full"
        role="img"
        aria-label="Game nights calendar"
      >
        {cols.map((col, ci) =>
          col.map((c, ri) =>
            c.date > today ? null : (
              <rect
                key={`${ci}-${ri}`}
                x={ci * (cell + gap)}
                y={ri * (cell + gap)}
                width={cell}
                height={cell}
                rx={3}
                fill={shade(c.count)}
              >
                <title>{`${c.date.toDateString()} — ${c.count} session${c.count === 1 ? "" : "s"}`}</title>
              </rect>
            ),
          ),
        )}
      </svg>
    </div>
  );
}

/** Relative-strength radar across a player's games (§8). */
export function Radar({
  axes,
  size = 260,
  color = "#a78bfa",
}: {
  axes: { label: string; value: number }[]; // value is a z-score, roughly -2..+2
  size?: number;
  color?: string;
}) {
  if (axes.length < 3)
    return (
      <div className="flex h-40 items-center justify-center text-center text-sm text-mist-400">
        Needs 3+ games with 3+ plays to draw a shape.
      </div>
    );
  // Labels sit outside the rings, so the viewBox is padded horizontally —
  // otherwise a left-hand label like "Smash Up" gets its first letter clipped.
  const padX = 74;
  const padY = 18;
  const R = size / 2 - 34;
  const cx = size / 2;
  const cy = size / 2;
  const clamp = (v: number) => Math.max(-2, Math.min(2, v));
  const point = (i: number, v: number) => {
    const a = (i / axes.length) * Math.PI * 2 - Math.PI / 2;
    const r = ((clamp(v) + 2) / 4) * R;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  };

  const rings = [0.25, 0.5, 0.75, 1];
  const poly = axes.map((a, i) => point(i, a.value).join(",")).join(" ");

  return (
    <svg
      viewBox={`${-padX} ${-padY} ${size + padX * 2} ${size + padY * 2}`}
      width="100%"
      style={{ maxWidth: size + padX * 2 }}
      role="img"
    >
      {rings.map((r) => (
        <circle key={r} cx={cx} cy={cy} r={R * r} fill="none" stroke="rgba(255,255,255,0.07)" />
      ))}
      {axes.map((a, i) => {
        const [x, y] = point(i, 2);
        const [lx, ly] = point(i, 2.55);
        return (
          <g key={a.label}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.07)" />
            <text
              x={lx}
              y={ly}
              fontSize="10.5"
              fill="#8f9bc4"
              textAnchor={lx > cx + 4 ? "start" : lx < cx - 4 ? "end" : "middle"}
              dominantBaseline="middle"
            >
              {a.label.length > 18 ? `${a.label.slice(0, 17)}…` : a.label}
            </text>
          </g>
        );
      })}
      <polygon points={poly} fill={`${color}33`} stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {axes.map((a, i) => {
        const [x, y] = point(i, a.value);
        return (
          <circle key={a.label} cx={x} cy={y} r="3" fill={color}>
            <title>{`${a.label}: z ${a.value > 0 ? "+" : ""}${a.value.toFixed(2)}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

/** Horizontal bar for win-rate style breakdowns. */
export function BarRow({
  label,
  value,
  max,
  caption,
  color = "#8b5cf6",
}: {
  label: string;
  value: number;
  max: number;
  caption?: string;
  color?: string;
}) {
  const pct = max > 0 ? Math.max(0.02, value / max) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 shrink-0 truncate text-sm text-mist-300">{label}</div>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/6">
        <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: color }} />
      </div>
      <div className="w-20 shrink-0 text-right text-xs tabular-nums text-mist-400">{caption}</div>
    </div>
  );
}
