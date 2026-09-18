import { all, get } from "./db";
import {
  COMPOSITE_MIN_PLAYS,
  displayed,
  newRating,
  PROVISIONAL_PLAYS,
  tierFor,
  type Skill,
} from "./rating";
import {
  parseTags,
  type Game,
  type GameSession,
  type Participant,
  type Player,
  type PlayerRow,
} from "./types";

// ---------------------------------------------------------------------------
// Basic entities
// ---------------------------------------------------------------------------

/** Public columns only — `pin_hash` is deliberately never selected here. */
/** Public columns only — credential hashes are deliberately never selected here. */
const PLAYER_COLUMNS = `id, name, emoji, color, tagline, username, role, join_date, active,
                        (password_hash IS NULL) AS needs_password_setup`;

export const getPlayers = (includeInactive = false) =>
  all<Player>(
    `SELECT ${PLAYER_COLUMNS} FROM players
      ${includeInactive ? "" : "WHERE active = 1"} ORDER BY name COLLATE NOCASE`,
  );

/** Used only to decide whether /login shows sign-in or first-time setup. */
export const playerCount = () => get<{ n: number }>("SELECT COUNT(*) AS n FROM players")!.n;

export const getPlayer = (id: number) =>
  get<Player>(`SELECT ${PLAYER_COLUMNS} FROM players WHERE id = ?`, id);

/** Server-only: includes credential hashes. Never pass the result to a client component. */
export const getPlayerRow = (id: number) =>
  get<PlayerRow>("SELECT * FROM players WHERE id = ?", id);

/** Same as above, looked up by username — case-insensitive, like sign-in always is. */
export const getPlayerRowByUsername = (username: string) =>
  get<PlayerRow>("SELECT * FROM players WHERE username = ? COLLATE NOCASE", username);

export const getGames = (includeRetired = false) =>
  all<Game>(
    `SELECT * FROM games ${includeRetired ? "" : "WHERE retired = 0"} ORDER BY name COLLATE NOCASE`,
  );

export const getGame = (id: number) => get<Game>("SELECT * FROM games WHERE id = ?", id);

export interface SessionWithGame extends GameSession {
  game_name: string;
  thumbnail: string | null;
  scoring_mode: Game["scoring_mode"];
}

export const getSessions = (limit = 50, gameId?: number, playerId?: number) =>
  all<SessionWithGame>(
    `SELECT s.*, g.name AS game_name, g.thumbnail, g.scoring_mode
       FROM sessions s JOIN games g ON g.id = s.game_id
      WHERE (? IS NULL OR s.game_id = ?)
        AND (? IS NULL OR EXISTS (SELECT 1 FROM participants p
                                   WHERE p.session_id = s.id AND p.player_id = ?))
      ORDER BY s.played_at DESC, s.id DESC
      LIMIT ?`,
    gameId ?? null,
    gameId ?? null,
    playerId ?? null,
    playerId ?? null,
    limit,
  );

export interface ParticipantRow extends Participant {
  name: string;
  emoji: string;
  color: string;
}

export const getParticipants = (sessionId: number) =>
  all<ParticipantRow>(
    `SELECT p.*, pl.name, pl.emoji, pl.color
       FROM participants p JOIN players pl ON pl.id = p.player_id
      WHERE p.session_id = ?
      ORDER BY p.placement ASC, pl.name COLLATE NOCASE`,
    sessionId,
  );

/**
 * Batched form of {@link getParticipants} — one query for a whole list of
 * sessions instead of one query per session. Any list rendered from
 * `getSessions()` should use this instead of mapping `getParticipants`
 * over each row (that N+1 pattern was the main source of slow page loads
 * on /sessions, the homepage, and the game/player detail pages).
 */
export function getParticipantsForSessions(sessionIds: number[]): Map<number, ParticipantRow[]> {
  const map = new Map<number, ParticipantRow[]>();
  if (sessionIds.length === 0) return map;
  const placeholders = sessionIds.map(() => "?").join(",");
  const rows = all<ParticipantRow>(
    `SELECT p.*, pl.name, pl.emoji, pl.color
       FROM participants p JOIN players pl ON pl.id = p.player_id
      WHERE p.session_id IN (${placeholders})
      ORDER BY p.placement ASC, pl.name COLLATE NOCASE`,
    ...sessionIds,
  );
  for (const r of rows) {
    const arr = map.get(r.session_id);
    if (arr) arr.push(r);
    else map.set(r.session_id, [r]);
  }
  return map;
}

