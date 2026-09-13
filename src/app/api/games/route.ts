import { NextResponse } from "next/server";
import { requireWriter } from "@/lib/apiAuth";
import { logChange } from "@/lib/changelog";
import { nowIso, run } from "@/lib/db";
import { getGames } from "@/lib/queries";
import { parseVariants, type RatingDimension, type ResultMode, type ScoringMode } from "@/lib/types";

export const dynamic = "force-dynamic";

const MODES: ScoringMode[] = ["ranked-ffa", "team-vs-team", "hidden-team", "coop-vs-game"];
const RESULT_MODES: ResultMode[] = ["ranked", "winner-only"];
const DIMENSIONS: RatingDimension[] = ["none", "single-tag", "multi-tag"];

export async function GET() {
  return NextResponse.json(getGames(true));
}

/** Creates a game from the New Game wizard's config object (§5). */
export async function POST(req: Request) {
  const auth = await requireWriter();
  if ("error" in auth) return auth.error;
  const { player: actor } = auth;

  const b = await req.json().catch(() => null);
  const name = String(b?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "A name is required." }, { status: 400 });

  const scoring_mode = MODES.includes(b.scoring_mode) ? b.scoring_mode : "ranked-ffa";
  let rating_dimension: RatingDimension = DIMENSIONS.includes(b.rating_dimension)
    ? b.rating_dimension
    : "none";

  const tagPool: string[] = Array.isArray(b.tag_pool)
    ? b.tag_pool.map((t: unknown) => String(t).trim()).filter(Boolean)
    : [];
  if (rating_dimension !== "none" && tagPool.length < 2) rating_dimension = "none";
  // Co-ops never rate, so tag pools would be dead weight there.
  if (scoring_mode === "coop-vs-game") rating_dimension = "none";

  const variants = parseVariants(JSON.stringify(b.variants ?? []));
  const variantsJson = variants.length ? JSON.stringify(variants) : null;

  try {
    const res = run(
      `INSERT INTO games (name, bgg_id, thumbnail, year, min_players, max_players, weight,
                          scoring_mode, rating_dimension, tag_pool, tag_label, tags_per_player,
                          tracks_score, allows_teams, variants, result_mode, rated, tracks_difficulty,
                          high_score_wins, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      name,
      b.bgg_id ? Number(b.bgg_id) : null,
      b.thumbnail ? String(b.thumbnail) : null,
      b.year ? Number(b.year) : null,
      b.min_players ? Number(b.min_players) : null,
      b.max_players ? Number(b.max_players) : null,
      b.weight ? Number(b.weight) : null,
      scoring_mode,
      rating_dimension,
      rating_dimension === "none" ? null : JSON.stringify(tagPool),
      rating_dimension === "none" ? null : String(b.tag_label || "Tag"),
      rating_dimension === "multi-tag" ? Math.max(1, Number(b.tags_per_player) || 2) : 1,
      b.tracks_score ? 1 : 0,
      // Team-based modes already group by side; the flag is for FFA games that
      // are occasionally played in partnerships (§5 gap: Cribbage at four).
      scoring_mode === "ranked-ffa" && b.allows_teams ? 1 : 0,
      variantsJson,
      RESULT_MODES.includes(b.result_mode) ? b.result_mode : "ranked",
      b.rated === false ? 0 : 1,
      scoring_mode === "coop-vs-game" && b.tracks_difficulty ? 1 : 0,
      b.high_score_wins === false ? 0 : 1,
      nowIso(),
    );
    const newId = Number(res.lastInsertRowid);
    logChange(
      actor,
      "game.add",
      `Added ${name} to the shelf`,
      `${scoring_mode}${
        b.min_players || b.max_players ? `, ${b.min_players ?? "?"}–${b.max_players ?? "?"} players` : ""
      }${rating_dimension !== "none" ? `, rated by ${b.tag_label || "Tag"}` : ""}`,
      { type: "game", id: newId },
    );
    return NextResponse.json({ id: newId }, { status: 201 });
  } catch (e) {
    const msg =
      e instanceof Error && e.message.includes("UNIQUE")
        ? "That game is already in the library."
        : "Could not add the game.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
