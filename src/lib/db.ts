import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.BGN_DATA_DIR ?? path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "boardgames.db");
const SCHEMA_PATH = path.join(process.cwd(), "src", "lib", "schema.sql");

// Next dev reloads modules; keep one connection on globalThis.
const g = globalThis as unknown as { __bgn_db?: Database.Database };

/**
 * Columns added after a database already exists. `CREATE TABLE IF NOT EXISTS`
 * silently skips an existing table, so new config fields need an explicit
 * ALTER — cheap to run every boot, and it keeps upgrades from needing a wipe.
 */
const ADDED_COLUMNS: { table: string; column: string; definition: string }[] = [
  { table: "games", column: "allows_teams", definition: "INTEGER NOT NULL DEFAULT 0" },
  { table: "games", column: "variants", definition: "TEXT" },
  { table: "games", column: "result_mode", definition: "TEXT NOT NULL DEFAULT 'ranked'" },
  { table: "games", column: "rated", definition: "INTEGER NOT NULL DEFAULT 1" },
  { table: "sessions", column: "variant", definition: "TEXT" },
  { table: "rating_snapshots", column: "variant", definition: "TEXT NOT NULL DEFAULT ''" },
  { table: "players", column: "username", definition: "TEXT" },
  { table: "players", column: "password_hash", definition: "TEXT" },
];

/**
 * Real accounts, added on top of an app that used to trust anyone on the
 * LAN. Every existing player already has a unique `name` — that becomes
 * their `username` automatically, so nobody has to be handed a new one.
 * `password_hash` starts NULL for everybody; that's also how the login route
 * tells an unmigrated account apart from one that's already set a password
 * (see app/api/auth/route.ts).
 */
function backfillUsernames(db: Database.Database) {
  const rows = db
    .prepare("SELECT id, name FROM players WHERE username IS NULL")
    .all() as { id: number; name: string }[];
  if (!rows.length) return;

  const taken = new Set(
    (db.prepare("SELECT username FROM players WHERE username IS NOT NULL").all() as { username: string }[])
      .map((r) => r.username.toLowerCase()),
  );
  const update = db.prepare("UPDATE players SET username = ? WHERE id = ?");
  for (const { id, name } of rows) {
    let candidate = name.trim();
    // `name` was already UNIQUE, so a collision here only happens if two
    // names differ solely by case (players table's old constraint was
    // case-sensitive; usernames are compared case-insensitively). Rare for a
    // home game-night roster, but don't fail the whole boot over it.
    let n = 2;
    while (taken.has(candidate.toLowerCase())) candidate = `${name.trim()}${n++}`;
    taken.add(candidate.toLowerCase());
    update.run(candidate, id);
  }
}

function migrate(db: Database.Database) {
  for (const { table, column, definition } of ADDED_COLUMNS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.length || cols.some((c) => c.name === column)) continue;
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
  backfillUsernames(db);
  // SQLite can't add a UNIQUE constraint via ALTER TABLE, so the uniqueness
  // (case-insensitive — §5 of the security notes) lives in an index instead.
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_players_username ON players(username COLLATE NOCASE)",
  );
}

function open(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  // Default auto-checkpoint is 1000 pages (~4MB) — on a synced folder (e.g.
  // OneDrive) a WAL that size sits there being watched/re-uploaded on every
  // write, and every read has to walk it. Checkpoint far more often so the
  // WAL stays small, and fold back in whatever's already piled up on boot.
  db.pragma("wal_autocheckpoint = 100");
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
  migrate(db);
  return db;
}

export function getDb(): Database.Database {
  if (!g.__bgn_db) g.__bgn_db = open();
  return g.__bgn_db;
}

/** Query helper — returns typed rows. */
export function all<T>(sql: string, ...params: unknown[]): T[] {
  return getDb().prepare(sql).all(...(params as never[])) as T[];
}

export function get<T>(sql: string, ...params: unknown[]): T | undefined {
  return getDb().prepare(sql).get(...(params as never[])) as T | undefined;
}

export function run(sql: string, ...params: unknown[]) {
  return getDb().prepare(sql).run(...(params as never[]));
}

export function tx<T>(fn: () => T): T {
  return getDb().transaction(fn)();
}

export const nowIso = () => new Date().toISOString();
