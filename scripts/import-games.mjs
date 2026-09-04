/**
 * Loads the shelf from scripts/games-catalog.mjs into a running app.
 *
 *   npm run dev          # in one terminal
 *   npm run import-games # in another
 *
 * Idempotent: a game whose name already exists is skipped, so re-running after
 * you edit the catalog only adds what's new. Nothing is ever overwritten —
 * edits you make in the app win.
 */

import { CATALOG } from "./games-catalog.mjs";

const BASE = process.env.BGN_URL ?? "http://localhost:3000";

async function api(path, body, method = "POST") {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  const existing = await api("/api/games", null, "GET");
  if (!existing.ok) throw new Error(`Could not reach ${BASE} — is the server running?`);
  const have = new Set(existing.data.map((g) => g.name.toLowerCase()));

  let added = 0;
  let skipped = 0;
  const failed = [];
  const review = [];

  for (const game of CATALOG) {
    if (have.has(game.name.toLowerCase())) {
      skipped++;
      continue;
    }
    const { review: note, ...config } = game;
    const res = await api("/api/games", config);
    if (res.ok) {
      added++;
      if (note) review.push({ name: game.name, note });
    } else {
      failed.push(`${game.name}: ${res.data.error ?? res.status}`);
    }
  }

  console.log(`\nAdded ${added}, skipped ${skipped} already on the shelf.`);
  if (failed.length) {
    console.log(`\nFailed (${failed.length}):`);
    for (const f of failed) console.log(`  ✗ ${f}`);
  }
  if (review.length) {
    console.log(`\nWorth a look — judgement calls I made for you (${review.length}):`);
    for (const r of review) console.log(`  · ${r.name}\n      ${r.note}`);
  }
  console.log(`\nOpen ${BASE}/games to browse them.`);
}

main().catch((e) => {
  console.error("\nImport failed:", e.message);
  process.exit(1);
});
