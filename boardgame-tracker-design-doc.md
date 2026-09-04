# Board Game Night Tracker — Design Document

**Status: v1.0 built and running.** Last updated 2026-09-01.

This document is both the original design and a record of what actually got
built, including the places where contact with real games changed the plan.
Sections 1–11 are the design as it now stands. Section 12 lists what changed
and why. Sections 13–15 are the handoff: where the code lives, what's next,
and what we deliberately deferred.

---

## 1. Overview

A home-network webapp (mobile + desktop) that tracks board game sessions
played by a regular group of friends, computes skill ratings per game, and
surfaces analytics and player profiles over time. Runs on a single machine on
the local network; no external hosting or authentication needed for v1.

**Tone:** professional-but-quirky. Functional and clean, with room for fun
(post-game reveal animations, silly tier names, trading-card-style player
profiles) rather than a flat table-and-tabs feel.

## 2. Tech Stack

- **Framework:** Next.js 15 (App Router) — frontend and API routes together.
- **Database:** SQLite via `better-sqlite3`, in WAL mode. One file.
- **Rating engine:** [OpenSkill](https://github.com/philihp/openskill.js)
  (Weng-Lin model) — open-license alternative to TrueSkill, native support
  for free-for-all, ties, and asymmetric teams.
- **Hosting:** bound to `0.0.0.0`, reached via the host machine's LAN IP.
  Settings → *Share with the table* detects the address and shows the link.
- **PWA manifest** included, so it can be "Added to Home Screen" on phones.
- **Auth:** none required. Lightweight profile picker instead — see §7.
- **No charting library.** The charts are hand-rolled SVG (~300 lines), which
  is less code than the dependency would have been.
- Future, not v1: Tailscale bolt-on if remote access is ever wanted.

## 3. Rating Philosophy

Plain Elo/Glicko-2 are built for 1v1 (or batched tournament) play and don't
fit a semi-regular, N-player, free-for-all game night well — Glicko-2 in
particular wants ~10-15 games per player per rating period to behave well,
which a home game night rarely produces.

**Decision: OpenSkill (Weng-Lin model).** Each player has a μ (skill
estimate) and σ (uncertainty), updated directly from a single ranked outcome
(including ties and uneven team sizes) — no decomposition into pairwise
fights, no batching required.

**Displayed rating** is conservative: `ordinal = μ − 3σ`, scaled to
`round(ordinal × 40 + 1000)` so a brand-new player reads ~1000 rather than
"0.0". New and rusty players therefore look appropriately humble until the
engine has actually seen them play. Under 3 plays in a pool, a rating shows as
*provisional*.

**Rating engine only ever consumes placement/rank (with ties), never raw
score.** Score is stored separately, purely for analytics and bragging
rights (personal bests, high-score charts).

**True cooperative games** have no opposing skill signal and are **excluded
from the rating engine entirely** (§5.3). So are games explicitly flagged
unrated (§5.6).

### 3.1 Tiers

The displayed rating maps onto a named ladder, shown as a badge everywhere a
rating appears and as a visual ladder on the leaderboard:

📦 Shrinkwrapped (provisional) → 🧃 Cardboard Cadet → 🚶 Meeple Mover →
⚖️ Rules Lawyer → ⚙️ Engine Builder → 🪄 Combo Merchant → 👑 Table Tyrant →
🛸 Cardboard Deity

The **overall** tier is derived from the composite z-score (§4), not from a
player's best single game — otherwise two people with visibly different
overall numbers land on the same rung, which reads as a bug.

## 4. Rating Granularity — Overall, Per-Game, Per-Tag

- **Per-game rating is the source of truth.** Each player gets their own
  μ/σ per pool (§5.7). This is what powers the single, filterable leaderboard.
- **"Overall" is a derived composite, not a pooled average.** Raw μ isn't
  comparable across games (different games have different rating spreads).
  Compute each player's **z-score** in a given game — `(player's μ − group
  average μ in that game) / group's standard deviation in that game`,
  scoped to games with 3+ plays so a single lucky win doesn't dominate.
  Average a player's z-scores across all qualifying games for the Overall
  number.

  *Worked example:* Wingspan group average μ = 25, spread = 5, you're at
  32.5 → z = +1.5. Codenames group average μ = 25, spread = 2, you're at 27
  → z = +1.0. Composite = average of your z-scores across all qualifying
  games.

