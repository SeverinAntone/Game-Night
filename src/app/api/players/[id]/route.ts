import { NextResponse } from "next/server";
import { currentPlayer, hashPassword, verifyPassword } from "@/lib/auth";
import { run } from "@/lib/db";
import { getPlayerRow } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const player = getPlayerRow(id);
  if (!player) return NextResponse.json({ error: "No such player." }, { status: 404 });

  // Every request already reached here signed in as someone (middleware.ts
  // guarantees that) — editing a profile just requires being that person.
  const signedIn = await currentPlayer();
  if (signedIn?.id !== id)
    return NextResponse.json({ error: "You can only edit your own profile." }, { status: 403 });

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

  if (typeof body.password === "string" && body.password) {
    if (!verifyPassword(String(body.current_password ?? ""), player.password_hash))
      return NextResponse.json({ error: "Current password is wrong." }, { status: 403 });
    if (body.password.length < 8)
      return NextResponse.json({ error: "New password needs to be at least 8 characters." }, { status: 400 });
    set("password_hash", hashPassword(body.password));
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
