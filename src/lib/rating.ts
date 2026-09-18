import { rating, rate, predictWin } from "openskill";

/**
 * Rating engine wrapper (design doc §3).
 *
 *  - OpenSkill / Weng-Lin. Placement (with ties) is the ONLY input; score is
 *    never fed to the engine.
 *  - Displayed rating is mu alone, scaled to a friendly 4-digit number so a
 *    brand-new player reads exactly 1000 rather than "25.0". It used to be
 *    the conservative estimate (mu - 3*sigma), but sigma only ever shrinks as
 *    someone plays, never rises — so that formula handed out free points for
 *    merely showing up, independent of winning or losing (10 of 41 sessions
 *    in the real history were a non-winner *gaining* rating). Uncertainty is
 *    surfaced instead as its own ± band via `uncertaintyBand()`, so it still
 *    conveys "how sure are we" without inflating the headline number.
 */

export const BASE_MU = 25;
export const BASE_SIGMA = 25 / 3;
export const DISPLAY_SCALE = 40;
/** Plays needed in a pool before a rating stops being provisional. */
export const PROVISIONAL_PLAYS = 3;

export type Skill = { mu: number; sigma: number };

export const newRating = (): Skill => ({ mu: BASE_MU, sigma: BASE_SIGMA });

export function displayed(s: Skill): number {
  return Math.round(s.mu * DISPLAY_SCALE * 10) / 10;
}

/** ±1 standard deviation, in display units (~68% confidence). */
export function uncertaintyBand(s: Skill): number {
  return Math.round(s.sigma * DISPLAY_SCALE);
}

/** Rate one session. `teams` are rating groups, `ranks` are 1-based placements (ties = equal). */
export function rateTeams(teams: Skill[][], ranks: number[]): Skill[][] {
  const out = rate(
    teams.map((t) => t.map((r) => rating(r))),
    { rank: ranks },
  );
  return out.map((t) => t.map((r) => ({ mu: r.mu, sigma: r.sigma })));
}

/** Probability that team A beats team B — used for the "upset alert" (§10). */
export function winProbability(teamA: Skill[], teamB: Skill[]): number {
  const [p] = predictWin([teamA.map((r) => rating(r)), teamB.map((r) => rating(r))]);
  return p;
}

// ---------------------------------------------------------------------------
// Silly tier names (§10). Applied to the displayed rating.
// ---------------------------------------------------------------------------

export interface Tier {
  name: string;
  emoji: string;
  min: number;
  color: string;
}

// Cutoffs were calibrated against the old (mu - 3*sigma) scale, which drifted
// upward forever. On the mu-only scale real ratings sit far lower — actual
// current values span roughly 930 to 1140 — so these are retuned to match.
export const TIERS: Tier[] = [
  { name: "Cardboard Cadet", emoji: "🧃", min: -Infinity, color: "#94a3b8" },
  { name: "Meeple Mover", emoji: "🚶", min: 1040, color: "#38bdf8" },
  { name: "Rules Lawyer", emoji: "⚖️", min: 1100, color: "#34d399" },
  { name: "Engine Builder", emoji: "⚙️", min: 1160, color: "#fbbf24" },
  { name: "Combo Merchant", emoji: "🪄", min: 1240, color: "#fb923c" },
  { name: "Table Tyrant", emoji: "👑", min: 1340, color: "#f472b6" },
  { name: "Cardboard Deity", emoji: "🛸", min: 1440, color: "#a78bfa" },
];

export const PROVISIONAL_TIER: Tier = {
  name: "Shrinkwrapped",
  emoji: "📦",
  min: -Infinity,
  color: "#64748b",
};

export function tierFor(displayedRating: number, plays = PROVISIONAL_PLAYS): Tier {
  if (plays < PROVISIONAL_PLAYS) return PROVISIONAL_TIER;
  let t = TIERS[0];
  for (const tier of TIERS) if (displayedRating >= tier.min) t = tier;
  return t;
}

/**
 * The same ladder, entered by composite z-score instead of a per-game rating.
 *
 * A player's overall standing has to come from the overall number (§4), not
 * from whichever single game they happen to be best at — otherwise two people
 * with clearly different composites can land on the same rung, which is both
 * confusing and wrong.
 */
export const OVERALL_TIER_CUTS = [-Infinity, -0.75, -0.35, 0, 0.35, 0.75, 1.25];

export function tierForComposite(composite: number, ranked = true): Tier {
  if (!ranked) return PROVISIONAL_TIER;
  let index = 0;
  OVERALL_TIER_CUTS.forEach((cut, i) => {
    if (composite >= cut) index = i;
  });
  return TIERS[index];
}

/** Progress (0-1) toward the next overall tier. */
export function compositeTierProgress(composite: number): number {
  let index = 0;
  OVERALL_TIER_CUTS.forEach((cut, i) => {
    if (composite >= cut) index = i;
  });
  const lo = index === 0 ? -1.25 : OVERALL_TIER_CUTS[index];
  const hi = index >= OVERALL_TIER_CUTS.length - 1 ? lo + 0.75 : OVERALL_TIER_CUTS[index + 1];
  return Math.max(0, Math.min(1, (composite - lo) / (hi - lo)));
}

/** Where a tier sits on the ladder, for the visual rank ladder. */
export const tierRung = (tier: Tier) => Math.max(0, TIERS.findIndex((t) => t.name === tier.name));

/** Progress (0-1) toward the next tier, for the profile card meter. */
export function tierProgress(displayedRating: number): number {
  const idx = TIERS.findIndex((t) => t.name === tierFor(displayedRating).name);
  const lo = idx <= 0 ? 900 : TIERS[idx].min;
  const hi = idx >= TIERS.length - 1 ? lo + 100 : TIERS[idx + 1].min;
  return Math.max(0, Math.min(1, (displayedRating - lo) / (hi - lo)));
}
