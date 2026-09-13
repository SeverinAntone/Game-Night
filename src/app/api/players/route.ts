import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { nowIso, run } from "@/lib/db";
import { getPlayers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getPlayers(true));
}

/**
 * New players get real accounts from the start — there's no PIN-then-upgrade
 * path for anyone created after the security update, only for the accounts
 * that already existed when it shipped (see app/api/auth/route.ts).
 */
export async function POST(req: Request) {
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
      `INSERT INTO players (name, emoji, color, tagline, username, password_hash, join_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      name,
      String(body.emoji || "🎲").slice(0, 8),
      String(body.color || "#8b5cf6"),
      body.tagline ? String(body.tagline).slice(0, 120) : null,
      username,
      hashPassword(password),
      nowIso(),
    );
    return NextResponse.json({ id: Number(res.lastInsertRowid) }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("players.username")
      ? "That username is taken."
      : e instanceof Error && e.message.includes("UNIQUE")
        ? "That name is taken."
        : "Could not add player.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
