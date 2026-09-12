# Board Game Night Tracker

A home-network webapp for a regular game night: log sessions in under thirty
seconds, get honest skill ratings per game, and dig through the rivalries
afterwards. Built to the spec in [`boardgame-tracker-design-doc.md`](./boardgame-tracker-design-doc.md).

## Running it

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` on the host machine. **Settings → Share with
the table** shows the exact LAN link to send everyone else, with a copy button —
the server binds to `0.0.0.0`, so any device on the same wifi can open it. On a
phone, use "Add to Home Screen": there's a PWA manifest and icons, so it opens
standalone with a bottom tab bar.

Everyone gets the same app; there's no separate admin site. A PIN only guards
personal pages (see Identity, below).

For a long-running install, build once and serve:

```bash
npm run build
npm run start
```

### Your shelf

`scripts/games-catalog.mjs` holds the real game library, pre-configured. With
the server running:

```bash
npm run import-games
```

It skips anything already on the shelf, so it's safe to re-run after you edit
the catalog. Entries with a `review` note print at the end — those are the
judgement calls worth checking.

### Starting for real

The demo data (Ada, Bo, Cleo…) is there so the charts have something to show.
When you're ready for real sessions, stop the server and:

```bash
npm run reset
```

That backs the old database up into `data/backups` and wipes it. Start the
server, run `npm run import-games`, add your players, and you're live.

To put the demo data back instead, run `npm run seed` with the server up.

## Where things live

```
src/lib/
  schema.sql       every table, in one place
  db.ts            SQLite connection (better-sqlite3, WAL)
  rating.ts        OpenSkill wrapper, displayed rating, tier names
  recompute.ts     the full replay engine
  sessions.ts      create / edit / delete a session + the reveal payload
  queries.ts       leaderboards, composites, player stats, analytics
  bradleyterry.ts  preference model behind the Game Draft
  auth.ts          name + PIN identity for personal pages
src/app/           pages and API routes
src/components/    UI, including the session-entry flow and reveal screen
data/boardgames.db the whole database (see backups, below)
```

## Backups

Settings → **Back up database** writes a timestamped, fully checkpointed copy
into `data/backups/` using SQLite's own backup API, which is safe to run while
people are logging sessions. If you'd rather copy files by hand, take
`boardgames.db` *plus* its `-wal` and `-shm` siblings, or stop the server first
— the database runs in WAL mode, so recent writes may still live in the log.

## How the ratings work

Each player has an OpenSkill (Weng-Lin) rating **per game**, and the number on
screen is deliberately conservative — roughly μ − 3σ, scaled so a brand-new
player reads about 1000 rather than "0.0". New and rusty players therefore look
humble until the engine has actually seen them play.

Only **finishing order** ever reaches the engine. Ties are supported directly,
and so are uneven teams. Scores are stored alongside, purely for personal bests
and high-score charts.

**Overall** is not a pooled average of per-game ratings — raw μ isn't comparable
across games with different spreads. It's the average of a player's *z-scores*
in each game they've played 3+ times: `(their μ − group average μ in that game) /
group's standard deviation in that game`. A +1.5 means "one and a half standard
deviations above this group's average, in this specific game", which compares
sensibly across Wingspan and Codenames alike.

**Pure co-op games never affect anyone's rating.** There's no opposing skill to
measure, so Pandemic and friends are logged for win/loss streaks and
difficulty stats only.

**Hidden-role games** (`single-tag`) quietly keep one pool per role: Avalon is
Avalon·Good and Avalon·Evil, plus a combined pool for the main board. Evil comes
up less often, so its σ honestly stays wider for longer.

**Multi-identity games** (`multi-tag`) rate at the individual faction level, not
the combo level — ~190 pairs of 20 factions would never accumulate meaningful
data. Faction ratings live on the game's analytics page; combo win rates are
shown there too, as analytics rather than ratings.

## Rivalries

A head-to-head "win" means you **finished ahead of them** — 2nd against their
3rd in a four-player game counts, mirrored as a loss on their card. That's the
same signal the rating engine reads, and it's the only reading that uses the
whole table rather than throwing away every session neither of you won. Because
mid-table places are weaker evidence, each row also shows the record restricted
to nights one of you actually took first.

Sessions where you were on the **same side** (Codenames teammates, both Good in
Avalon) are counted separately as teammate games rather than as draws. Co-op
nights never count at all.

## Editing history

Ratings are sequential, so editing or deleting a past session **replays the
entire session history in order** rather than patching one row. That runs
automatically after every create, edit and delete (and on demand from
Settings), which makes a mis-entered placement during a live game night a
non-event.

## Adding a game

The New Game wizard asks a handful of plain-language questions once — how the
game ends, whether it reports a score, whether players have roles worth rating
separately, whether difficulty varies. Those answers become the game's config
object, and both the rating engine and the session-entry form read it from
there. Nothing is re-asked when you log a session.

## How a game ends

Two independent questions, which are easy to confuse:

**Is there a real 2nd and 3rd?** Some games place everyone — a final scoring
round (Wingspan), or an elimination order that genuinely says who lasted
longer (Risk). Others end the moment someone wins, and the losers aren't
comparable (Coup, Cryptid, Fluxx): there is no honest 2nd, so the app doesn't
ask for one. Session entry shows a **"Who won?"** tap list instead of a drag
order, and the engine is told the losers are tied — which is the truth, and
better information than a made-up ranking.

**Does it write down a number?** Completely separate. Risk is ranked with no
score; Coup has neither; Poker has both. Scores are for personal bests and
high-score charts and never reach the rating engine.

The test when you're unsure: *would you have to invent the order?* If yes, it's
winner-takes-it.

## Games that shouldn't be rated

Some games are logged for the record but aren't a skill contest — party games
with a rotating judge, or anything decided by a shuffle. Turn **"Counts toward
ratings"** off and they still appear in plays, streaks, the calendar and
history, but never touch anyone's rating. Cards Against Humanity and What Do
You Meme? ship this way; co-op games are excluded automatically.

## Variants

Some games aren't one game. Cribbage is classic 1v1, three-handed, partners at
four, plus whatever house rules your group invents — different player counts,
sometimes different rules. A game can therefore hold a list of **variants**,
each with its own player count and its own partnerships setting.

Each variant keeps its **own rating pool** alongside the game's overall one, the
same way a hidden role does. A session counts toward both, so you can ask
"who's best at Cribbage?" and "who's best at four-handed?" separately, and the
leaderboard gains a variant sub-filter. Sessions logged as "Unspecified" count
only toward the overall pool.

Add variants in the New Game wizard or from **Game settings** on any game page.
Changing them replays ratings automatically.

## BoardGameGeek

**The BGG integration is off by default and you probably don't want it.** Their
XML API now requires registering an application and sending a bearer token;
their terms also let them deny or withdraw a licence at their discretion. For a
private game-night tracker that's a lot of paperwork for box art.

Everything works without it — you type the name and player count, which takes
about five seconds. The BGG button only appears if `BGG_TOKEN` is set in
`.env.local`, so the wizard never advertises a lookup that can only fail. If
you ever do register, the whole integration is one file:
`src/app/api/bgg/route.ts`.

## Identity

Logging a session needs no identity at all — one person logs on behalf of the
table. Tapping your face (no PIN) is enough for emoji reactions on the reveal
screen. A short PIN only guards genuinely personal things: your Game Draft and
edits to your own profile.

## Test
