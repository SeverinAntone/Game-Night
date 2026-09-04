import { NextResponse } from "next/server";
import { currentPlayer, hashPin, verifyPin } from "@/lib/auth";
import { run } from "@/lib/db";
import { getPlayerRow } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const player = getPlayerRow(id);
  if (!player) return NextResponse.json({ error: "No such player." }, { status: 404 });

  // Editing a profile is a personal action: it needs the PIN identity (§7).
  // Players who have not set a PIN yet are open to anyone on the LAN — which is
  // the point of "no auth on a trusted home network".
  const signedIn = await currentPlayer();
  if (player.pin_hash && signedIn?.id !== id)
    return NextResponse.json({ error: "Sign in as this player first." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const fields: string[] = [];
  const values: unknown[] = [];

  const set = (col: string, val: unknown) => {
    fields.push(`${col} = ?`);
    values.push(val);
  };

  if (typeof body.name === "string" && body.name.trim()) set("name", body.name.trim());
  if (typeof body.emoji === "string") set("emoji", body.emoji.slice(0, 8));
  if (typeof body.color === "string") set("color", body.color);
  if (typeof body.tagline === "string") set("tagline", body.tagline.slice(0, 120) || null);
  if (typeof body.active === "boolean") set("active", body.active ? 1 : 0);

  if (typeof body.pin === "string" && body.pin) {
    if (player.pin_hash && !verifyPin(String(body.current_pin ?? ""), player.pin_hash))
      return NextResponse.json({ error: "Current PIN is wrong." }, { status: 403 });
    set("pin_hash", hashPin(body.pin));
  }

  if (!fields.length) return NextResponse.json({ ok: true });

  try {
    run(`UPDATE players SET ${fields.join(", ")} WHERE id = ?`, ...values, id);
  } catch {
    return NextResponse.json({ error: "That name is taken." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  // Soft delete only — hard-deleting a player would rewrite everyone's history.
  const id = Number((await params).id);
  run("UPDATE players SET active = 0 WHERE id = ?", id);
  return NextResponse.json({ ok: true });
}
