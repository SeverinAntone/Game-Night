import { NextResponse } from "next/server";
import { hashPin } from "@/lib/auth";
import { nowIso, run } from "@/lib/db";
import { getPlayers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getPlayers(true));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "A name is required." }, { status: 400 });

  try {
    const res = run(
      "INSERT INTO players (name, emoji, color, tagline, pin_hash, join_date) VALUES (?, ?, ?, ?, ?, ?)",
      name,
      String(body.emoji || "🎲").slice(0, 8),
      String(body.color || "#8b5cf6"),
      body.tagline ? String(body.tagline).slice(0, 120) : null,
      body.pin ? hashPin(String(body.pin)) : null,
      nowIso(),
    );
    return NextResponse.json({ id: Number(res.lastInsertRowid) }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("UNIQUE") ? "That name is taken." : "Could not add player.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
