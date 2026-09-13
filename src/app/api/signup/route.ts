import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { nowIso, pruneExpiredSignupRequests, run, SIGNUP_TTL_MINUTES } from "@/lib/db";
import { get } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * The only path that creates a not-yet-real account (see api/players'
 * removal — this replaced it entirely). Unauthenticated by design: this is
 * exactly what the airlock is for. Excluded from the login gate in
 * middleware.ts alongside /api/auth and /api/setup.
 */
export async function POST(req: Request) {
  pruneExpiredSignupRequests();

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");
  const passwordConfirm = String(body?.password_confirm ?? "");

  if (!name) return NextResponse.json({ error: "A name is required." }, { status: 400 });
  if (!username) return NextResponse.json({ error: "A username is required." }, { status: 400 });
  if (password.length < 8)
    return NextResponse.json({ error: "Password needs to be at least 8 characters." }, { status: 400 });
  if (password !== passwordConfirm)
    return NextResponse.json({ error: "Passwords don't match." }, { status: 400 });

  const existingPlayer = get("SELECT id FROM players WHERE username = ? COLLATE NOCASE", username);
  const existingRequest = get(
    "SELECT id FROM signup_requests WHERE username = ? COLLATE NOCASE",
    username,
  );
  if (existingPlayer || existingRequest)
    return NextResponse.json({ error: "That username is taken or already requested." }, { status: 400 });

  const requestedAt = nowIso();
  const expiresAt = new Date(Date.now() + SIGNUP_TTL_MINUTES * 60_000).toISOString();

  try {
    run(
      `INSERT INTO signup_requests (name, username, password_hash, requested_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      name,
      username,
      hashPassword(password),
      requestedAt,
      expiresAt,
    );
  } catch {
    return NextResponse.json({ error: "That username is taken or already requested." }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
