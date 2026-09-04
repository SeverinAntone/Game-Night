/**
 * Wipes player profiles and game history (sessions + everything that hangs
 * off them via ON DELETE CASCADE: participants, rating_snapshots,
 * preference_comparisons, game_preferences, session_reactions) while
 * leaving the `games` catalog and `seasons` intact.
 *
 *   node scripts/wipe-players-sessions.mjs
 *
 * Stop the dev server before running this — the file is in use while it's up.
 */
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const dir = process.env.BGN_DATA_DIR ?? path.join(process.cwd(), "data");
const dbPath = path.join(dir, "boardgames.db");

if (!fs.existsSync(dbPath)) {
  console.log("No database found — nothing to wipe.");
  process.exit(0);
}

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const before = {
  games: db.prepare("SELECT COUNT(*) c FROM games").get().c,
  players: db.prepare("SELECT COUNT(*) c FROM players").get().c,
  sessions: db.prepare("SELECT COUNT(*) c FROM sessions").get().c,
};

const wipe = db.transaction(() => {
  db.prepare("DELETE FROM sessions").run(); // cascades participants, rating_snapshots, session_reactions
  db.prepare("DELETE FROM players").run();  // cascades leftovers: preference_comparisons, game_preferences
  // Reset autoincrement counters so new players/sessions start at 1 again.
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('players','sessions','participants','rating_snapshots','session_reactions')").run();
});
wipe();

const after = {
  games: db.prepare("SELECT COUNT(*) c FROM games").get().c,
  players: db.prepare("SELECT COUNT(*) c FROM players").get().c,
  sessions: db.prepare("SELECT COUNT(*) c FROM sessions").get().c,
  participants: db.prepare("SELECT COUNT(*) c FROM participants").get().c,
};

db.close();

console.log(`Before: ${before.games} games, ${before.players} players, ${before.sessions} sessions`);
console.log(`After:  ${after.games} games, ${after.players} players, ${after.sessions} sessions, ${after.participants} participants`);
console.log("Games catalog preserved. Players and session history wiped.");
