/**
 * Optional demo data. Fills a fresh database with a plausible few months of
 * game nights so the leaderboard, charts and reveal screen have something to
 * show before your group has logged anything real.
 *
 *   npm run dev          # in one terminal
 *   npm run seed         # in another
 *
 * It talks to the running app over HTTP, so every session goes through exactly
 * the same validation and rating replay as one logged from a phone.
 */

const BASE = process.env.BGN_URL ?? "http://localhost:3000";

async function api(path, body, method = "POST") {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}

const PLAYERS = [
  { name: "Ada", emoji: "🦊", color: "#8b5cf6", tagline: "Reads the rulebook out loud" },
  { name: "Bo", emoji: "🐙", color: "#38bdf8", tagline: "Always plays the weird faction" },
  { name: "Cleo", emoji: "🦉", color: "#fbbf24", tagline: "Quietly wins by two points" },
  { name: "Dev", emoji: "🦖", color: "#34d399", tagline: "Kingmaker, unrepentant" },
  { name: "Wren", emoji: "🐝", color: "#fb7185", tagline: "Table talk specialist" },
];

const GAMES = [
  {
    name: "Wingspan",
    scoring_mode: "ranked-ffa",
    rating_dimension: "none",
    tracks_score: true,
    high_score_wins: true,
  },
  {
    name: "Azul",
    scoring_mode: "ranked-ffa",
    rating_dimension: "none",
    tracks_score: true,
    high_score_wins: true,
  },
  {
    name: "Codenames",
    scoring_mode: "team-vs-team",
    rating_dimension: "none",
    tracks_score: false,
  },
  {
    name: "The Resistance: Avalon",
    scoring_mode: "hidden-team",
    rating_dimension: "single-tag",
    tag_label: "Role",
    tag_pool: ["Good", "Evil"],
    tracks_score: false,
  },
  {
    name: "Smash Up",
    scoring_mode: "ranked-ffa",
    rating_dimension: "multi-tag",
    tag_label: "Faction",
    tags_per_player: 2,
    tag_pool: [
      "Aliens",
      "Dinosaurs",
      "Ninjas",
      "Pirates",
      "Robots",
      "Tricksters",
      "Wizards",
      "Zombies",
    ],
    tracks_score: true,
    high_score_wins: true,
  },
  {
    name: "Pandemic",
    scoring_mode: "coop-vs-game",
    rating_dimension: "none",
    tracks_score: false,
    tracks_difficulty: true,
  },
];

// Deterministic RNG so re-seeding a fresh database gives the same story.
let seed = 20260831;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Latent skill per player per game, so the ratings converge on something real.
const SKILL = {
  Wingspan: { Ada: 0.9, Bo: 0.2, Cleo: 1.4, Dev: -0.3, Wren: 0.1 },
  Azul: { Ada: 0.1, Bo: 1.2, Cleo: 0.4, Dev: 0.8, Wren: -0.4 },
  Codenames: { Ada: 0.5, Bo: 0.5, Cleo: 0.2, Dev: 0.1, Wren: 1.1 },
  "The Resistance: Avalon": { Ada: 0.3, Bo: 1.0, Cleo: -0.2, Dev: 0.6, Wren: 0.9 },
  "Smash Up": { Ada: 0.4, Bo: 0.9, Cleo: 0.7, Dev: 0.2, Wren: 0.3 },
  Pandemic: { Ada: 0, Bo: 0, Cleo: 0, Dev: 0, Wren: 0 },
};

const rank = (names, game) =>
  [...names]
    .map((n) => ({ n, roll: (SKILL[game]?.[n] ?? 0) + (rnd() - 0.5) * 2.4 }))
    .sort((a, b) => b.roll - a.roll)
    .map((r) => r.n);

async function main() {
  console.log(`Seeding ${BASE} …`);

  const playerIds = {};
  for (const p of PLAYERS) {
    const { id } = await api("/api/players", p);
    playerIds[p.name] = id;
    console.log(`  player ${p.emoji} ${p.name}`);
  }

  const gameIds = {};
  for (const g of GAMES) {
    const { id } = await api("/api/games", g);
    gameIds[g.name] = id;
    console.log(`  game 🎲 ${g.name}`);
  }

  const start = Date.now() - 150 * 864e5;
  let logged = 0;

  for (let night = 0; night < 24; night++) {
    const date = new Date(start + night * 6.2 * 864e5);
    const table = shuffle(PLAYERS.map((p) => p.name)).slice(0, 3 + Math.floor(rnd() * 3));

    for (let round = 0; round < 1 + Math.floor(rnd() * 2); round++) {
      const gameName = pick(GAMES).name;
      const played_at = new Date(date.getTime() + round * 36e5).toISOString();
      const order = rank(table, gameName);

      let payload;

      if (gameName === "Pandemic") {
        payload = {
          game_id: gameIds[gameName],
          played_at,
          coop_result: rnd() > 0.45 ? "win" : "loss",
          difficulty: pick(["4 epidemics", "5 epidemics", "6 epidemics"]),
          participants: table.map((n) => ({ player_id: playerIds[n], placement: 1 })),
        };
      } else if (gameName === "Codenames") {
        const half = Math.ceil(order.length / 2);
        const teamA = order.slice(0, half);
        const winnerIsA = rnd() > 0.5;
        payload = {
          game_id: gameIds[gameName],
          played_at,
          participants: order.map((n) => {
            const isA = teamA.includes(n);
            return {
              player_id: playerIds[n],
              team: isA ? "A" : "B",
              placement: isA === winnerIsA ? 1 : 2,
            };
          }),
        };
      } else if (gameName === "The Resistance: Avalon") {
        const evilCount = order.length >= 5 ? 2 : 1;
        const evil = new Set(shuffle(order).slice(0, evilCount));
        const evilWins = rnd() > 0.55;
        payload = {
          game_id: gameIds[gameName],
          played_at,
          participants: order.map((n) => {
            const isEvil = evil.has(n);
            return {
              player_id: playerIds[n],
              tags: [isEvil ? "Evil" : "Good"],
              placement: isEvil === evilWins ? 1 : 2,
            };
          }),
        };
      } else if (gameName === "Smash Up") {
        const factions = shuffle(GAMES.find((g) => g.name === "Smash Up").tag_pool);
        payload = {
          game_id: gameIds[gameName],
          played_at,
          participants: order.map((n, i) => ({
            player_id: playerIds[n],
            placement: i + 1,
            score: 15 - i * 2 + Math.floor(rnd() * 4),
            tags: [factions[(i * 2) % factions.length], factions[(i * 2 + 1) % factions.length]],
          })),
        };
      } else {
        const base = gameName === "Wingspan" ? 78 : 62;
        payload = {
          game_id: gameIds[gameName],
          played_at,
          notes: rnd() > 0.8 ? pick(["Photo finish.", "Someone flipped the box.", "Rematch demanded."]) : null,
          participants: order.map((n, i) => ({
            player_id: playerIds[n],
            placement: i + 1,
            score: base - i * (4 + Math.floor(rnd() * 5)) + Math.floor(rnd() * 6),
          })),
        };
      }

      await api("/api/sessions", payload);
      logged++;
    }
  }

  console.log(`\nDone — ${logged} sessions across ${GAMES.length} games. Open ${BASE}`);
}

main().catch((e) => {
  console.error("\nSeeding failed:", e.message);
  console.error("Is the dev server running? (npm run dev)");
  process.exit(1);
});
