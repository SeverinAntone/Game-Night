import { all, getDb, nowIso } from "./db";
import { getGames } from "./queries";
import type { Game } from "./types";

/**
 * Bradley-Terry preference model (design doc §7).
 *
 * People are far better at "A or B?" than at absolute 1-10 scores, so the Game
 * Draft tab collects pairwise duels and this fits strengths to them with the
 * standard MM (minorisation-maximisation) update:
 *
 *     p_i  <-  W_i / SUM_j!=i ( N_ij / (p_i + p_j) )
 *
 * A half-win/half-loss against a phantom average opponent regularises the fit
 * so an undefeated game doesn't run off to infinity after one duel.
 */

const PRIOR = 0.5; // virtual wins + losses vs. a phantom opponent of strength 1

export interface PreferenceRow {
  game: Game;
  strength: number;
  score: number; // 0-100, friendlier to display than raw strength
  rank: number;
  comparisons: number;
  wins: number;
}

export function fitPreferences(playerId: number): PreferenceRow[] {
  const duels = all<{ winner_game_id: number; loser_game_id: number }>(
    "SELECT winner_game_id, loser_game_id FROM preference_comparisons WHERE player_id = ?",
    playerId,
  );
  const games = getGames();
  const byId = new Map(games.map((g) => [g.id, g]));

  const ids = [...new Set(duels.flatMap((d) => [d.winner_game_id, d.loser_game_id]))].filter((id) =>
    byId.has(id),
  );
  if (ids.length < 2) return [];

  const idx = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  const wins = new Array(n).fill(0);
  const meets: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const total = new Array(n).fill(0);

  for (const d of duels) {
    const i = idx.get(d.winner_game_id);
    const j = idx.get(d.loser_game_id);
    if (i === undefined || j === undefined || i === j) continue;
    wins[i]++;
    meets[i][j]++;
    meets[j][i]++;
    total[i]++;
    total[j]++;
  }

  let p = new Array(n).fill(1);
  for (let iter = 0; iter < 300; iter++) {
    const next = new Array(n).fill(1);
    for (let i = 0; i < n; i++) {
      let denom = PRIOR * 2 / (p[i] + 1); // phantom opponent, strength 1
      for (let j = 0; j < n; j++) {
        if (i === j || meets[i][j] === 0) continue;
        denom += meets[i][j] / (p[i] + p[j]);
      }
      next[i] = denom > 0 ? (wins[i] + PRIOR) / denom : p[i];
    }
    // Normalise to geometric mean 1 to keep the scale stable between iterations.
    const logMean = next.reduce((a, b) => a + Math.log(b), 0) / n;
    const scale = Math.exp(logMean);
    const scaled = next.map((v) => v / scale);
    const delta = scaled.reduce((a, v, i) => a + Math.abs(v - p[i]), 0);
    p = scaled;
    if (delta < 1e-9) break;
  }

  const logs = p.map((v) => Math.log(v));
  const lo = Math.min(...logs);
  const hi = Math.max(...logs);
  const span = hi - lo || 1;

  return ids
    .map((id, i) => ({
      game: byId.get(id)!,
      strength: Math.round(p[i] * 1000) / 1000,
      score: Math.round(((logs[i] - lo) / span) * 100),
      rank: 0,
      comparisons: total[i],
      wins: wins[i],
    }))
    .sort((a, b) => b.strength - a.strength)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Recompute + persist the materialised preference table for a player (§6). */
export function persistPreferences(playerId: number) {
  const rows = fitPreferences(playerId);
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM game_preferences WHERE player_id = ?").run(playerId);
    const ins = db.prepare(
      `INSERT INTO game_preferences (player_id, game_id, method, strength, rank, comparisons, updated_at)
       VALUES (?, ?, 'bradley_terry', ?, ?, ?, ?)`,
    );
    const at = nowIso();
    for (const r of rows) ins.run(playerId, r.game.id, r.strength, r.rank, r.comparisons, at);
  })();
  return rows;
}

/**
 * Pick the next duel: favour games this player has compared least, then pairs
 * whose current strengths are closest (most informative comparison).
 */
export function nextDuel(playerId: number): [Game, Game] | null {
  const games = getGames();
  if (games.length < 2) return null;

  const counts = new Map<number, number>(games.map((g) => [g.id, 0]));
  const seen = new Set<string>();
  for (const d of all<{ winner_game_id: number; loser_game_id: number }>(
    "SELECT winner_game_id, loser_game_id FROM preference_comparisons WHERE player_id = ?",
    playerId,
  )) {
    counts.set(d.winner_game_id, (counts.get(d.winner_game_id) ?? 0) + 1);
    counts.set(d.loser_game_id, (counts.get(d.loser_game_id) ?? 0) + 1);
    seen.add([d.winner_game_id, d.loser_game_id].sort((a, b) => a - b).join("-"));
  }

  const strength = new Map(fitPreferences(playerId).map((r) => [r.game.id, r.strength]));
  const pairs: { a: Game; b: Game; cost: number }[] = [];
  for (let i = 0; i < games.length; i++) {
    for (let j = i + 1; j < games.length; j++) {
      const a = games[i];
      const b = games[j];
      const key = [a.id, b.id].sort((x, y) => x - y).join("-");
      const exposure = (counts.get(a.id) ?? 0) + (counts.get(b.id) ?? 0);
      const gap = Math.abs(
        Math.log(strength.get(a.id) ?? 1) - Math.log(strength.get(b.id) ?? 1),
      );
      pairs.push({ a, b, cost: exposure * 2 + gap + (seen.has(key) ? 4 : 0) + Math.random() });
    }
  }
  pairs.sort((x, y) => x.cost - y.cost);
  const pick = pairs[Math.floor(Math.random() * Math.min(3, pairs.length))];
  return [pick.a, pick.b];
}

/**
 * Preference vs. performance (§7): does liking a game correlate with being good
 * at it? Spearman rank correlation between BT rank and win-rate rank.
 */
export function preferenceVsPerformance(playerId: number) {
  const prefs = fitPreferences(playerId);
  if (prefs.length < 3) return null;
  const perf = new Map(
    all<{ game_id: number; plays: number; wins: number }>(
      `SELECT s.game_id, COUNT(*) AS plays,
              SUM(CASE WHEN p.placement = 1 THEN 1 ELSE 0 END) AS wins
         FROM participants p
         JOIN sessions s ON s.id = p.session_id
         JOIN games g ON g.id = s.game_id
        WHERE p.player_id = ? AND g.scoring_mode != 'coop-vs-game'
        GROUP BY s.game_id`,
      playerId,
    ).map((r) => [r.game_id, r]),
  );

  const points = prefs
    .map((p) => {
      const stat = perf.get(p.game.id);
      if (!stat || stat.plays < 2) return null;
      return { name: p.game.name, prefRank: p.rank, winRate: stat.wins / stat.plays, plays: stat.plays };
    })
    .filter((x): x is { name: string; prefRank: number; winRate: number; plays: number } => !!x);

  if (points.length < 3) return null;

  const byWin = [...points].sort((a, b) => b.winRate - a.winRate);
  const winRank = new Map(byWin.map((p, i) => [p.name, i + 1]));
  const prefRanks = points.map((p) => p.prefRank);
  const winRanks = points.map((p) => winRank.get(p.name)!);
  const n = points.length;
  const d2 = prefRanks.reduce((a, r, i) => a + (r - winRanks[i]) ** 2, 0);
  const rho = 1 - (6 * d2) / (n * (n * n - 1));

  return { points, rho: Math.round(rho * 100) / 100, n };
}
