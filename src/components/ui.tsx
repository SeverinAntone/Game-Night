import Link from "next/link";
import { formatGameDate } from "@/lib/dates";
import type { Tier } from "@/lib/rating";

export function Avatar({
  emoji,
  color,
  size = 40,
  ring = false,
}: {
  emoji: string;
  color?: string | null;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${
        ring ? "ring-2 ring-white/15" : ""
      }`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.52,
        background: color ? `${color}2e` : "rgba(255,255,255,0.06)",
        boxShadow: color ? `inset 0 0 0 1px ${color}55` : undefined,
      }}
    >
      {emoji}
    </span>
  );
}

export function TierBadge({ tier, small = false }: { tier: Tier; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold ${
        small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      }`}
      style={{
        color: tier.color,
        borderColor: `${tier.color}44`,
        background: `${tier.color}14`,
      }}
    >
      <span>{tier.emoji}</span>
      {tier.name}
    </span>
  );
}

export function Delta({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null || Number.isNaN(value)) return <span className="text-ink-500">—</span>;
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return <span className="tnum text-mist-400">±0</span>;
  const up = rounded > 0;
  return (
    <span className={`tnum font-semibold ${up ? "text-mint" : "text-rose-brand"}`}>
      {up ? "+" : ""}
      {rounded}
      {suffix}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mist-400">
        {label}
      </div>
      <div className="stat-value mt-1" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-mist-400">{hint}</div> : null}
    </div>
  );
}

export function Empty({
  icon = "🫙",
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="text-4xl">{icon}</div>
      <div className="font-display text-lg font-bold">{title}</div>
      {body ? <p className="max-w-sm text-sm text-mist-400">{body}</p> : null}
      {action ? (
        <Link href={action.href} className="btn-primary mt-2">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-mist-400">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export const ordinalSuffix = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
};

export const MEDALS = ["🥇", "🥈", "🥉"];

export function formatDate(iso: string) {
  return formatGameDate(iso);
}

export function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 864e5);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
