import fs from "node:fs";
import path from "node:path";
import { getDb, nowIso } from "./db";
import { displayed, newRating, rateTeams, type Skill } from "./rating";
import {
  effectiveConfig,
  parseTags,
  type Game,
  type GameSession,
  type Participant,
} from "./types";

const DATA_DIR = process.env.BGN_DATA_DIR ?? path.join(process.cwd(), "data");

/**
 * Full sequential replay of every session in chronological order (design doc §9).
 *
 * Ratings are order-dependent, so any insert/edit/delete simply rebuilds
 * `rating_snapshots` from scratch instead of patching rows in place. At home
 * game-night volumes (thousands of sessions at most) this is milliseconds, and
 * it makes "I typed the placements in wrong" a non-event.
 */

/**
 * A rating pool is keyed by game + variant + tag + player.
 *
 *   variant='' tag=''   the game's overall pool — powers the main leaderboard
 *   variant=V  tag=''   one way of playing it (Cribbage partners vs 1v1)
 *   variant='' tag=T    a role or faction pool (§5.1, §5.2)
 *
 * Variant and tag pools are deliberately not crossed: "Evil at four-handed
 * Cribbage" would be too sparse to ever mean anything, and each pool above
 * answers a question someone would actually ask.
 */
type PoolMap = Map<string, Skill>;
const key = (gameId: number, variant: string, tag: string, playerId: number) =>
  `${gameId}|${variant}|${tag}|${playerId}`;

interface SnapRow {
  session_id: number;
  player_id: number;
  game_id: number;
  variant: string;
  tag: string;
  season_id: number | null;
  before: Skill;
  after: Skill;
  played_at: string;
}

/** Group participants into rating teams and return [teams, ranks]. */
function groupTeams(
  game: Game,
  parts: Participant[],
  allowsTeams: boolean,
): { groups: Participant[][]; ranks: number[] } {
  const byKey = new Map<string, Participant[]>();
  const teamsPossible =
    game.scoring_mode === "team-vs-team" || game.scoring_mode === "hidden-team" || allowsTeams;

  for (const p of parts) {
    let k: string;
    if (teamsPossible) {
      // Hidden-team games label sides with the role tag when no explicit team
      // is set; a partnership-capable FFA game falls back to solo per player,
      // so Cribbage at 2 and Cribbage at 4 both work off one config.
      k = p.team ?? parseTags(p.tags)[0] ?? `solo-${p.player_id}`;
    } else {
      k = `solo-${p.player_id}`;
    }
    const arr = byKey.get(k);
    if (arr) arr.push(p);
    else byKey.set(k, [p]);
  }
  const groups = [...byKey.values()];
  const ranks = groups.map((g) => Math.min(...g.map((p) => p.placement)));
  return { groups, ranks };
}

function distinctRanks(ranks: number[]): boolean {
  return new Set(ranks).size > 1;
}

/** Apply one session to the in-memory pools, returning the snapshot rows it produced. */
function applySession(
  game: Game,
  session: GameSession,
  parts: Participant[],
  pools: PoolMap,
): SnapRow[] {
  const rows: SnapRow[] = [];
  // True co-ops have no opposing skill signal — never touch the engine (§3).
  if (game.scoring_mode === "coop-vs-game") return rows;
  // Games flagged unrated are logged for plays, streaks and the calendar, but
  // measuring "skill" at Cards Against Humanity would be a category error.
  if (!game.rated) return rows;
  if (parts.length < 2) return rows;

  const config = effectiveConfig(game, session.variant);
  const variant = config.variant ? config.variant.name : "";

  const read = (v: string, tag: string, playerId: number): Skill =>
    pools.get(key(game.id, v, tag, playerId)) ?? newRating();

  const write = (v: string, tag: string, playerId: number, before: Skill, after: Skill) => {
    pools.set(key(game.id, v, tag, playerId), after);
    rows.push({
      session_id: session.id,
      player_id: playerId,
      game_id: game.id,
      variant: v,
      tag,
      season_id: session.season_id,
      before,
      after,
      played_at: session.played_at,
    });
  };

  const { groups, ranks } = groupTeams(game, parts, config.allows_teams);
  const rateable = groups.length > 1 && distinctRanks(ranks);

  // --- Overall pool: every non-co-op game has one. Powers the main leaderboard.
  if (rateable) {
    const before = groups.map((g) => g.map((p) => read("", "", p.player_id)));
    const after = rateTeams(before, ranks);
    groups.forEach((g, i) =>
      g.forEach((p, j) => write("", "", p.player_id, before[i][j], after[i][j])),
    );
  }

  // --- Variant pool: the same session, scored again in its own bracket.
  if (rateable && variant) {
    const before = groups.map((g) => g.map((p) => read(variant, "", p.player_id)));
    const after = rateTeams(before, ranks);
    groups.forEach((g, i) =>
      g.forEach((p, j) => write(variant, "", p.player_id, before[i][j], after[i][j])),
    );
  }

  // --- Tag pools (§5.1, §5.2) — scoped to config.tagPoolVariant: '' when the
  // split is the game's own (spans every variant, e.g. Smash Up, Avalon), or
  // this specific variant's name when the split only applies there (Cribbage's
  // 2-vs-1 Solo/Duo shouldn't touch Classic 1v1's pool, which has none).
  const tv = config.tagPoolVariant;
  if (config.rating_dimension === "single-tag") {
    // One tag per player; each tag is its own pool, keyed game+variant+tag.
    const tagged = parts.filter((p) => parseTags(p.tags).length > 0);
    if (tagged.length > 1) {
      const { groups: tg, ranks: tr } = groupTeams(game, tagged, config.allows_teams);
      if (tg.length > 1 && distinctRanks(tr)) {
        const before = tg.map((g) => g.map((p) => read(tv, parseTags(p.tags)[0], p.player_id)));
        const after = rateTeams(before, tr);
        tg.forEach((g, i) =>
          g.forEach((p, j) =>
            write(tv, parseTags(p.tags)[0], p.player_id, before[i][j], after[i][j]),
          ),
        );
      }
    }
  } else if (config.rating_dimension === "multi-tag") {
    // A player is effectively a "team" of their own factions for the session.
    const tagged = parts.filter((p) => parseTags(p.tags).length > 0);
    const mRanks = tagged.map((p) => p.placement);
    if (tagged.length > 1 && distinctRanks(mRanks)) {
      const before = tagged.map((p) => parseTags(p.tags).map((t) => read(tv, t, p.player_id)));
      const after = rateTeams(before, mRanks);
      tagged.forEach((p, i) => {
        const tags = parseTags(p.tags);
        tags.forEach((t, j) => write(tv, t, p.player_id, before[i][j], after[i][j]));
      });
    }
  }

  return rows;
}

