/**
 * Loads the shelf from scripts/games-catalog.mjs into a running app.
 *
 *   npm run dev          # in one terminal
 *   npm run import-games # in another
 *
 * Idempotent: a game whose name already exists is skipped, so re-running after
 * you edit the catalog only adds what's new. Nothing is ever overwritten —
 * edits you make in the app win.
 *
 * Every route this script calls now requires a signed-in session (the app
 * requires an account for everything — see middleware.ts). Point this at an
 * existing account:
 *
 *   BGN_SEED_USERNAME=you BGN_SEED_PASSWORD=yourpassword npm run import-games
 */

import { CATALOG } from "./games-catalog.mjs";

const BASE = process.env.BGN_URL ?? "http://localhost:3000";
let sessionCookie = "";

async function login() {
  const username = process.env.BGN_SEED_USERNAME;
  const password = process.env.BGN_SEED_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "Set BGN_SEED_USERNAME and BGN_SEED_PASSWORD to an existing account before running " +
        "this — every route now requires being signed in. Create the first account at " +
        `${BASE}/login if you haven't yet.`,
    );
  }
  const res = await fetch(`${BASE}/api/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Could not sign in as ${username} — check BGN_SEED_PASSWORD.`);
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("Sign-in succeeded but no session cookie came back.");
  sessionCookie = setCookie.split(";")[0];
}

async function api(path, body, method = "POST") {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", cookie: sessionCookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  await login();
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
