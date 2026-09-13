import { NextResponse } from "next/server";
import { requireWriter } from "@/lib/apiAuth";
import { logChange } from "@/lib/changelog";
import { getGame, getParticipants, getSession } from "@/lib/queries";
import { deleteSession, describeParticipants, updateSession, ValidationError } from "@/lib/sessions";
import { parseTags, type SessionInput } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const session = getSession(id);
  if (!session) return NextResponse.json({ error: "No such session." }, { status: 404 });
  return NextResponse.json({
    ...session,
    participants: getParticipants(id).map((p) => ({ ...p, tags: parseTags(p.tags) })),
  });
}

/** Editing replays every rating from scratch (§9) — mis-entries are cheap to fix. */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireWriter();
  if ("error" in auth) return auth.error;
  const { player: actor } = auth;

  const id = Number((await params).id);
  const existing = getSession(id);
  const before = existing ? describeParticipants(getParticipants(id)) : null;

  const body = (await req.json().catch(() => null)) as SessionInput | null;
  if (!body) return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  try {
    updateSession(id, body);
    const game = getGame(body.game_id ?? existing?.game_id ?? 0);
    const after = describeParticipants(body.participants);
    logChange(
      actor,
      "session.edit",
      `Edited a session of ${game?.name ?? "a game"}`,
      before !== null && before !== after ? `Before: ${before}\nAfter:  ${after}` : `Players: ${after}`,
      { type: "session", id },
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Could not update the session." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireWriter();
  if ("error" in auth) return auth.error;
  const { player: actor } = auth;

  const id = Number((await params).id);
  const existing = getSession(id);
  const game = existing ? getGame(existing.game_id) : undefined;
  const wasPlaying = existing ? describeParticipants(getParticipants(id)) : undefined;
  deleteSession(id);
  logChange(
    actor,
    "session.delete",
    `Deleted a session of ${game?.name ?? "a game"}`,
    wasPlaying,
    { type: "session", id },
  );
  return NextResponse.json({ ok: true });
}
