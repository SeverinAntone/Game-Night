import { NextResponse } from "next/server";
import { currentPlayer, hashPassword, verifyPassword } from "@/lib/auth";
import { logChange } from "@/lib/changelog";
import { run } from "@/lib/db";
import { getPlayer, getPlayerRow } from "@/lib/queries";
import { canManage } from "@/lib/roles";
import { requireStaff } from "@/lib/apiAuth";

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

  // Disabled accounts are read-only, with one carve-out: they can still
  // change their own password (account hygiene, not "using the app").
  if (signedIn.role === "disabled") {
    const otherFields = ["name", "emoji", "color", "tagline", "active"].some((k) => k in body);
    if (otherFields)
      return NextResponse.json(
        { error: "This account is view-only — you can still change your password." },
        { status: 403 },
      );
  }

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
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { player: actor } = auth;

  const id = Number((await params).id);
  const target = getPlayer(id);
  if (!target) return NextResponse.json({ error: "No such player." }, { status: 404 });

  if (!canManage(actor.id, actor.role, target.id, target.role))
    return NextResponse.json({ error: "You can't remove this account." }, { status: 403 });

  // Soft delete only — hard-deleting a player would rewrite everyone's history.
  run("UPDATE players SET active = 0 WHERE id = ?", id);
  logChange(actor, "player.remove", `Removed ${target.name} from the roster`);
  return NextResponse.json({ ok: true });
}