export const getSession = (id: number) =>
  get<SessionWithGame>(
    `SELECT s.*, g.name AS game_name, g.thumbnail, g.scoring_mode
       FROM sessions s JOIN games g ON g.id = s.game_id WHERE s.id = ?`,
    id,
  );

// ---------------------------------------------------------------------------
// Current ratings
// ---------------------------------------------------------------------------

export interface PoolRating {
  player_id: number;
  game_id: number;
  variant: string;
  tag: string;
  mu: number;
  sigma: number;
  displayed_rating: number;
  played_at: string;
}

/**
 * Latest snapshot per pool (player, game, variant, tag). Replay inserts
 * chronologically, so MAX(id) is the current standing.
 */
export function currentRatings(gameId?: number, tag?: string, variant = ""): PoolRating[] {
  return all<PoolRating>(
    `SELECT rs.player_id, rs.game_id, rs.variant, rs.tag, rs.mu, rs.sigma,
            rs.displayed_rating, rs.played_at
       FROM rating_snapshots rs
       JOIN (SELECT player_id, game_id, variant, tag, MAX(id) AS mid
               FROM rating_snapshots GROUP BY player_id, game_id, variant, tag) m
         ON m.mid = rs.id
      WHERE (? IS NULL OR rs.game_id = ?) AND (? IS NULL OR rs.tag = ?) AND rs.variant = ?`,
    gameId ?? null,
    gameId ?? null,
    tag ?? null,
    tag ?? null,
    variant,
  );
}

/** Rated plays per player per game (co-ops excluded — they never rate). */
export function playCounts(): Map<string, number> {
  const rows = all<{ player_id: number; game_id: number; n: number }>(
    `SELECT p.player_id, s.game_id, COUNT(*) AS n
       FROM participants p
       JOIN sessions s ON s.id = p.session_id
       JOIN games g ON g.id = s.game_id
      WHERE g.scoring_mode != 'coop-vs-game' AND g.rated = 1
      GROUP BY p.player_id, s.game_id`,
  );
  return new Map(rows.map((r) => [`${r.player_id}|${r.game_id}`, r.n]));
}

export interface LeaderboardRow {
  player: Player;
  mu: number;
  sigma: number;
  rating: number;
  plays: number;
  wins: number;
  winRate: number;
  provisional: boolean;
  tier: ReturnType<typeof tierFor>;
  delta7d: number | null;
}

/**
 * Leaderboard for one pool: a whole game, one of its variants, or a
 * role/faction sub-pool.
 */
export function gameLeaderboard(gameId: number, tag = "", variant = ""): LeaderboardRow[] {
  const players = new Map(getPlayers(true).map((p) => [p.id, p]));
  const ratings = currentRatings(gameId, tag, variant);
  const counts = tag
    ? tagPlayCounts(gameId, variant).get(tag) ?? new Map<number, number>()
    : new Map(
        all<{ player_id: number; n: number }>(
          `SELECT p.player_id, COUNT(*) AS n FROM participants p
             JOIN sessions s ON s.id = p.session_id
            WHERE s.game_id = ? AND (? = '' OR s.variant = ?) GROUP BY p.player_id`,
          gameId,
          variant,
          variant,
        ).map((r) => [r.player_id, r.n]),
      );
  // A tagged pool's win count has to agree with the SAME side that produced
  // `counts` above — otherwise a player who won on the *other* side last time
  // out inflates this side's win rate (it's how a 1-play pool once read
  // "200% wins": wins came from both sides, plays from only this one).
  const wins = tag
    ? tagWinCounts(gameId, variant).get(tag) ?? new Map<number, number>()
    : new Map(
        all<{ player_id: number; n: number }>(
          `SELECT p.player_id, COUNT(*) AS n FROM participants p
             JOIN sessions s ON s.id = p.session_id
            WHERE s.game_id = ? AND p.placement = 1 AND (? = '' OR s.variant = ?)
            GROUP BY p.player_id`,
          gameId,
          variant,
          variant,
        ).map((r) => [r.player_id, r.n]),
      );
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  // One query for everyone's "rating 7 days ago" instead of one per row.
  const priors = new Map(
    all<{ player_id: number; displayed_before: number }>(
      `SELECT rs.player_id, rs.displayed_before
         FROM rating_snapshots rs
         JOIN (SELECT player_id, MIN(id) AS mid FROM rating_snapshots
                WHERE game_id = ? AND tag = ? AND variant = ? AND played_at >= ?
                GROUP BY player_id) f ON f.mid = rs.id`,
      gameId,
      tag,
      variant,
      weekAgo,
    ).map((r) => [r.player_id, r.displayed_before]),
  );

  return ratings
    .map((r) => {
      const player = players.get(r.player_id);
      if (!player) return null;
      const plays = counts.get(r.player_id) ?? 0;
      const w = wins.get(r.player_id) ?? 0;
      const prior = priors.get(r.player_id);
      return {
        player,
        mu: r.mu,
        sigma: r.sigma,
        rating: r.displayed_rating,
        plays,
        wins: w,
        winRate: plays ? w / plays : 0,
        provisional: plays < PROVISIONAL_PLAYS,
        tier: tierFor(r.displayed_rating, plays),
        delta7d: prior !== undefined ? Math.round((r.displayed_rating - prior) * 10) / 10 : null,
      } satisfies LeaderboardRow;
    })
    .filter((r): r is LeaderboardRow => r !== null)
    .sort((a, b) => b.rating - a.rating);
}

