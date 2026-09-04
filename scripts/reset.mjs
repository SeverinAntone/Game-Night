/**
 * Wipes the database so you can start for real.
 *
 *   npm run reset
 *
 * Takes a backup first (into data/backups) unless the database is missing.
 * Stop the server before running this — the file is in use while it's up.
 */
import fs from "node:fs";
import path from "node:path";

const dir = process.env.BGN_DATA_DIR ?? path.join(process.cwd(), "data");
const db = path.join(dir, "boardgames.db");

if (!fs.existsSync(db)) {
  console.log("No database to reset — you're already starting fresh.");
  process.exit(0);
}

const backups = path.join(dir, "backups");
fs.mkdirSync(backups, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
for (const suffix of ["", "-wal", "-shm"]) {
  const from = db + suffix;
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(backups, `pre-reset-${stamp}.db${suffix}`));
}
for (const suffix of ["", "-wal", "-shm"]) {
  const target = db + suffix;
  if (fs.existsSync(target)) fs.rmSync(target);
}

console.log(`Wiped. A copy of the old database is in ${backups}.`);
console.log("Start the server and it rebuilds an empty one, then: npm run import-games");
