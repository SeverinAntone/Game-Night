import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  currentPlayer,
  hashPassword,
  setSessionCookie,
  verifyPassword,
  verifyPin,
} from "@/lib/auth";
import { run } from "@/lib/db";
import { getPlayerRowByUsername } from "@/lib/queries";
import type { PlayerRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const player = await currentPlayer();
  return NextResponse.json({ player: player ? { id: player.id, name: player.name } : null });
}

function publicPlayer(p: PlayerRow) {
  return { id: p.id, name: p.name };
}

/**
 * Two sign-in paths live behind this one POST, distinguished by which fields
 * show up in the body — the login form on /login picks the right one based
 * on what the server tells it after the first attempt (see LoginForm.tsx):
 *
 *   { username, password }              normal sign-in
 *   { username, pin, new_password }     one-time migration for an account
 *                                        that only ever had a PIN
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  if (!username) return NextResponse.json({ error: "Username is required." }, { status: 400 });

  const player = getPlayerRowByUsername(username);
  // Same generic message either way — a real vs. unknown username shouldn't
  // be distinguishable from the response.
  const badCreds = () => NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });

  if (typeof body?.new_password === "string") {
    // --- Migration: prove the old PIN once, then set a real password. ---
    if (!player) return badCreds();
    if (player.password_hash) {
      return NextResponse.json(
        { error: "This account already has a password — sign in normally." },
        { status: 400 },
      );
    }
    const pin = String(body?.pin ?? "");
    if (!verifyPin(pin, player.pin_hash)) {
      return NextResponse.json({ error: "Incorrect PIN." }, { status: 403 });
    }
    const newPassword = String(body.new_password);
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password needs to be at least 8 characters." }, { status: 400 });
    }
    // pin_hash is cleared, not left around unused — it can't sign anyone in
    // anymore, so there's no reason to keep a working weak credential on file.
    run(
      "UPDATE players SET password_hash = ?, pin_hash = NULL WHERE id = ?",
      hashPassword(newPassword),
      player.id,
    );
    await setSessionCookie(player.id);
    return NextResponse.json({ ok: true, player: publicPlayer(player) });
  }

  // --- Normal sign-in ---
  const password = String(body?.password ?? "");
  if (!player) return badCreds();

  if (!player.password_hash) {
    // Account predates real passwords — tell the client to switch to the
    // migration flow instead of quietly failing a password check that was
    // never going to succeed.
    return NextResponse.json({ error: "needs_migration", needsMigration: true }, { status: 409 });
  }

  if (!verifyPassword(password, player.password_hash)) return badCreds();

  await setSessionCookie(player.id);
  return NextResponse.json({ ok: true, player: publicPlayer(player) });
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