## 5. Game Configuration (the modular piece)

Different games track meaningfully different things. Rather than hard-coding
per-game logic, each game gets a small **config object**, filled out once via
a **"New Game" wizard** when the game is first added:

```
Game
├─ name
├─ bgg_id            (optional — see §11; effectively dormant)
├─ min_players / max_players
├─ scoring_mode       ranked-ffa | team-vs-team | hidden-team | coop-vs-game
├─ result_mode        ranked | winner-only          (§5.5)
├─ rated              bool — false keeps it out of the engine entirely (§5.6)
├─ rating_dimension   none | single-tag | multi-tag
├─ tag_pool           [ ] — e.g. Avalon: [Good, Evil]; Smash Up: 20 factions
├─ tags_per_player    int
├─ allows_teams       bool — FFA games sometimes played in partnerships
├─ variants           [ ] — named ways to play, each its own pool (§5.4)
├─ tracks_score       bool
├─ high_score_wins    bool
└─ tracks_difficulty  bool
```

The wizard asks these as plain-language questions. After that, the rating
engine and session-entry form are fully generic: they read the game's config.
Everything except `scoring_mode` and `rating_dimension` stays editable
afterwards from **Game settings** on the game's page; changes that affect how
history was rated trigger an automatic replay (§9).

### 5.1 Hidden roles (Avalon-style — `single-tag`)

Each player gets one tag per session (Good/Evil). Each tag becomes its own
rating pool, keyed `game + tag`, so "Avalon" is quietly three pools: the
overall one, Avalon·Good and Avalon·Evil. A session only updates the pool
matching the role a player actually had. OpenSkill's team math handles the
good-team-of-5-vs-evil-team-of-2 case natively.

Evil roles come up less often, so evil-pool σ naturally stays higher for
longer — the engine represents that honestly rather than pretending to know a
player's evil-skill from three data points.

**Leaderboard:** a role sub-filter appears only for `single-tag` games.

### 5.2 Multi-identity games (Smash Up-style — `multi-tag`)

