export type ScoringMode = "ranked-ffa" | "team-vs-team" | "hidden-team" | "coop-vs-game";
export type RatingDimension = "none" | "single-tag" | "multi-tag";

/**
 * How finely a game distinguishes the losers (§5.5).
 *
 *   ranked       there is a real 2nd, 3rd, 4th — a final scoring round everyone
 *                completes, or an elimination order that says who lasted longer
 *   winner-only  someone wins and everyone else simply loses; the game ends the
 *                moment it's decided and the others' positions aren't comparable
 *
 * This is independent of whether a score is recorded. Risk has a meaningful
 * finishing order and no score at all; Coup has neither; Poker has both.
 */
export type ResultMode = "ranked" | "winner-only";

/**
 * The player shape that is safe to hand to the browser. The PIN hash lives
 * only in `PlayerRow`, which never leaves the server.
 */
export interface Player {
  id: number;
  name: string;
  emoji: string;
  color: string;
  tagline: string | null;
  /** 1 when this player has set a PIN — the hash itself stays server-side. */
  has_pin: number;
  join_date: string;
  active: number;
}

export interface PlayerRow extends Player {
  pin_hash: string | null;
}

export interface Game {
  id: number;
  name: string;
  bgg_id: number | null;
  thumbnail: string | null;
  year: number | null;
  min_players: number | null;
  max_players: number | null;
  weight: number | null;
  scoring_mode: ScoringMode;
  result_mode: ResultMode;
  /** 0 = logged for plays and streaks, but never fed to the rating engine. */
  rated: number;
  rating_dimension: RatingDimension;
  tag_pool: string | null;
  tag_label: string | null;
  tags_per_player: number;
  tracks_score: number;
  /** Free-for-all games that are sometimes played in partnerships (Cribbage at 4). */
  allows_teams: number;
  /** JSON array of Variant — named ways of playing this game. */
  variants: string | null;
  tracks_difficulty: number;
  high_score_wins: number;
  retired: number;
  created_at: string;
}

/**
 * A named way of playing a game (§5.4). Cribbage isn't one game — it's
 * "classic 1v1", "three-handed", "partners at four", plus whatever house
 * variants a group invents. Each keeps its own rating pool under the parent
 * game, the same way a hidden role does (§5.1), and can override the bits of
 * the parent config that actually differ.
 */
export interface Variant {
  name: string;
  min_players?: number | null;
  max_players?: number | null;
  allows_teams?: boolean;
  notes?: string | null;
}

export function parseVariants(raw: string | null | undefined): Variant[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is Variant => !!x && typeof x.name === "string" && x.name.trim() !== "")
      .map((x) => ({
        name: x.name.trim(),
        min_players: x.min_players ?? null,
        max_players: x.max_players ?? null,
        allows_teams: !!x.allows_teams,
        notes: x.notes ?? null,
      }));
  } catch {
    return [];
  }
}

export const gameVariants = (game: Pick<Game, "variants">) => parseVariants(game.variants);

/** The effective config for a session: the game, with the variant's overrides. */
export function effectiveConfig(game: Game, variantName?: string | null) {
  const variant = gameVariants(game).find((v) => v.name === variantName);
  return {
    variant: variant ?? null,
    min_players: variant?.min_players ?? game.min_players,
    max_players: variant?.max_players ?? game.max_players,
    allows_teams: variant ? !!variant.allows_teams : !!game.allows_teams,
  };
}

export interface GameSession {
  id: number;
  game_id: number;
  played_at: string;
  variant: string | null;
  notes: string | null;
  difficulty: string | null;
  coop_result: "win" | "loss" | null;
  season_id: number | null;
  logged_by: number | null;
  created_at: string;
}

export interface Participant {
  id: number;
  session_id: number;
  player_id: number;
  placement: number;
  score: number | null;
  team: string | null;
  tags: string | null;
}

export interface RatingSnapshot {
  id: number;
  session_id: number | null;
  player_id: number;
  game_id: number;
  tag: string;
  season_id: number | null;
  mu: number;
  sigma: number;
  displayed_rating: number;
  mu_before: number;
  sigma_before: number;
  displayed_before: number;
  played_at: string;
  created_at: string;
}

/** Shape the session-entry form posts to /api/sessions. */
export interface SessionInput {
  game_id: number;
  variant?: string | null;
  played_at?: string;
  notes?: string | null;
  difficulty?: string | null;
  coop_result?: "win" | "loss" | null;
  logged_by?: number | null;
  participants: {
    player_id: number;
    placement: number;
    score?: number | null;
    team?: string | null;
    tags?: string[] | null;
  }[];
}

export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function tagPool(game: Pick<Game, "tag_pool">): string[] {
  return parseTags(game.tag_pool);
}

export const SCORING_MODE_LABELS: Record<ScoringMode, string> = {
  "ranked-ffa": "Free-for-all",
  "team-vs-team": "Teams",
  "hidden-team": "Hidden teams",
  "coop-vs-game": "Co-op vs. the game",
};

export const REACTION_EMOJI = ["🔥", "😂", "💀", "👑", "🐍", "🤡", "😭", "🎲"] as const;
