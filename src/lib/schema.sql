-- Board Game Night Tracker — schema (see design doc §6)
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS players (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL UNIQUE,
  emoji      TEXT    NOT NULL DEFAULT '🎲',
  color      TEXT    NOT NULL DEFAULT '#8b5cf6',
  tagline    TEXT,
  pin_hash   TEXT,
  join_date  TEXT    NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS games (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT    NOT NULL UNIQUE,
  bgg_id            INTEGER,
  thumbnail         TEXT,
  year              INTEGER,
  min_players       INTEGER,
  max_players       INTEGER,
  weight            REAL,
  -- config object (§5)
  scoring_mode      TEXT    NOT NULL,             -- ranked-ffa | team-vs-team | hidden-team | coop-vs-game
  result_mode       TEXT    NOT NULL DEFAULT 'ranked',  -- ranked | winner-only
  rated             INTEGER NOT NULL DEFAULT 1,    -- 0 = log it, but keep it out of the engine
  rating_dimension  TEXT    NOT NULL DEFAULT 'none', -- none | single-tag | multi-tag
  tag_pool          TEXT,                          -- JSON array of tag names
  tag_label         TEXT,                          -- e.g. 'Role', 'Faction'
  tags_per_player   INTEGER NOT NULL DEFAULT 1,
  tracks_score      INTEGER NOT NULL DEFAULT 0,
  allows_teams      INTEGER NOT NULL DEFAULT 0,   -- FFA games sometimes played in partnerships
  variants          TEXT,                          -- JSON array of named variants (see §5.4)
  tracks_difficulty INTEGER NOT NULL DEFAULT 0,
  high_score_wins   INTEGER NOT NULL DEFAULT 1,
  retired           INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS seasons (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at   TEXT,
  active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id     INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  played_at   TEXT    NOT NULL,   -- ISO datetime; drives replay order
  notes       TEXT,
  variant     TEXT,               -- which named variant was played (optional)
  difficulty  TEXT,               -- coop only (§5.3)
  coop_result TEXT,               -- 'win' | 'loss' (coop only)
  season_id   INTEGER REFERENCES seasons(id),
  logged_by   INTEGER REFERENCES players(id),
  created_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  placement  INTEGER NOT NULL,    -- 1-based, ties share a number
  score      REAL,
  team       TEXT,
  tags       TEXT,                -- JSON array (per rating_dimension)
  UNIQUE (session_id, player_id)
);

-- One row per player per (game+tag) pool after every qualifying session (§6, §9).
CREATE TABLE IF NOT EXISTS rating_snapshots (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id       INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  player_id        INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id          INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  tag              TEXT    NOT NULL DEFAULT '',  -- '' = the game's base pool
  variant          TEXT    NOT NULL DEFAULT '',  -- '' = across all variants
  season_id        INTEGER,
  mu               REAL NOT NULL,
  sigma            REAL NOT NULL,
  displayed_rating REAL NOT NULL,
  mu_before        REAL NOT NULL,
  sigma_before     REAL NOT NULL,
  displayed_before REAL NOT NULL,
  played_at        TEXT NOT NULL,
  created_at       TEXT NOT NULL
);

-- Raw pairwise duels behind the Bradley-Terry preference model (§7)
CREATE TABLE IF NOT EXISTS preference_comparisons (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id      INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  winner_game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  loser_game_id  INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  created_at     TEXT NOT NULL
);

-- Materialised Bradley-Terry strengths (§6 GamePreferences)
CREATE TABLE IF NOT EXISTS game_preferences (
  player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id    INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  method     TEXT    NOT NULL DEFAULT 'bradley_terry',
  strength   REAL    NOT NULL,
  rank       INTEGER NOT NULL,
  comparisons INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT    NOT NULL,
  PRIMARY KEY (player_id, game_id)
);

CREATE TABLE IF NOT EXISTS session_reactions (
  session_id   INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id    INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  emoji        TEXT    NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  last_updated TEXT    NOT NULL,
  PRIMARY KEY (session_id, player_id, emoji)
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
CREATE INDEX IF NOT EXISTS idx_participants_player  ON participants(player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_game        ON sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_sessions_played      ON sessions(played_at);
CREATE INDEX IF NOT EXISTS idx_snap_pool            ON rating_snapshots(game_id, variant, tag, player_id);
CREATE INDEX IF NOT EXISTS idx_snap_session         ON rating_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_snap_player          ON rating_snapshots(player_id, played_at);