/**
 * Plays per tag per player for a game (tag sub-leaderboards / analytics).
 * `variant` matches {@link currentRatings}: '' pools every session of the
 * game (a role split that belongs to the game itself), a name scopes to just
 * that variant (a role split that belongs to one specific way of playing it).
 */
export function tagPlayCounts(gameId: number, variant = ""): Map<string, Map<number, number>> {
  return tagCounts(gameId, variant, false);
}

/**
 * Wins per tag per player — the win side of {@link tagPlayCounts}. Kept as
 * its own function (rather than reusing plays for the denominator) because a
 * player's wins have to come from the *same* tagged side, or a pool's win
 * rate silently counts victories won on the other side entirely.
 */
export function tagWinCounts(gameId: number, variant = ""): Map<string, Map<number, number>> {
  return tagCounts(gameId, variant, true);
}

function tagCounts(gameId: number, variant: string, winnersOnly: boolean): Map<string, Map<number, number>> {
  const rows = all<{ player_id: number; tags: string | null }>(
    `SELECT p.player_id, p.tags FROM participants p
       JOIN sessions s ON s.id = p.session_id
      WHERE s.game_id = ? AND (? = '' OR s.variant = ?) ${winnersOnly ? "AND p.placement = 1" : ""}`,
    gameId,
    variant,
    variant,
  );
  const out = new Map<string, Map<number, number>>();
  for (const r of rows) {
    for (const t of parseTags(r.tags)) {
      const m = out.get(t) ?? new Map<number, number>();
      m.set(r.player_id, (m.get(r.player_id) ?? 0) + 1);
      out.set(t, m);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Overall composite — z-scores across games (§4)
// ---------------------------------------------------------------------------

export interface CompositeRow {
  player: Player;
  composite: number;
  qualifyingGames: { game_id: number; name: string; z: number; mu: number; plays: number }[];
  totalPlays: number;
  wins: number;
  ranked: boolean;
  /**
   * True when every qualifying game is still below the display-gating
   * threshold — i.e. nothing behind this composite is established enough to
   * show a real tier badge yet. Used to decide whether a podium of these
   * composites is presenting a settled ranking or just an early guess.
   */
  provisional: boolean;
}

export function overallComposite(): CompositeRow[] {
  const players = getPlayers(true);
  const games = new Map(getGames(true).map((g) => [g.id, g]));
  const ratings = currentRatings(undefined, "");
  const counts = playCounts();

  // Group average mu + population sd, per game.
  const byGame = new Map<number, PoolRating[]>();
  for (const r of ratings) {
    const arr = byGame.get(r.game_id);
    if (arr) arr.push(r);
    else byGame.set(r.game_id, [r]);
  }
  const stats = new Map<number, { mean: number; sd: number }>();
  for (const [gid, rows] of byGame) {
    const mus = rows.map((r) => r.mu);
    const mean = mus.reduce((a, b) => a + b, 0) / mus.length;
    const variance = mus.reduce((a, b) => a + (b - mean) ** 2, 0) / mus.length;
    stats.set(gid, { mean, sd: Math.sqrt(variance) });
  }

  const totals = new Map(
    all<{ player_id: number; n: number; w: number }>(
      `SELECT p.player_id, COUNT(*) AS n, SUM(CASE WHEN p.placement = 1 THEN 1 ELSE 0 END) AS w
         FROM participants p GROUP BY p.player_id`,
    ).map((r) => [r.player_id, r]),
  );

  return players
    .map((player) => {
      const qualifying: CompositeRow["qualifyingGames"] = [];
      for (const r of ratings) {
        if (r.player_id !== player.id) continue;
        const plays = counts.get(`${player.id}|${r.game_id}`) ?? 0;
        if (plays < COMPOSITE_MIN_PLAYS) continue; // §4: 3+ plays to qualify
        const st = stats.get(r.game_id);
        const pool = byGame.get(r.game_id) ?? [];
        if (!st || pool.length < 2) continue;
        const z = st.sd > 0 ? (r.mu - st.mean) / st.sd : 0;
        qualifying.push({
          game_id: r.game_id,
          name: games.get(r.game_id)?.name ?? "?",
          z: Math.round(z * 100) / 100,
          mu: r.mu,
          plays,
        });
      }
      qualifying.sort((a, b) => b.z - a.z);
      const composite = qualifying.length
        ? qualifying.reduce((a, b) => a + b.z, 0) / qualifying.length
        : 0;
      const t = totals.get(player.id);
      return {
        player,
        composite: Math.round(composite * 100) / 100,
        qualifyingGames: qualifying,
        totalPlays: t?.n ?? 0,
        wins: t?.w ?? 0,
        ranked: qualifying.length > 0,
        provisional: qualifying.every((g) => g.plays < PROVISIONAL_PLAYS),
      } satisfies CompositeRow;
    })
    .sort((a, b) => Number(b.ranked) - Number(a.ranked) || b.composite - a.composite);
}

// ---------------------------------------------------------------------------
// Player-level stats (player card, §10)
// ---------------------------------------------------------------------------

export interface PlayerStats {
  plays: number;
  wins: number;
  winRate: number;
  podiums: number;
  favoriteGame: { name: string; id: number; plays: number } | null;
  bestGame: { name: string; id: number; rating: number } | null;
  nemesis: { player: Player; losses: number; wins: number } | null;
  prey: { player: Player; losses: number; wins: number } | null;
  currentStreak: { kind: "W" | "L"; length: number };
  longestWinStreak: number;
  lastPlayed: string | null;
  coopWins: number;
  coopLosses: number;
}

export function playerStats(playerId: number): PlayerStats {
  const rows = all<{
    session_id: number;
    game_id: number;
    game_name: string;
    placement: number;
    played_at: string;
    field: number;
    scoring_mode: Game["scoring_mode"];
    rated: number;
    coop_result: string | null;
  }>(
    `SELECT p.session_id, s.game_id, g.name AS game_name, p.placement, s.played_at,
            g.scoring_mode, g.rated, s.coop_result,
            (SELECT COUNT(*) FROM participants x WHERE x.session_id = s.id) AS field
       FROM participants p
       JOIN sessions s ON s.id = p.session_id
       JOIN games g ON g.id = s.game_id
      WHERE p.player_id = ?
      ORDER BY s.played_at ASC, s.id ASC`,
    playerId,
  );

  // Win rate and streaks track the games that are actually a contest.
  const competitive = rows.filter((r) => r.scoring_mode !== "coop-vs-game" && !!r.rated);
  const wins = competitive.filter((r) => r.placement === 1).length;
  const podiums = competitive.filter(
    (r) => r.placement <= Math.max(1, Math.ceil(r.field / 2)),
  ).length;

  const gameCounts = new Map<number, { name: string; plays: number }>();
  for (const r of rows) {
    const e = gameCounts.get(r.game_id) ?? { name: r.game_name, plays: 0 };
    e.plays++;
    gameCounts.set(r.game_id, e);
  }
  let favorite: PlayerStats["favoriteGame"] = null;
  for (const [id, v] of gameCounts)
    if (!favorite || v.plays > favorite.plays) favorite = { id, name: v.name, plays: v.plays };

  // Best game = highest displayed rating among pools that qualify for the
  // composite (COMPOSITE_MIN_PLAYS) — same bar as overallComposite(), not the
  // higher display-gating threshold that decides whether a tier badge shows.
  const counts = playCounts();
  let best: PlayerStats["bestGame"] = null;
  for (const r of currentRatings(undefined, "")) {
    if (r.player_id !== playerId) continue;
    if ((counts.get(`${playerId}|${r.game_id}`) ?? 0) < COMPOSITE_MIN_PLAYS) continue;
    if (!best || r.displayed_rating > best.rating) {
      const g = getGame(r.game_id);
      best = { id: r.game_id, name: g?.name ?? "?", rating: r.displayed_rating };
    }
  }

  // Head-to-head: nemesis (beats you most) and prey (you beat most).
  // Needs a few real meetings — one unlucky evening is not a nemesis.
  const MIN_RIVALRY_MEETINGS = 3;
  const h2h = headToHeadAll(playerId).filter((r) => r.meetings >= MIN_RIVALRY_MEETINGS);
  let nemesis: PlayerStats["nemesis"] = null;
  let prey: PlayerStats["prey"] = null;
  for (const r of h2h) {
    if (r.losses > r.wins && (!nemesis || r.losses - r.wins > nemesis.losses - nemesis.wins))
      nemesis = { player: r.opponent, losses: r.losses, wins: r.wins };
    if (r.wins > r.losses && (!prey || r.wins - r.losses > prey.wins - prey.losses))
      prey = { player: r.opponent, losses: r.losses, wins: r.wins };
  }

  // Streaks (competitive games only; a "win" is placement 1).
  let cur: PlayerStats["currentStreak"] = { kind: "W", length: 0 };
  let longest = 0;
  let running = 0;
  for (const r of competitive) {
    if (r.placement === 1) {
      running++;
      longest = Math.max(longest, running);
    } else running = 0;
  }
  for (let i = competitive.length - 1; i >= 0; i--) {
    const won = competitive[i].placement === 1;
    if (cur.length === 0) cur = { kind: won ? "W" : "L", length: 1 };
    else if ((cur.kind === "W") === won) cur.length++;
    else break;
  }

  const coop = rows.filter((r) => r.scoring_mode === "coop-vs-game");

  return {
    plays: rows.length,
    wins,
    winRate: competitive.length ? wins / competitive.length : 0,
    podiums,
    favoriteGame: favorite,
    bestGame: best,
    nemesis,
    prey,
    currentStreak: cur,
    longestWinStreak: longest,
    lastPlayed: rows.length ? rows[rows.length - 1].played_at : null,
    coopWins: coop.filter((r) => r.coop_result === "win").length,
    coopLosses: coop.filter((r) => r.coop_result === "loss").length,
  };
}

export interface H2HRow {
  opponent: Player;
  wins: number;
  losses: number;
  ties: number;
  /** Sessions where they faced each other — wins + losses + ties. */
  meetings: number;
  /** Sessions played on the same side; not a rivalry result either way. */
  together: number;
  /** Sessions on the same side that the side won. */
  togetherWins: number;
  /** Of the meetings, the ones where one of the two actually took first. */
  decisiveWins: number;
  decisiveLosses: number;
}

/**
 * Head-to-head records (§8 rivalries).
 *
 * Two people on the same team in Codenames, or the same side in Avalon, share
 * a placement — counting that as a "tie" would quietly turn every teammate
 * into a rival with a padded record. Same-side sessions are therefore tallied
 * separately as `together`, and only genuine opposition feeds W/L/T.
 *
 * In a ranked game the record is "who finished ahead", so 2nd vs 3rd in a
 * four-player game is a win for the 2nd-place player and a mirrored loss for
 * the 3rd — the same signal the rating engine reads. Because mid-table places
 * can feel like weak evidence, `decisive*` separately counts the sessions
 * where one of the two actually took first.
 */
export function headToHeadAll(playerId: number): H2HRow[] {
  const rows = all<{
    opponent_id: number;
    mine: number;
    theirs: number;
    my_side: string | null;
    their_side: string | null;
  }>(
    `SELECT b.player_id AS opponent_id, a.placement AS mine, b.placement AS theirs,
            a.team AS my_side, b.team AS their_side
       FROM participants a
       JOIN participants b ON b.session_id = a.session_id AND b.player_id != a.player_id
       JOIN sessions s ON s.id = a.session_id
       JOIN games g ON g.id = s.game_id
      WHERE a.player_id = ? AND g.scoring_mode != 'coop-vs-game' AND g.rated = 1`,
    playerId,
  );
  const players = new Map(getPlayers(true).map((p) => [p.id, p]));
  const agg = new Map<number, H2HRow>();

  for (const r of rows) {
    const opponent = players.get(r.opponent_id);
    if (!opponent) continue;
    const e =
      agg.get(r.opponent_id) ??
      ({
        opponent,
        wins: 0,
        losses: 0,
        ties: 0,
        meetings: 0,
        together: 0,
        togetherWins: 0,
        decisiveWins: 0,
        decisiveLosses: 0,
      } satisfies H2HRow);

    // `team` is only set for side-based games, so a null here means free-for-all.
    const sameSide = r.my_side !== null && r.my_side === r.their_side;
    if (sameSide) {
      e.together++;
      if (r.mine === 1) e.togetherWins++;
    } else {
      e.meetings++;
      if (r.mine < r.theirs) e.wins++;
      else if (r.mine > r.theirs) e.losses++;
      else e.ties++;
      if (r.mine === 1 && r.theirs !== 1) e.decisiveWins++;
      if (r.theirs === 1 && r.mine !== 1) e.decisiveLosses++;
    }
    agg.set(r.opponent_id, e);
  }

  return [...agg.values()]
    .filter((r) => r.meetings > 0 || r.together > 0)
    .sort((a, b) => b.meetings - a.meetings || b.together - a.together);
}

// ---------------------------------------------------------------------------
// Analytics (§8)
// ---------------------------------------------------------------------------

export interface TrajectoryPoint {
  session_id: number | null;
  played_at: string;
  rating: number;
  game_id: number;
  tag: string;
}

export const trajectory = (playerId: number, gameId?: number, tag = "", variant = "") =>
  all<TrajectoryPoint>(
    `SELECT session_id, played_at, displayed_rating AS rating, game_id, tag
       FROM rating_snapshots
      WHERE player_id = ? AND tag = ? AND variant = ? AND (? IS NULL OR game_id = ?)
      ORDER BY played_at ASC, id ASC`,
    playerId,
    tag,
    variant,
    gameId ?? null,
    gameId ?? null,
  );

/** How often each named variant of a game actually gets played. */
export const variantPlayCounts = (gameId: number) =>
  all<{ variant: string; plays: number; last: string }>(
    `SELECT COALESCE(NULLIF(variant, ''), '') AS variant, COUNT(*) AS plays, MAX(played_at) AS last
       FROM sessions WHERE game_id = ? GROUP BY variant ORDER BY plays DESC`,
    gameId,
  );

/** GitHub-style calendar of game nights. */
export const nightHeatmap = (days = 365) =>
  all<{ day: string; sessions: number }>(
    `SELECT substr(played_at, 1, 10) AS day, COUNT(*) AS sessions
       FROM sessions WHERE played_at >= ? GROUP BY day ORDER BY day`,
    new Date(Date.now() - days * 864e5).toISOString(),
  );

export interface UpsetRow {
  session_id: number;
  played_at: string;
  game_name: string;
  winner: Player;
  loser: Player;
  gap: number;
}

/** Biggest upsets: winner's pre-session rating vs. the best player they beat. */
export function biggestUpsets(limit = 10): UpsetRow[] {
  const rows = all<{
    session_id: number;
    played_at: string;
    game_name: string;
    winner_id: number;
    loser_id: number;
    gap: number;
  }>(
    `SELECT w.session_id, w.played_at, g.name AS game_name,
            w.player_id AS winner_id, l.player_id AS loser_id,
            (l.displayed_before - w.displayed_before) AS gap
       FROM rating_snapshots w
       JOIN participants wp ON wp.session_id = w.session_id AND wp.player_id = w.player_id
       JOIN rating_snapshots l ON l.session_id = w.session_id AND l.tag = ''
                              AND l.player_id != w.player_id
       JOIN participants lp ON lp.session_id = l.session_id AND lp.player_id = l.player_id
       JOIN sessions s ON s.id = w.session_id
       JOIN games g ON g.id = s.game_id
      WHERE w.tag = '' AND wp.placement = 1 AND lp.placement > wp.placement
      ORDER BY gap DESC LIMIT ?`,
    limit * 3,
  );
  const players = new Map(getPlayers(true).map((p) => [p.id, p]));
  const seen = new Set<number>();
  const out: UpsetRow[] = [];
  for (const r of rows) {
    if (seen.has(r.session_id) || r.gap <= 0) continue;
    const winner = players.get(r.winner_id);
    const loser = players.get(r.loser_id);
    if (!winner || !loser) continue;
    seen.add(r.session_id);
    out.push({
      session_id: r.session_id,
      played_at: r.played_at,
      game_name: r.game_name,
      winner,
      loser,
      gap: Math.round(r.gap * 10) / 10,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Win rate by table size — the "2-player specialist vs 5-player chaos" cut. */
export const winRateByPlayerCount = (playerId: number) =>
  all<{ field: number; plays: number; wins: number }>(
    `SELECT (SELECT COUNT(*) FROM participants x WHERE x.session_id = s.id) AS field,
            COUNT(*) AS plays,
            SUM(CASE WHEN p.placement = 1 THEN 1 ELSE 0 END) AS wins
       FROM participants p
       JOIN sessions s ON s.id = p.session_id
       JOIN games g ON g.id = s.game_id
      WHERE p.player_id = ? AND g.scoring_mode != 'coop-vs-game' AND g.rated = 1
      GROUP BY field ORDER BY field`,
    playerId,
  );

/** Personal bests / high scores for a game. */
export const highScores = (gameId: number, limit = 10) =>
  all<{
    player_id: number;
    name: string;
    emoji: string;
    score: number;
    session_id: number;
    played_at: string;
  }>(
    `SELECT p.player_id, pl.name, pl.emoji, p.score, s.id AS session_id, s.played_at
       FROM participants p
       JOIN sessions s ON s.id = p.session_id
       JOIN players pl ON pl.id = p.player_id
      WHERE s.game_id = ? AND p.score IS NOT NULL
      ORDER BY p.score DESC LIMIT ?`,
    gameId,
    limit,
  );

/** Co-op: win rate by difficulty for one game (§5.3). */
export const coopByDifficulty = (gameId: number) =>
  all<{ difficulty: string; plays: number; wins: number }>(
    `SELECT COALESCE(NULLIF(difficulty, ''), 'unspecified') AS difficulty, COUNT(*) AS plays,
            SUM(CASE WHEN coop_result = 'win' THEN 1 ELSE 0 END) AS wins
       FROM sessions WHERE game_id = ? GROUP BY difficulty ORDER BY difficulty`,
    gameId,
  );

/** Most improved over a window — biggest displayed-rating gain across base pools. */
export function mostImproved(days = 90, limit = 5) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const rows = all<{
    player_id: number;
    game_id: number;
    start_rating: number | null;
    end_rating: number | null;
  }>(
    `SELECT rs.player_id, rs.game_id,
            (SELECT x.displayed_before FROM rating_snapshots x
              WHERE x.player_id = rs.player_id AND x.game_id = rs.game_id AND x.tag = ''
                AND x.played_at >= ? ORDER BY x.id ASC LIMIT 1) AS start_rating,
            (SELECT y.displayed_rating FROM rating_snapshots y
              WHERE y.player_id = rs.player_id AND y.game_id = rs.game_id AND y.tag = ''
              ORDER BY y.id DESC LIMIT 1) AS end_rating
       FROM rating_snapshots rs
      WHERE rs.tag = '' AND rs.played_at >= ?
      GROUP BY rs.player_id, rs.game_id`,
    since,
    since,
  );
  const players = new Map(getPlayers(true).map((p) => [p.id, p]));
  const agg = new Map<number, number>();
  for (const r of rows) {
    if (r.start_rating == null || r.end_rating == null) continue;
    agg.set(r.player_id, (agg.get(r.player_id) ?? 0) + (r.end_rating - r.start_rating));
  }
  return [...agg.entries()]
    .map(([id, gain]) => ({ player: players.get(id), gain: Math.round(gain * 10) / 10 }))
    .filter((r): r is { player: Player; gain: number } => !!r.player && r.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, limit);
}

/** Per-tag ratings for a game (faction / role breakdown, §5.1–5.2). */
export interface TagRatingRow {
  tag: string;
  player: Player;
  rating: number;
  mu: number;
  sigma: number;
  plays: number;
  wins: number;
}

export function tagRatings(gameId: number, variant = ""): TagRatingRow[] {
  const players = new Map(getPlayers(true).map((p) => [p.id, p]));
  const counts = tagPlayCounts(gameId, variant);
  const winRows = all<{ player_id: number; tags: string | null }>(
    `SELECT p.player_id, p.tags FROM participants p
       JOIN sessions s ON s.id = p.session_id
      WHERE s.game_id = ? AND p.placement = 1 AND (? = '' OR s.variant = ?)`,
    gameId,
    variant,
    variant,
  );
  const wins = new Map<string, number>();
  for (const r of winRows)
    for (const t of parseTags(r.tags))
      wins.set(`${t}|${r.player_id}`, (wins.get(`${t}|${r.player_id}`) ?? 0) + 1);

  return currentRatings(gameId, undefined, variant)
    .filter((r) => r.tag !== "")
    .map((r) => ({
      tag: r.tag,
      player: players.get(r.player_id),
      rating: r.displayed_rating,
      mu: r.mu,
      sigma: r.sigma,
      plays: counts.get(r.tag)?.get(r.player_id) ?? 0,
      wins: wins.get(`${r.tag}|${r.player_id}`) ?? 0,
    }))
    .filter((r): r is TagRatingRow => !!r.player)
    .sort((a, b) => a.tag.localeCompare(b.tag) || b.rating - a.rating);
}

/** Which tag combos win most (multi-tag analytics, §5.2). */
export function comboStats(gameId: number, minPlays = 2) {
  const rows = all<{ tags: string | null; placement: number }>(
    `SELECT p.tags, p.placement FROM participants p
       JOIN sessions s ON s.id = p.session_id WHERE s.game_id = ?`,
    gameId,
  );
  const agg = new Map<string, { combo: string[]; plays: number; wins: number }>();
  for (const r of rows) {
    const tags = parseTags(r.tags);
    if (tags.length < 2) continue;
    const combo = [...tags].sort();
    const k = combo.join(" + ");
    const e = agg.get(k) ?? { combo, plays: 0, wins: 0 };
    e.plays++;
    if (r.placement === 1) e.wins++;
    agg.set(k, e);
  }
  return [...agg.values()]
    .filter((c) => c.plays >= minPlays)
    .sort((a, b) => b.wins / b.plays - a.wins / a.plays || b.plays - a.plays);
}

/** Aggregate numbers for the home dashboard. */
export function dashboardSummary() {
  const totals = get<{ sessions: number; games: number; players: number }>(
    `SELECT (SELECT COUNT(*) FROM sessions) AS sessions,
            (SELECT COUNT(*) FROM games) AS games,
            (SELECT COUNT(*) FROM players WHERE active = 1) AS players`,
  )!;
  const last = get<{ played_at: string }>(
    "SELECT played_at FROM sessions ORDER BY played_at DESC LIMIT 1",
  );
  const days30 = get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM sessions WHERE played_at >= ?",
    new Date(Date.now() - 30 * 864e5).toISOString(),
  )!;
  return { ...totals, lastPlayed: last?.played_at ?? null, last30: days30.n };
}

/** Current skill for a pool with a sane default — used by the live session preview. */
export function skillFor(playerId: number, gameId: number, tag = ""): Skill {
  const r = get<{ mu: number; sigma: number }>(
    `SELECT mu, sigma FROM rating_snapshots
      WHERE player_id = ? AND game_id = ? AND tag = ? ORDER BY id DESC LIMIT 1`,
    playerId,
    gameId,
    tag,
  );
  return r ?? newRating();
}

export const displayedFor = (playerId: number, gameId: number, tag = "") =>
  displayed(skillFor(playerId, gameId, tag));
