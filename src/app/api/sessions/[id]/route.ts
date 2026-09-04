import { NextResponse } from "next/server";
import { getParticipants, getSession } from "@/lib/queries";
import { deleteSession, updateSession, ValidationError } from "@/lib/sessions";
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
  const id = Number((await params).id);
  const body = (await req.json().catch(() => null)) as SessionInput | null;
  if (!body) return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  try {
    updateSession(id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Could not update the session." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  deleteSession(Number((await params).id));
  return NextResponse.json({ ok: true });
}