Combo-level rating (faction pairs) is too sparse to ever accumulate
meaningful data — ~190 possible 2-of-20 combos. Instead, rate at the
**individual tag (faction) level**: each player accumulates μ/σ per faction
they've played, and a session feeds all of a player's tags into their
respective pools at once. Combos are a rich analytics question ("which faction
pairs win most together") rather than a sparse rating-engine problem.

**Decision:** multi-tag ratings live on the game's **analytics page**, not on
the main leaderboard, to keep the leaderboard clean.

### 5.3 Co-op difficulty (`coop-vs-game`)

Difficulty scales differ per game and shouldn't be normalized into one
universal number. A free-text `difficulty` field on the session record is used
for game-scoped analytics ("win rate by difficulty" for that one game). Never
touches the rating engine.

The field doubles as a useful slot for campaign games: the chapter, quest or
case name.

### 5.4 Variants — a game as a folder *(added after v1 design)*

Some games aren't one game. Cribbage is classic 1v1, three-handed, partners at
four, plus house rules — different player counts and sometimes different
rules. A game can therefore hold a list of **variants**, each with its own
player count and partnerships setting.

**Each variant keeps its own rating pool alongside the game's overall one** —
structurally the same trick as §5.1, but keyed on the *session* rather than
the player. A session counts toward both, so "who's best at Cribbage?" and
"who's best at four-handed?" are separately answerable. Sessions logged as
*Unspecified* count only toward the overall pool.

Variants also model games whose shape changes mid-play: Betrayal at House on
the Hill ships with "Traitor haunt" and "Co-op haunt".

### 5.5 Result granularity — `result_mode` *(added after v1 design)*

Two questions that are easy to conflate, and are fully independent:

**Is there a real 2nd and 3rd?**
- `ranked` — everyone finishes and can be placed. Either a final scoring round
  (Wingspan) or an elimination order that genuinely says who lasted longer
  (Risk, Coup).
- `winner-only` — someone wins and the rest simply lose; the game ends the
  moment it's decided and the losers aren't comparable (Cryptid, Fluxx, Clue).

For `winner-only`, session entry shows a **"Who won?"** tap list instead of a
drag order, and the engine is told the losers are *tied*. That is both the
truth and better information than a fabricated ranking — the losers come out
with identical ratings, which is exactly right.

**Does it write down a number?** Entirely separate (`tracks_score`). Risk is
ranked with no score; Coup has neither; Poker has both.

*The test when unsure: would you have to invent the order?* If yes, it's
`winner-only`. Concretely — did the game **stop**, or did everyone **finish**?

### 5.6 Unrated games — `rated` *(added after v1 design)*

Some games are logged for the record but aren't a skill contest: party games
with a rotating judge, or anything decided by a shuffle. Setting `rated: false`
keeps them in plays, streaks, the calendar and history while producing zero
rating rows. Cards Against Humanity and What Do You Meme? ship this way.

This is the same exclusion co-op games get automatically, made available as a
deliberate choice.

### 5.7 The pool key

Every rating lives in a pool keyed **game + variant + tag + player**:

| variant | tag | what it is |
|---|---|---|
| `''` | `''` | the game's overall pool — powers the main leaderboard |
| `V` | `''` | one way of playing it (Cribbage partners vs 1v1) |
| `''` | `T` | a role or faction pool (§5.1, §5.2) |

Variant and tag pools are deliberately **not crossed**. "Evil at four-handed
Cribbage" would be too sparse to mean anything, and each row above answers a
question someone would actually ask.

## 6. Data Model

```
players               id, name, emoji, color, tagline, pin_hash, join_date, active
games                 id, name, bgg_id, thumbnail, year, min_players, max_players,
                      weight, scoring_mode, result_mode, rated, rating_dimension,
                      tag_pool, tag_label, tags_per_player, tracks_score,
                      allows_teams, variants, tracks_difficulty, high_score_wins,
                      retired, created_at
seasons               id, name, started_at, ended_at, active
sessions              id, game_id, variant, played_at, notes, difficulty,
                      coop_result, season_id, logged_by, created_at
participants          id, session_id, player_id, placement, score, team, tags
rating_snapshots      id, session_id, player_id, game_id, variant, tag, season_id,
                      mu, sigma, displayed_rating, mu_before, sigma_before,
                      displayed_before, played_at, created_at
preference_comparisons id, player_id, winner_game_id, loser_game_id, created_at
game_preferences      player_id, game_id, method, strength, rank, comparisons, updated_at
session_reactions     session_id, player_id, emoji, count, last_updated
meta                  key, value
```

`rating_snapshots` holds one row per player per pool after every qualifying
session, which powers "rating over time" charts and lets a corrected session
recompute forward without losing history (§9).

`pin_hash` is never selected into any query that reaches the browser — a
separate `getPlayerRow()` is the only accessor that includes it.

**Migrations:** `ADDED_COLUMNS` in `src/lib/db.ts` lists columns added after
the schema shipped; they're `ALTER`ed in on boot. Adding a column requires a
server restart to take effect, since the connection is cached.

## 7. Player Identity, Session Entry & Reactions

**Session entry is single-person, on behalf of everyone.** One player logs
the whole session from one device — no per-player device or sign-in required.

**Identity has two levels, and they're different things:**

1. **Casual** — tap your face. Stored in that browser's `localStorage`, so
   each phone remembers its own. Used to attribute emoji reactions and to
   stamp `logged_by`. No PIN.
2. **PIN** — only for genuinely personal pages: your own Game Draft, and
   editing your own profile. Nobody issues the PIN; the player invents it on
   first sign-in (any 4+ digits) and it's scrypt-hashed from then on.

There is **no admin site**. Everyone on the wifi gets the same app; Settings is
just a page.

**Post-game reactions (spammable, multi-device, low-stakes):** the reveal
screen shows an emoji strip. Any player taps their name (no PIN) and taps
emoji freely; each tap increments a per-player, per-emoji tally rather than
locking in a single reaction. Taps are batched client-side and other phones
catch up by polling every 2.5s — no websockets at this scale. Curated set:
🔥 😂 💀 👑 🐍 🤡 😭 🎲.

**Game preference / player profile:**
- **Bradley-Terry preference ranking**, built via a dedicated **"Game Draft"
  tab** per player: low-pressure pairwise duels ("Wingspan or Ark Nova?") that
  slowly build a statistically honest preference ranking. Fitted with the
  standard MM algorithm plus a half-win/half-loss prior against a phantom
  opponent, so an undefeated game doesn't run to infinity. Pairs are chosen to
  favour under-exposed games and close matchups. An **undo** takes back the
  last answer and puts that pair straight back on the table.
- Enables the preference-vs-performance analytic: Spearman ρ between a
  player's preference rank and their win rate per game.

## 8. Analytics

Built and live:

- Rating trajectory over time (per player, per game, per variant)
- Head-to-head "rivalry" records between any two players (see §8.1)
- Win rate by player count
- Biggest upsets — low-rated player beating a much higher-rated one
- Current & longest win/loss streaks
- GitHub-style heatmap calendar of game nights
- Radar chart of a player's relative strength across games (z-scores)
- Preference-vs-performance correlation
- "Most improved" over a rolling window
- Per-tag breakdowns and faction-combo win rates (§5.1, §5.2)
- Per-variant standings (§5.4)
- Co-op: win rate by difficulty
- High scores / personal bests per game
- Tier ladder showing where everyone sits

### 8.1 Rivalry semantics

A head-to-head **win means you finished ahead of them** — 2nd against their 3rd
counts, mirrored as a loss on their card. That's the same signal the rating
engine reads, and the only reading that uses the whole table rather than
discarding every session neither player won. Because mid-table places are
weaker evidence, each row *also* shows the record restricted to nights one of
the two actually took first.

Sessions where both were on the **same side** (Codenames teammates, both Good
in Avalon) are tallied separately as teammate games, never as draws — an
earlier version counted them as ties, which quietly inflated every teammate
into a rival. Co-op and unrated games never count. "Nemesis" and "favourite
victim" need 3+ genuine meetings and a losing/winning record.

## 9. Editing & Recomputation

Ratings are sequential, so editing or deleting a past session **replays the
full session history in order** to regenerate `rating_snapshots` from scratch,
rather than patching rows in place.

This runs automatically after every create, edit and delete, and after any
game-config change that affects how history was rated (scoring mode, rating
dimension, tags-per-player, partnerships, variants, the `rated` flag). It is
also exposed manually in Settings for the rare case — a restored backup, or
hand-edited data.

Verified lossless: flipping a past session's placements moves every downstream
rating, and reverting it returns them to the original values exactly.

## 10. Product Feel

- **Player cards** — trading-card-style profile per person (tier, overall,
  streak, favourite game, strongest game, nemesis, favourite victim).
- **Post-game reveal** — rating deltas count up like a post-match screen,
  confetti on a personal best, an "upset alert" banner when a big underdog
  wins. Hosts the emoji reaction strip.
- **Bottom tab bar + swipe navigation**, installed as a PWA.
- **Silly rating tier names** (§3.1) instead of raw numbers alone.
- **Quick session entry** — pick game → (pick variant) → tap participants →
  drag to reorder placement, or tap the winner for `winner-only` games →
  optional score/tags/notes → done. A 🔗 toggle ties a player with the one
  above; side-based games get a one-tap "which side won?".

---

## 11. Open Items — current state

- **BGG integration: resolved as "no".** BoardGameGeek closed the XML API to
  anonymous callers; it now requires registering an application and sending a
  bearer token, and their terms allow denying or withdrawing a licence at
  their discretion. Not worth it for box art. The integration is written and
  works if `BGG_TOKEN` is set in `.env.local`, and the button is hidden
  otherwise. Code: `src/app/api/bgg/route.ts`.
- **Seasons:** schema supports `season_id` and Settings can start a new
  season, which stamps subsequent sessions. The soft-reset-with-elevated-σ
  behaviour is *not* implemented — currently a new season only partitions
  history going forward. Finish this if seasons actually get used.
- **Game library gap check: done.** The real 75-game shelf is loaded and
  documented in `scripts/games-catalog.mjs`. It drove three additions:
  variants (§5.4), result granularity (§5.5) and the unrated flag (§5.6).
  Entries carrying a `review` note are unverified guesses.
- **Tailscale / remote access:** still out of scope.

## 12. What changed from the original design

| Original | Now | Why |
|---|---|---|
| Placement always meaningful | `result_mode` (§5.5) | "Whoever survives longest" and "someone wins, rest lose" are different shapes; fabricating 2nd place is worse data than admitting a tie |
| Every non-co-op game rated | `rated` flag (§5.6) | Judged party games aren't a skill contest |
| One config per game | Variants (§5.4) | Cribbage at 2, 3 and 4 are different games sharing a box |
| Tier from best game | Tier from composite (§3.1) | Badge and number have to agree |
| H2H counts all pairings | Teammates split out (§8.1) | Same-side sessions were being counted as draws |
| "Drop two names on the same row for ties" | Drag + 🔗 tie toggle | Drop-target precision under a thumb, at a table, mid-game |
| BGG fills metadata | Effectively dormant (§11) | BGG closed the API |
| Score box implied placements | Fully independent | They always were, but the wizard didn't say so |

## 13. Where things live

```
src/lib/
  schema.sql       every table, in one place
  db.ts            connection, WAL, and the ALTER-based migration list
  types.ts         the config object, variants, and their parsers
  rating.ts        OpenSkill wrapper, displayed rating, tier ladders
  recompute.ts     the full replay engine and pool keying
  sessions.ts      create / edit / delete + the reveal payload
  queries.ts       leaderboards, composite, player stats, analytics
  bradleyterry.ts  preference model behind the Game Draft
  auth.ts          name + PIN identity
  palette.ts       avatar emoji and colours
src/app/           pages and API routes
src/components/    UI — session entry, reveal, charts, tier ladder, wizards
scripts/
  games-catalog.mjs  the real shelf, pre-configured
  import-games.mjs   idempotent loader for the above
  seed.mjs           demo data
  reset.mjs          back up and wipe, to start for real
  make-icons.mjs     generates the PWA PNGs
data/boardgames.db   the whole database
```

Commands: `npm run dev` · `build` · `start` · `import-games` · `seed` ·
`reset` · `icons`

## 14. Next session — analytics

The plan is to collect real data first, then build analytics against it,
because most of the interesting questions need volume to be worth drawing.
When we pick this back up:

1. **Check what the data supports.** Several built analytics (radar,
   composite, most-improved) need 3+ plays per player per game across several
   games before they say anything.
2. **Likely additions**, in rough order of value:
   - Game categories/tags of our own making — "engine builder", "party",
     "hidden info", weight 1–5 — enabling "who's good at heavy games?" and
     "what do we actually play?". This is the thing BGG would have given us,
     and doing it by hand is both feasible and better targeted. Design it
     against the real shelf.
   - Session-level review: what a whole game night looked like.
   - Win-rate by seat/turn order, if turn order gets recorded.
   - "Who should we play?" — intersect Bradley-Terry preferences across the
     players present.
   - Rating confidence bands on the trajectory charts (σ is stored).
3. **Feedback from the group** may reorder all of this.

## 15. Known gaps and deliberate omissions

- **Campaign games** (Betrayal Legacy, Descent) are logged as co-op sessions
  with the chapter in the difficulty field. Real campaign tracking — ordered
  progress, persistent state — is unbuilt.
- **Blood on the Clocktower** tracks Good vs Evil only. Character-level pools
  would need a second per-player tag axis, and with dozens of characters the
  data would be far too thin to mean anything.
- **Seasons** partition but don't soft-reset (§11).
- **The Storyteller / GM** isn't modelled; leave them out of the session.
- **Turn order / seat position** isn't recorded.
- **No auth boundary.** Anyone on the wifi can log or delete anything. That's
  the design, given the trusted-home-network premise.
- **Six games in the catalog are guesses** — Fae, For the King (And Me),
  Tricks and the Phantom, One Card Wonder, Pirate Den, Oh Gnome You Don't,
  Bluffaneer, Pusheen. Each carries a `review` note.
