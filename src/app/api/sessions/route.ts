import { NextResponse } from "next/server";
import { requireWriter } from "@/lib/apiAuth";
import { logChange } from "@/lib/changelog";
import { getGame, getSessions } from "@/lib/queries";
import { createSession, ValidationError } from "@/lib/sessions";
import type { SessionInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const game = url.searchParams.get("game");
  const player = url.searchParams.get("player");
  const limit = Number(url.searchParams.get("limit") ?? 50);
  return NextResponse.json(
    getSessions(limit, game ? Number(game) : undefined, player ? Number(player) : undefined),
  );
}

export async function POST(req: Request) {
  const auth = await requireWriter();
  if ("error" in auth) return auth.error;
  const { player: actor } = auth;

  const body = (await req.json().catch(() => null)) as SessionInput | null;
  if (!body) return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  try {
    const id = createSession(body);
    const game = getGame(body.game_id);
    logChange(actor, "session.create", `Logged a session of ${game?.name ?? "a game"}`);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Could not save the session." }, { status: 500 });
  }
}
