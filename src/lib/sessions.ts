import { all, get, getDb, nowIso, run } from "./db";
import { replayRatings } from "./recompute";
import { getGame, getParticipants, getSession } from "./queries";
import {
  gameVariants,
  parseTags,
  tagPool,
  type Game,
  type Player,
  type SessionInput,
} from "./types";

export class ValidationError extends Error {}

/** Normalise placements to a dense 1..n ranking that preserves ties. */
function normalisePlacements(input: { placement: number }[]): number[] {
  const sorted = [...new Set(input.map((p) => p.placement))].sort((a, b) => a - b);
  const map = new Map(sorted.map((v, i) => [v, i + 1]));
  return input.map((p) => map.get(p.placement)!);
}

function validate(game: Game, input: SessionInput) {
  const parts = input.participants ?? [];
  if (parts.length === 0) throw new ValidationError("A session needs at least one player.");

  const ids = new Set(parts.map((p) => p.player_id));
  if (ids.size !== parts.length) throw new ValidationError("The same player is listed twice.");

  const known = new Set(all<{ id: number }>("SELECT id FROM players").map((p) => p.id));
  for (const p of parts)
    if (!known.has(p.player_id)) throw new ValidationError(`Unknown player id ${p.player_id}.`);

  if (game.scoring_mode === "coop-vs-game") {
    if (!input.coop_result) throw new ValidationError("Co-op sessions need a win or loss result.");
  } else if (parts.length < 2) {
    throw new ValidationError("A competitive session needs at least two players.");
  }

  if (game.rating_dimension !== "none") {
    const pool = tagPool(game);
    const need = game.rating_dimension === "single-tag" ? 1 : game.tags_per_player;
    for (const p of parts) {
      const tags = p.tags ?? [];
      if (tags.length === 0) continue; // tags stay optional — an untagged play just skips tag pools
      if (tags.length > Math.max(need, 1))
        throw new ValidationError(
          `${game.name} expects at most ${Math.max(need, 1)} ${game.tag_label ?? "tag"}(s) per player.`,
        );
      for (const t of tags)
        if (pool.length && !pool.includes(t))
          throw new ValidationError(`"${t}" is not one of ${game.name}'s ${game.tag_label ?? "tags"}.`);
    }
  }

  if (input.variant) {
    const known = gameVariants(game).map((v) => v.name);
    if (!known.includes(input.variant))
      throw new ValidationError(`"${input.variant}" is not one of ${game.name}'s variants.`);
  }

  if (!game.tracks_score) for (const p of parts) p.score = null;
  if (!game.tracks_difficulty) input.difficulty = null;
}

