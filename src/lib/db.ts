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
  { table: "players", column: "role", definition: "TEXT NOT NULL DEFAULT 'standard'" },
  // changelog already shipped once (see the roles/airlock patch), so these
  // are an upgrade to an existing table, not part of its original
  // CREATE TABLE — same reason username/password_hash/role above are here
  // instead of in schema.sql's players definition.
  //
  // `details` in particular was a real bug, not just a style choice: it got
  // added straight to schema.sql's CREATE TABLE instead of here, which is a
  // silent no-op on a database where `changelog` already exists — CREATE
  // TABLE IF NOT EXISTS never retroactively adds a column. The result: every
  // logChange() call's INSERT named a column the live table didn't have,
  // which throws, which happened *after* the action it was logging had
  // already committed — so the action would succeed while the request still
  // came back as an error, and nothing ever actually got logged. Listing it
  // here is what actually fixes an existing database; see also logChange()
  // itself, which no longer lets a logging failure fail the request at all.
  { table: "changelog", column: "details", definition: "TEXT" },
  { table: "changelog", column: "target_type", definition: "TEXT" },
  { table: "changelog", column: "target_id", definition: "INTEGER" },
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

/**
 * The role system landed after several accounts already existed, so there
 * has to be exactly one moment where somebody becomes the first owner
 * without anyone clicking a button — otherwise nobody could ever grant
 * roles at all. Runs once: the moment any owner exists, this is a no-op on
 * every future boot.
 *
 * Defaults to the earliest player (lowest id) — usually whoever set the app
 * up originally, but "usually" isn't good enough to bet an unrecoverable
 * choice on (once granted, nothing in the app can demote an owner — that's
 * deliberate, see lib/roles.ts). Set INITIAL_OWNER_USERNAME to name the
 * account explicitly instead of leaving it to row order.
 */
function ensureOwnerExists(db: Database.Database) {
  const owners = db.prepare("SELECT COUNT(*) AS n FROM players WHERE role = 'owner'").get() as {
    n: number;
  };
  if (owners.n > 0) return;

  const preferred = process.env.INITIAL_OWNER_USERNAME?.trim();
  if (preferred) {
    const match = db
      .prepare("SELECT id FROM players WHERE username = ? COLLATE NOCASE")
      .get(preferred) as { id: number } | undefined;
    if (match) {
      db.prepare("UPDATE players SET role = 'owner' WHERE id = ?").run(match.id);
      return;
    }
    console.error(
      `INITIAL_OWNER_USERNAME="${preferred}" doesn't match any existing player — ` +
        "falling back to the earliest account instead.",
    );
  }

  const first = db.prepare("SELECT id FROM players ORDER BY id ASC LIMIT 1").get() as
    | { id: number }
    | undefined;
  if (first) db.prepare("UPDATE players SET role = 'owner' WHERE id = ?").run(first.id);
}

export const SIGNUP_TTL_MINUTES = 10;

/** Deletes any pending sign-up request (and its stored password hash) past its 10-minute TTL. */
export function pruneExpiredSignupRequests() {
  run("DELETE FROM signup_requests WHERE expires_at < ?", nowIso());
}

// Longer than signup's 10 minutes: approving one of these usually means an
// owner/admin actually checking with the person first ("is this really
// you?"), not just glancing at a name — worth giving that more room than
// an instant judgment call on a brand new account.
export const RESET_TTL_MINUTES = 30;

/** Deletes any password-reset request (approved or not, and its claim token) past its TTL. */
export function pruneExpiredResetRequests() {
  run("DELETE FROM password_reset_requests WHERE expires_at < ?", nowIso());
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
  ensureOwnerExists(db);
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
  // Belt-and-suspenders for the 10-minute sign-up TTL: every route that
  // touches signup_requests prunes on its way in too, but this catches the
  // case where nobody happens to hit one of those routes for a while — a
  // stale request (and the password hash sitting in it) shouldn't just wait
  // around for the next admin visit.
  setInterval(() => {
    try {
      const now = new Date().toISOString();
      db.prepare("DELETE FROM signup_requests WHERE expires_at < ?").run(now);
      db.prepare("DELETE FROM password_reset_requests WHERE expires_at < ?").run(now);
    } catch {
      /* best-effort background cleanup — a missed tick isn't worth logging */
    }
  }, 60_000).unref();
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