export function replayRatings(): { sessions: number; snapshots: number } {
  const db = getDb();
  return db.transaction(() => {
    db.prepare("DELETE FROM rating_snapshots").run();

    const games = new Map<number, Game>(
      (db.prepare("SELECT * FROM games").all() as Game[]).map((g) => [g.id, g]),
    );
    const sessions = db
      .prepare("SELECT * FROM sessions ORDER BY played_at ASC, id ASC")
      .all() as GameSession[];
    const allParts = db
      .prepare("SELECT * FROM participants ORDER BY session_id, placement, id")
      .all() as Participant[];

    const partsBySession = new Map<number, Participant[]>();
    for (const p of allParts) {
      const arr = partsBySession.get(p.session_id);
      if (arr) arr.push(p);
      else partsBySession.set(p.session_id, [p]);
    }

    const pools: PoolMap = new Map();
    const insert = db.prepare(`
      INSERT INTO rating_snapshots
        (session_id, player_id, game_id, variant, tag, season_id, mu, sigma, displayed_rating,
         mu_before, sigma_before, displayed_before, played_at, created_at)
      VALUES (@session_id, @player_id, @game_id, @variant, @tag, @season_id, @mu, @sigma, @displayed_rating,
              @mu_before, @sigma_before, @displayed_before, @played_at, @created_at)
    `);

    const created = nowIso();
    let snapshots = 0;
    for (const s of sessions) {
      const game = games.get(s.game_id);
      if (!game) continue;
      const rows = applySession(game, s, partsBySession.get(s.id) ?? [], pools);
      for (const r of rows) {
        insert.run({
          session_id: r.session_id,
          player_id: r.player_id,
          game_id: r.game_id,
          variant: r.variant,
          tag: r.tag,
          season_id: r.season_id,
          mu: r.after.mu,
          sigma: r.after.sigma,
          displayed_rating: displayed(r.after),
          mu_before: r.before.mu,
          sigma_before: r.before.sigma,
          displayed_before: displayed(r.before),
          played_at: r.played_at,
          created_at: created,
        });
        snapshots++;
      }
    }
    return { sessions: sessions.length, snapshots };
  })();
}

/**
 * Bumped whenever the rating *formula* changes (not the engine, not the
 * schema) — a change that leaves every stored `mu`/`sigma` untouched but
 * makes every stored `displayed_rating`/`displayed_before` wrong, because
 * those are columns, not something computed at read time. `"2-skill-only"`
 * is the move from the conservative mu-3*sigma estimate to mu alone (see
 * rating.ts's `displayed()`).
 */
const RATING_FORMULA_VERSION = "2-skill-only";

/**
 * Runs {@link replayRatings} exactly once per formula version, on server
 * startup — see `src/instrumentation.ts`, the only intended caller.
 *
 * This deliberately does NOT live inside `getDb()`/`migrate()`/`open()` in
 * db.ts. Those assign `g.__bgn_db` only after `open()` returns, and
 * `replayRatings()` calls `getDb()` internally — calling this from inside
 * that chain would re-enter `open()` before the global is set, recursing
 * forever. Calling it from instrumentation's `register()`, after the module
 * graph is fully loaded and `getDb()` can return cleanly, sidesteps that.
 *
 * Replay is a pure function of the session log (see the file header above),
 * so re-running it is always lossless — the version stamp in `meta` exists
 * purely to make this a no-op on every boot after the first, not because a
 * second replay would be unsafe.
 */
export async function ensureRatingFormulaCurrent(): Promise<void> {
  const db = getDb();
  const row = db.prepare("SELECT value FROM meta WHERE key = 'rating_formula_version'").get() as
    | { value: string }
    | undefined;
  if (row?.value === RATING_FORMULA_VERSION) return;

  // Cheap insurance on a destructive-looking operation — replayRatings()
  // deletes every row of rating_snapshots before rebuilding it. Same backup
  // mechanism the admin "backup" action uses (src/app/api/admin/route.ts).
  const dir = path.join(DATA_DIR, "backups");
  fs.mkdirSync(dir, { recursive: true });
  const backupFile = path.join(
    dir,
    `boardgames-pre-${RATING_FORMULA_VERSION}-${nowIso().replace(/[:.]/g, "-")}.db`,
  );
  await db.backup(backupFile);
  console.log(`[rating-formula] backed up database to ${backupFile} before restating ratings`);

  const result = replayRatings();
  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('rating_formula_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(RATING_FORMULA_VERSION);

  console.log(
    `[rating-formula] restated all ratings for formula "${RATING_FORMULA_VERSION}": ` +
      `${result.sessions} sessions -> ${result.snapshots} rating rows`,
  );
}
