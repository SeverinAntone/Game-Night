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
 * request-and-approve flow instead (see api/signup).
 *
 * This account is made the Owner directly, right here — not left to the
 * startup migration that promotes the earliest player on an *existing*
 * database, since that only runs once per boot and this insert happens
 * after it already ran (and found nobody to promote).
 */
export async function POST(req: Request) {
  if (playerCount() > 0) {
    return NextResponse.json({ error: "Setup has already been completed." }, { status: 403 });
  }

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

  try {
    const res = run(
      `INSERT INTO players (name, emoji, color, username, password_hash, role, join_date)
       VALUES (?, '🎲', '#8b5cf6', ?, ?, 'owner', ?)`,
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