function writeParticipants(sessionId: number, game: Game, input: SessionInput) {
  const db = getDb();
  db.prepare("DELETE FROM participants WHERE session_id = ?").run(sessionId);
  const ins = db.prepare(
    `INSERT INTO participants (session_id, player_id, placement, score, team, tags)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const coop = game.scoring_mode === "coop-vs-game";
  const placements = coop
    ? input.participants.map(() => (input.coop_result === "win" ? 1 : 2))
    : normalisePlacements(input.participants);

  input.participants.forEach((p, i) => {
    const tags = (p.tags ?? []).filter(Boolean);
    ins.run(
      sessionId,
      p.player_id,
      placements[i],
      p.score ?? null,
      p.team ?? (game.scoring_mode === "hidden-team" ? tags[0] ?? null : null),
      tags.length ? JSON.stringify(tags) : null,
    );
  });
}

export function createSession(input: SessionInput): number {
  const game = getGame(input.game_id);
  if (!game) throw new ValidationError("Unknown game.");
  validate(game, input);

  const id = getDb().transaction(() => {
    const res = run(
      `INSERT INTO sessions (game_id, variant, played_at, notes, difficulty, coop_result,
                             season_id, logged_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?,
               (SELECT id FROM seasons WHERE active = 1 ORDER BY id DESC LIMIT 1), ?, ?)`,
      game.id,
      input.variant || null,
      input.played_at || nowIso(),
      input.notes ?? null,
      input.difficulty ?? null,
      input.coop_result ?? null,
      input.logged_by ?? null,
      nowIso(),
    );
    const sessionId = Number(res.lastInsertRowid);
    writeParticipants(sessionId, game, input);
    return sessionId;
  })();

  replayRatings(); // §9 — ratings are always a pure function of session history
  return id;
}

export function updateSession(id: number, input: SessionInput) {
  const existing = getSession(id);
  if (!existing) throw new ValidationError("Unknown session.");
  const game = getGame(input.game_id ?? existing.game_id);
  if (!game) throw new ValidationError("Unknown game.");
  validate(game, input);

  getDb().transaction(() => {
    run(
      `UPDATE sessions SET game_id = ?, variant = ?, played_at = ?, notes = ?, difficulty = ?,
              coop_result = ?
        WHERE id = ?`,
      game.id,
      input.variant || null,
      input.played_at || existing.played_at,
      input.notes ?? null,
      input.difficulty ?? null,
      input.coop_result ?? null,
      id,
    );
    writeParticipants(id, game, input);
  })();

  replayRatings();
}

export function deleteSession(id: number) {
  run("DELETE FROM sessions WHERE id = ?", id);
  replayRatings();
}

// ---------------------------------------------------------------------------
// Post-game reveal payload (§10)
// ---------------------------------------------------------------------------

export interface RevealParticipant {
  player: Player;
  placement: number;
  score: number | null;
  team: string | null;
  tags: string[];
  before: number | null;
  after: number | null;
  delta: number | null;
  tagDeltas: { tag: string; before: number; after: number; delta: number }[];
  personalBest: boolean;
}

export interface Reveal {
  session: NonNullable<ReturnType<typeof getSession>>;
  game: Game;
  participants: RevealParticipant[];
  upset: { winner: Player; loser: Player; gap: number } | null;
  rated: boolean;
}

export function buildReveal(sessionId: number): Reveal | null {
  const session = getSession(sessionId);
  if (!session) return null;
  const game = getGame(session.game_id)!;
  const parts = getParticipants(sessionId);

  const snaps = all<{
    player_id: number;
    tag: string;
    displayed_before: number;
    displayed_rating: number;
  }>(
    `SELECT player_id, tag, displayed_before, displayed_rating
       FROM rating_snapshots WHERE session_id = ?`,
    sessionId,
  );

  const participants: RevealParticipant[] = parts.map((p) => {
    const base = snaps.find((s) => s.player_id === p.player_id && s.tag === "");
    const tagDeltas = snaps
      .filter((s) => s.player_id === p.player_id && s.tag !== "")
      .map((s) => ({
        tag: s.tag,
        before: s.displayed_before,
        after: s.displayed_rating,
        delta: Math.round((s.displayed_rating - s.displayed_before) * 10) / 10,
      }));

    let personalBest = false;
    if (p.score != null && game.tracks_score) {
      const prior = get<{ best: number | null }>(
        `SELECT MAX(pp.score) AS best FROM participants pp
           JOIN sessions ss ON ss.id = pp.session_id
          WHERE pp.player_id = ? AND ss.game_id = ? AND ss.id != ? AND pp.score IS NOT NULL`,
        p.player_id,
        game.id,
        sessionId,
      );
      personalBest = prior?.best == null || p.score > prior.best;
    }

    return {
      player: {
        id: p.player_id,
        name: p.name,
        emoji: p.emoji,
        color: p.color,
        tagline: null,
        has_pin: 0,
        join_date: "",
        active: 1,
      },
      placement: p.placement,
      score: p.score,
      team: p.team,
      tags: parseTags(p.tags),
      before: base ? base.displayed_before : null,
      after: base ? base.displayed_rating : null,
      delta: base ? Math.round((base.displayed_rating - base.displayed_before) * 10) / 10 : null,
      tagDeltas,
      personalBest,
    };
  });

  // Upset alert: did the winner start meaningfully below someone they beat?
  let upset: Reveal["upset"] = null;
  const winners = participants.filter((p) => p.placement === 1 && p.before != null);
  const losers = participants.filter((p) => p.placement > 1 && p.before != null);
  if (winners.length && losers.length) {
    const weakestWinner = winners.reduce((a, b) => (a.before! < b.before! ? a : b));
    const strongestLoser = losers.reduce((a, b) => (a.before! > b.before! ? a : b));
    const gap = strongestLoser.before! - weakestWinner.before!;
    if (gap >= 60)
      upset = {
        winner: weakestWinner.player,
        loser: strongestLoser.player,
        gap: Math.round(gap * 10) / 10,
      };
  }

  return { session, game, participants, upset, rated: snaps.length > 0 };
}
