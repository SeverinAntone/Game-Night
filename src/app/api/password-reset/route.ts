import { NextResponse } from "next/server";
import { hashResetToken, makeResetToken } from "@/lib/auth";
import { get, nowIso, pruneExpiredResetRequests, RESET_TTL_MINUTES, run } from "@/lib/db";
import { getPlayerRowByUsername } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Starts a password-reset claim for an account that already exists —
 * deliberately does NOT create anything new (that's api/signup's job).
 * Unauthenticated by design: the whole point is recovering access when you
 * have no working credential at all. Excluded from the login gate in
 * middleware.ts, alongside /api/signup, for the same reason.
 */
export async function POST(req: Request) {
  pruneExpiredResetRequests();

  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  if (!username) return NextResponse.json({ error: "A username is required." }, { status: 400 });

  const player = getPlayerRowByUsername(username);
  if (!player || !player.active)
    return NextResponse.json({ error: "No active account with that username." }, { status: 404 });

  const existing = get(
    "SELECT id FROM password_reset_requests WHERE player_id = ?",
    player.id,
  );
  if (existing)
    return NextResponse.json(
      { error: "A reset request for this account is already pending." },
      { status: 400 },
    );

  const token = makeResetToken();
  const requestedAt = nowIso();
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000).toISOString();

  run(
    `INSERT INTO password_reset_requests (player_id, token_hash, requested_at, expires_at)
     VALUES (?, ?, ?, ?)`,
    player.id,
    hashResetToken(token),
    requestedAt,
    expiresAt,
  );

  // The one and only time this value exists outside the hash — never logged,
  // never stored, gone from the server's memory the moment this returns.
  return NextResponse.json({ token, expires_at: expiresAt }, { status: 201 });
}
