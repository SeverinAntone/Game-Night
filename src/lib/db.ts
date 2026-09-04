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
];

function migrate(db: Database.Database) {
  for (const { table, column, definition } of ADDED_COLUMNS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.length || cols.some((c) => c.name === column)) continue;
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
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
