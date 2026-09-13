import { NextResponse } from "next/server";
import { requireWriter } from "@/lib/apiAuth";
import { logChange } from "@/lib/changelog";
import { get, run } from "@/lib/db";
import { getGame } from "@/lib/queries";
import { parseVariants } from "@/lib/types";
import { replayRatings } from "@/lib/recompute";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const game = getGame(Number((await params).id));
  return game
    ? NextResponse.json(game)
    : NextResponse.json({ error: "No such game." }, { status: 404 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireWriter();
  if ("error" in auth) return auth.error;
  const { player: actor } = auth;

  const id = Number((await params).id);
  const game = getGame(id);
  if (!game) return NextResponse.json({ error: "No such game." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const fields: string[] = [];
  const values: unknown[] = [];
  const changes: string[] = [];
  const bool = (v: unknown) => (v ? "on" : "off");
  const set = (col: string, v: unknown, describe?: [unknown, unknown]) => {
    fields.push(`${col} = ?`);
    values.push(v);
    if (describe) changes.push(`${col}: ${describe[0]} → ${describe[1]}`);
  };

  if (typeof b.name === "string" && b.name.trim() && b.name.trim() !== game.name)
    set("name", b.name.trim(), [game.name, b.name.trim()]);
  if (typeof b.thumbnail === "string") set("thumbnail", b.thumbnail || null);
  if (typeof b.tracks_score === "boolean" && Number(b.tracks_score) !== game.tracks_score)
    set("tracks_score", b.tracks_score ? 1 : 0, [bool(game.tracks_score), bool(b.tracks_score)]);
  if (
    (b.result_mode === "ranked" || b.result_mode === "winner-only") &&
    b.result_mode !== game.result_mode
  )
    set("result_mode", b.result_mode, [game.result_mode, b.result_mode]);
  if (
    typeof b.tracks_difficulty === "boolean" &&
    Number(b.tracks_difficulty) !== game.tracks_difficulty
  )
    set("tracks_difficulty", b.tracks_difficulty ? 1 : 0, [
      bool(game.tracks_difficulty),
      bool(b.tracks_difficulty),
    ]);
  if (typeof b.high_score_wins === "boolean" && Number(b.high_score_wins) !== game.high_score_wins)
    set("high_score_wins", b.high_score_wins ? 1 : 0, [
      bool(game.high_score_wins),
      bool(b.high_score_wins),
    ]);
  if (typeof b.retired === "boolean" && Number(b.retired) !== game.retired)
    set("retired", b.retired ? 1 : 0, [bool(game.retired), bool(b.retired)]);
  if (typeof b.tag_label === "string" && (b.tag_label || null) !== game.tag_label)
    set("tag_label", b.tag_label || null, [game.tag_label ?? "(none)", b.tag_label || "(none)"]);
  if (typeof b.min_players === "number" && b.min_players !== game.min_players)
    set("min_players", b.min_players, [game.min_players, b.min_players]);
  if (typeof b.max_players === "number" && b.max_players !== game.max_players)
    set("max_players", b.max_players, [game.max_players, b.max_players]);

  // Adding tags to the pool is safe; the wizard's structural answers
  // (scoring_mode / rating_dimension) change how history is rated, so a change
  // there triggers a full replay below.
  if (Array.isArray(b.tag_pool)) {
    const pool = b.tag_pool.map((t: unknown) => String(t).trim()).filter(Boolean);
    const next = pool.length ? JSON.stringify(pool) : null;
    if (next !== game.tag_pool) set("tag_pool", next, ["tag pool changed", pool.join(", ") || "(none)"]);
  }

  let structural = false;
  // Flipping "rated" changes whether this game ever produced ratings at all.
  if (typeof b.rated === "boolean" && Number(b.rated) !== game.rated) {
    set("rated", b.rated ? 1 : 0, [bool(game.rated), bool(b.rated)]);
    structural = true;
  }
  if (typeof b.scoring_mode === "string" && b.scoring_mode !== game.scoring_mode) {
    set("scoring_mode", b.scoring_mode, [game.scoring_mode, b.scoring_mode]);
    structural = true;
  }
  if (typeof b.rating_dimension === "string" && b.rating_dimension !== game.rating_dimension) {
    set("rating_dimension", b.rating_dimension, [game.rating_dimension, b.rating_dimension]);
    structural = true;
  }
  if (typeof b.tags_per_player === "number" && b.tags_per_player !== game.tags_per_player) {
    set("tags_per_player", Math.max(1, b.tags_per_player), [
      game.tags_per_player,
      Math.max(1, b.tags_per_player),
    ]);
    structural = true;
  }
  // Partnerships change how past sessions group into rating teams, so this one
  // has to replay rather than just flip a display flag.
  if (typeof b.allows_teams === "boolean" && Number(b.allows_teams) !== game.allows_teams) {
    set("allows_teams", b.allows_teams ? 1 : 0, [bool(game.allows_teams), bool(b.allows_teams)]);
    structural = true;
  }
  // Renaming or removing a variant changes which pool past sessions belong to.
  if (Array.isArray(b.variants)) {
    const variants = parseVariants(JSON.stringify(b.variants));
    const next = variants.length ? JSON.stringify(variants) : null;
    if (next !== game.variants) {
      set("variants", next, ["variants changed", variants.map((v) => v.name).join(", ") || "(none)"]);
      structural = true;
    }
  }

  if (fields.length) {
    try {
      run(`UPDATE games SET ${fields.join(", ")} WHERE id = ?`, ...values, id);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // Only a UNIQUE violation is a name clash; anything else is a real fault
      // and saying "that name is taken" would send someone hunting the wrong bug.
      if (message.includes("UNIQUE"))
        return NextResponse.json({ error: "That name is taken." }, { status: 400 });
      console.error("PATCH /api/games/[id] failed:", message);
      return NextResponse.json({ error: `Could not save: ${message}` }, { status: 500 });
    }
  }
  if (structural) replayRatings();
  if (fields.length)
    logChange(
      actor,
      "game.edit",
      `Edited ${game.name}'s settings`,
      changes.length ? changes.join("\n") : undefined,
    );
  return NextResponse.json({ ok: true, replayed: structural });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireWriter();
  if ("error" in auth) return auth.error;
  const { player: actor } = auth;

  const id = Number((await params).id);
  const game = getGame(id);
  const played = get<{ n: number }>("SELECT COUNT(*) AS n FROM sessions WHERE game_id = ?", id);
  if (played && played.n > 0) {
    // Keep the history intact — retire instead of deleting.
    run("UPDATE games SET retired = 1 WHERE id = ?", id);
    logChange(
      actor,
      "game.retire",
      `Retired ${game?.name ?? "a game"}`,
      `${played.n} logged session${played.n === 1 ? "" : "s"} kept intact`,
    );
    return NextResponse.json({ ok: true, retired: true });
  }
  run("DELETE FROM games WHERE id = ?", id);
  logChange(
    actor,
    "game.delete",
    `Deleted ${game?.name ?? "a game"}`,
    game ? `Never played — ${game.scoring_mode}, ${game.min_players ?? "?"}–${game.max_players ?? "?"} players` : undefined,
  );
  return NextResponse.json({ ok: true, deleted: true });
}
