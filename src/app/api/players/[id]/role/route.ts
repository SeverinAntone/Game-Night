import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/apiAuth";
import { logChange } from "@/lib/changelog";
import { run } from "@/lib/db";
import { canGrantRole, canManage, ROLES } from "@/lib/roles";
import { getPlayer } from "@/lib/queries";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { player: actor } = auth;

  const targetId = Number((await params).id);
  const target = getPlayer(targetId);
  if (!target) return NextResponse.json({ error: "No such player." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const newRole = body.role as Role;
  if (!ROLES.includes(newRole))
    return NextResponse.json({ error: "Unknown role." }, { status: 400 });

  if (!canManage(actor.id, actor.role, target.id, target.role))
    return NextResponse.json(
      { error: "You can't change this account's role." },
      { status: 403 },
    );
  if (!canGrantRole(actor.role, newRole))
    return NextResponse.json({ error: "Only an owner can grant Owner." }, { status: 403 });

  run("UPDATE players SET role = ? WHERE id = ?", newRole, target.id);
  logChange(
    actor,
    "role.change",
    `Changed ${target.name}'s role from ${target.role} to ${newRole}`,
  );
  return NextResponse.json({ ok: true });
}
