import { NextResponse } from "next/server";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { nowIso, run } from "@/lib/db";
import { playerCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Creates exactly one account: the first one, on a database with none yet.
 * Excluded from the login gate in middleware.ts for the same reason
 * /api/auth is — nobody can be signed in before an account exists to sign
 * in as. Self-closing: the moment a single player row exists, this 403s
 * forever, and every account after the first goes through the normal
 * (authenticated) POST /api/players instead.
 */
export async function POST(req: Request) {
  if (playerCount() > 0) {
    return NextResponse.json({ error: "Setup has already been completed." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const username = String(body?.username ?? "").trim();
  const password = String(body?.password ?? "");

  if (!name) return NextResponse.json({ error: "A name is required." }, { status: 400 });
  if (!username) return NextResponse.json({ error: "A username is required." }, { status: 400 });
  if (password.length < 8)
    return NextResponse.json({ error: "Password needs to be at least 8 characters." }, { status: 400 });

  try {
    const res = run(
      `INSERT INTO players (name, emoji, color, username, password_hash, join_date)
       VALUES (?, '🎲', '#8b5cf6', ?, ?, ?)`,
      name,
      username,
      hashPassword(password),
      nowIso(),
    );
    const id = Number(res.lastInsertRowid);
    await setSessionCookie(id);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not create the account." }, { status: 400 });
  }
}
