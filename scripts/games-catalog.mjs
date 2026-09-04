/**
 * The shelf, pre-configured.
 *
 * Every entry is a first draft of that game's config — the answers the New Game
 * wizard would have collected. Anything marked `review` is a judgement call
 * worth a second opinion; open the game and use "Game settings" to change it.
 *
 * Shorthand used below:
 *   mode    ranked-ffa | team-vs-team | hidden-team | coop-vs-game
 *   result  ranked (real 2nd/3rd) | winner-only (someone wins, rest just lose)
 *   score   true when a number gets written down; never feeds the rating engine
 *   rated   false for games where "skill" isn't really the point
 */

const G = (name, players, mode, result, extra = {}) => ({
  name,
  min_players: players[0],
  max_players: players[1],
  scoring_mode: mode,
  result_mode: result,
  tracks_score: false,
  high_score_wins: true,
  rated: true,
  rating_dimension: "none",
  ...extra,
});

const score = (high = true) => ({ tracks_score: true, high_score_wins: high });

export const CATALOG = [
  // --- Point salads: play to the end, count up, place everyone -------------
  G("Ark Nova", [1, 4], "ranked-ffa", "ranked", score()),
  G("7 Wonders", [3, 7], "ranked-ffa", "ranked", score()),
  G("Splendor", [2, 4], "ranked-ffa", "ranked", score()),
  G("Ticket to Ride", [2, 5], "ranked-ffa", "ranked", score()),
  G("Dominion", [2, 4], "ranked-ffa", "ranked", score()),
  G("Wingspan", [1, 5], "ranked-ffa", "ranked", score()),
  G("Carcassonne", [2, 5], "ranked-ffa", "ranked", score()),
  G("Power Grid", [2, 6], "ranked-ffa", "ranked", score()),
  G("Wormholes", [2, 5], "ranked-ffa", "ranked", score()),
  G("Azul", [2, 4], "ranked-ffa", "ranked", score()),
  G("Cartographers", [1, 6], "ranked-ffa", "ranked", score()),
  G("Tokaido", [2, 5], "ranked-ffa", "ranked", score()),
  G("Dixit", [3, 8], "ranked-ffa", "ranked", score()),
  G("Red Rising", [1, 6], "ranked-ffa", "ranked", score()),
  G("Dice Forge", [2, 4], "ranked-ffa", "ranked", score()),
  G("Tiny Epic Quest", [1, 4], "ranked-ffa", "ranked", score()),
  G("Clank!", [2, 4], "ranked-ffa", "ranked", score()),
  G("Catan", [3, 4], "ranked-ffa", "ranked", score()),
  G("Equinox", [2, 5], "ranked-ffa", "ranked", score()),
  G("Doomlings", [2, 6], "ranked-ffa", "ranked", score()),
  G("Sheriff of Nottingham", [3, 6], "ranked-ffa", "ranked", score()),
  G("Deep Sea Adventure", [2, 6], "ranked-ffa", "ranked", score()),
  G("Skull King", [2, 8], "ranked-ffa", "ranked", score()),
  G("Medium", [2, 8], "ranked-ffa", "ranked", score()),
  G("Yahtzee", [1, 10], "ranked-ffa", "ranked", score()),
  G("Othello", [2, 2], "ranked-ffa", "ranked", score()),
  G("The Fox in the Forest", [2, 2], "ranked-ffa", "ranked", score()),
  G("Lost Cities", [2, 2], "ranked-ffa", "ranked", score()),
  G("Poker", [2, 10], "ranked-ffa", "ranked", {
    ...score(),
    review: "Score = chips at the end. Ranked by stack, which is the usual read.",
  }),
  G("No Thanks!", [3, 7], "ranked-ffa", "ranked", score(false)),

  // --- Ranked with no score: an honest finishing order, no numbers ---------
  G("Risk", [2, 6], "ranked-ffa", "ranked", {
    review: "Placed by elimination order — who lasted longest. No score anywhere.",
  }),
  G("Diplomacy", [2, 7], "ranked-ffa", "ranked", {
    review:
      "Shared victories are common; log them as a tie by linking the players. Could also be scored by supply centres if you prefer.",
  }),
  G("Coup", [2, 6], "ranked-ffa", "ranked", {
    review:
      "Elimination order is meaningful here (last one standing wins, and going out 2nd-last is better than going out first). Switch to winner-only if you'd rather not track it.",
  }),
  G("Talisman", [2, 6], "ranked-ffa", "winner-only"),
  G("Kill Doctor Lucky", [3, 7], "ranked-ffa", "winner-only"),
  G("Clue", [3, 6], "ranked-ffa", "winner-only"),
  G("Cryptid", [3, 5], "ranked-ffa", "winner-only"),
  G("Fluxx", [2, 6], "ranked-ffa", "winner-only"),
  G("Unstable Unicorns", [2, 8], "ranked-ffa", "winner-only"),
  G("Monopoly Deal", [2, 5], "ranked-ffa", "winner-only"),
  G("Bananagrams", [1, 8], "ranked-ffa", "winner-only"),
  G("Quarto", [2, 2], "ranked-ffa", "winner-only"),
  G("Stratego", [2, 2], "ranked-ffa", "winner-only"),
  G("Twister", [2, 4], "ranked-ffa", "winner-only", {
    review: "Last one standing. Left rated — say the word and it becomes unrated.",
  }),
  G("Hellapagos", [3, 12], "ranked-ffa", "winner-only", {
    review: "Several people can survive together — tap every survivor as a winner.",
  }),
  G("Monopoly", [2, 8], "ranked-ffa", "winner-only", {
    review: "Could be ranked by bankruptcy order instead, if anyone survives that long.",
  }),
  G("Rummikub", [2, 4], "ranked-ffa", "winner-only", {
    ...score(false),
    review: "First to go out wins; the score is the running penalty total, so low is good.",
  }),
  G("Phase 10", [2, 6], "ranked-ffa", "winner-only", {
    ...score(false),
    review: "First through phase 10 wins; score only breaks ties, so low is good.",
  }),
  G("Uno", [2, 10], "ranked-ffa", "winner-only", {
    review: "Switch to ranked + score if you play the cumulative-points variant.",
  }),
  G("Sequence", [2, 12], "ranked-ffa", "winner-only", {
    allows_teams: true,
    review: "Partnerships at 4 and 6 — use the team picker; leave everyone Solo otherwise.",
  }),

  // --- Cribbage keeps its variants (already configured if it exists) -------
  G("Cribbage", [2, 4], "ranked-ffa", "ranked", {
    ...score(),
    allows_teams: true,
    variants: [
      { name: "Classic (1v1)", min_players: 2, max_players: 2, allows_teams: false },
      { name: "Three-handed", min_players: 3, max_players: 3, allows_teams: false },
      { name: "Partners (4)", min_players: 4, max_players: 4, allows_teams: true },
    ],
  }),

  // --- Hidden roles --------------------------------------------------------
  G("The Resistance", [5, 10], "hidden-team", "winner-only", {
    rating_dimension: "single-tag",
    tag_label: "Role",
    tag_pool: ["Resistance", "Spy"],
  }),
  G("One Night Ultimate Werewolf", [3, 10], "hidden-team", "winner-only", {
    rating_dimension: "single-tag",
    tag_label: "Role",
    tag_pool: ["Village", "Werewolf", "Tanner"],
    review: "Tanner wins alone — tap only them as the winning side when it happens.",
  }),
  G("One Night Revolution", [3, 7], "hidden-team", "winner-only", {
    rating_dimension: "single-tag",
    tag_label: "Role",
    tag_pool: ["Loyalist", "Revolutionary"],
  }),
  G("Blood on the Clocktower", [5, 20], "hidden-team", "winner-only", {
    rating_dimension: "single-tag",
    tag_label: "Team",
    tag_pool: ["Good", "Evil"],
    review:
      "The Storyteller isn't a player — leave them out of the session. Individual characters aren't tracked, only Good vs Evil; tell me if you want character-level pools.",
  }),
  G("Betrayal at House on the Hill", [3, 6], "hidden-team", "winner-only", {
    rating_dimension: "single-tag",
    tag_label: "Side",
    tag_pool: ["Heroes", "Traitor"],
    variants: [
      { name: "Traitor haunt", min_players: 3, max_players: 6, allows_teams: true },
      { name: "Co-op haunt", min_players: 3, max_players: 6, allows_teams: true },
    ],
    review:
      "The haunt decides the shape. Traitor haunts fit Heroes vs Traitor; a few haunts are everyone-together, which is what the Co-op haunt variant is for.",
  }),

  // --- Teams ---------------------------------------------------------------
  G("Codenames", [2, 8], "team-vs-team", "winner-only"),
  G("Mad Gab", [2, 12], "team-vs-team", "winner-only", score()),

  // --- Multi-identity ------------------------------------------------------
  G("Smash Up", [2, 4], "ranked-ffa", "ranked", {
    ...score(),
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
    review: "Only the base-set factions are listed — add your expansions in Game settings.",
  }),

  // --- Co-op: never rated, logged for streaks and difficulty ---------------
  G("Spirit Island", [1, 6], "coop-vs-game", "ranked", { tracks_difficulty: true }),
  G("Hanabi", [2, 5], "coop-vs-game", "ranked", { ...score(), tracks_difficulty: false }),
  G("Mysterium", [2, 7], "coop-vs-game", "ranked", { tracks_difficulty: true }),
  G("Sherlock Holmes Consulting Detective", [1, 8], "coop-vs-game", "ranked", {
    ...score(),
    tracks_difficulty: true,
    review: "Score = how you did against Holmes. Difficulty is a good place for the case name.",
  }),
  G("Descent: Legends of the Dark", [1, 4], "coop-vs-game", "ranked", {
    tracks_difficulty: true,
    review: "A campaign — difficulty is a good field for which quest you played.",
  }),
  G("Betrayal Legacy", [3, 5], "coop-vs-game", "ranked", {
    tracks_difficulty: true,
    review:
      "Legacy campaign, and the haunt shape changes per chapter. Filed as co-op so it never distorts ratings; use difficulty for the chapter number.",
  }),

  // --- Logged for the record, kept out of the ratings ----------------------
  G("Cards Against Humanity", [4, 20], "ranked-ffa", "winner-only", {
    rated: false,
    review: "A rotating judge picks the winner. Logged for plays, never rated.",
  }),
  G("What do you Meme?", [3, 20], "ranked-ffa", "winner-only", {
    rated: false,
    review: "Same as above — judged, so not a skill measurement.",
  }),

  // --- Ones I don't know: minimal guesses, please correct ------------------
  G("Fae", [2, 5], "ranked-ffa", "ranked", {
    ...score(),
    review: "I don't know this one — guessed a scoring free-for-all.",
  }),
  G("For the King (And Me)", [2, 4], "ranked-ffa", "ranked", {
    ...score(),
    review: "I don't know this one — please correct the shape.",
  }),
  G("Tricks and the Phantom", [3, 6], "ranked-ffa", "ranked", {
    ...score(),
    review: "Guessed a trick-taking scorer from the name. Please correct.",
  }),
  G("One Card Wonder", [2, 6], "ranked-ffa", "winner-only", {
    review: "I don't know this one — guessed a quick winner-takes-it card game.",
  }),
  G("Pirate Den", [2, 6], "ranked-ffa", "ranked", {
    ...score(),
    review: "I don't know this one — please correct the shape.",
  }),
  G("Oh Gnome You Don't", [2, 6], "ranked-ffa", "ranked", {
    ...score(),
    review: "I don't know this one — please correct the shape.",
  }),
  G("Bluffaneer", [3, 8], "ranked-ffa", "winner-only", {
    review: "I don't know this one — the name suggests bluffing, so guessed winner-takes-it.",
  }),
  G("Pusheen", [2, 6], "ranked-ffa", "ranked", {
    ...score(),
    review: "Guessed a light scoring card game. Please correct.",
  }),
];

export default CATALOG;
