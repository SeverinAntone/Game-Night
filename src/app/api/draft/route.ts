import { NextResponse } from "next/server";
import { currentPlayer } from "@/lib/auth";
import { fitPreferences, nextDuel, persistPreferences } from "@/lib/bradleyterry";
import { getGame } from "@/lib/queries";
import type { Game } from "@/lib/types";
import { get, nowIso, run } from "@/lib/db";

export const dynamic = "force-dynamic";

const answeredCount = (playerId: number) =>
  get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM preference_comparisons WHERE player_id = ?",
    playerId,
  )?.n ?? 0;

/** Serves the next "Wingspan or Terraforming Mars?" duel plus current standings. */
export async function GET() {
  const me = await currentPlayer();
  if (!me) return NextResponse.json({ error: "Sign in to draft." }, { status: 401 });
  const duel = nextDuel(me.id);
  return NextResponse.json({
    duel: duel ? [duel[0], duel[1]] : null,
    standings: fitPreferences(me.id),
    answered: answeredCount(me.id),
  });
}

export async function POST(req: Request) {
  const me = await currentPlayer();
  if (!me) return NextResponse.json({ error: "Sign in to draft." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const winner = Number(body?.winner_game_id);
  const loser = Number(body?.loser_game_id);
  if (!winner || !loser || winner === loser)
    return NextResponse.json({ error: "Pick one of the two." }, { status: 400 });

  run(
    `INSERT INTO preference_comparisons (player_id, winner_game_id, loser_game_id, created_at)
     VALUES (?, ?, ?, ?)`,
    me.id,
    winner,
    loser,
    nowIso(),
  );

  const standings = persistPreferences(me.id);
  const duel = nextDuel(me.id);
  return NextResponse.json({
    duel: duel ? [duel[0], duel[1]] : null,
    standings,
    answered: answeredCount(me.id),
  });
}

/**
 * Undo the last duel. Misclicks happen, and a preference you didn't mean is
 * worse than one you never gave — so the pair comes straight back as the
 * current duel, ready to be answered the other way.
 */
export async function DELETE() {
  const me = await currentPlayer();
  if (!me) return NextResponse.json({ error: "Sign in to draft." }, { status: 401 });

  const last = get<{ id: number; winner_game_id: number; loser_game_id: number }>(
    `SELECT id, winner_game_id, loser_game_id FROM preference_comparisons
      WHERE player_id = ? ORDER BY id DESC LIMIT 1`,
    me.id,
  );
  if (!last) return NextResponse.json({ error: "Nothing to undo." }, { status: 400 });

  run("DELETE FROM preference_comparisons WHERE id = ?", last.id);
  const standings = persistPreferences(me.id);

  const winner = getGame(last.winner_game_id);
  const loser = getGame(last.loser_game_id);
  const replay = winner && loser ? [winner, loser] : null;
  const duel = replay ?? (nextDuel(me.id) as [Game, Game] | null);

  return NextResponse.json({
    duel,
    standings,
    answered: answeredCount(me.id),
    undone: winner && loser ? { winner: winner.name, loser: loser.name } : null,
  });
}
