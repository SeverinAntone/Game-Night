import { NextResponse } from "next/server";
import { COOKIE, currentPlayer, hashPin, makeToken, verifyPin } from "@/lib/auth";
import { run } from "@/lib/db";
import { getPlayerRow } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const player = await currentPlayer();
  return NextResponse.json({ player: player ? { id: player.id, name: player.name } : null });
}

/** name + PIN sign-in, for personal actions only (§7). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const id = Number(body?.player_id);
  const pin = String(body?.pin ?? "");
  const player = getPlayerRow(id);
  if (!player) return NextResponse.json({ error: "No such player." }, { status: 404 });

  if (!player.pin_hash) {
    // First sign-in sets the PIN — nobody has to visit a settings page first.
    if (pin.length < 4) return NextResponse.json({ error: "Pick a PIN of 4+ digits." }, { status: 400 });
    run("UPDATE players SET pin_hash = ? WHERE id = ?", hashPin(pin), id);
  } else if (!verifyPin(pin, player.pin_hash)) {
    return NextResponse.json({ error: "Wrong PIN." }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true, player: { id: player.id, name: player.name } });
  res.cookies.set(COOKIE, makeToken(player.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 120,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
