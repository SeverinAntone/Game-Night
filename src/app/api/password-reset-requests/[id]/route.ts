import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/apiAuth";
import { logChange } from "@/lib/changelog";
import { get, nowIso, pruneExpiredResetRequests, run } from "@/lib/db";
import { getPlayer } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

interface ResetRow {
  id: number;
  player_id: number;
}

/** Body: { action: "approve" | "deny" }. Owner/admin only. */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { player: actor } = auth;

  pruneExpiredResetRequests();

  const id = Number((await params).id);
  const pending = get<ResetRow>("SELECT id, player_id FROM password_reset_requests WHERE id = ?", id);
  if (!pending)
    return NextResponse.json({ error: "That request no longer exists — it may have expired." }, { status: 404 });

  const target = getPlayer(pending.player_id);
  const body = await req.json().catch(() => ({}));

  if (body.action === "approve") {
    run("UPDATE password_reset_requests SET approved_at = ? WHERE id = ?", nowIso(), id);
    logChange(
      actor,
      "password.approve",
      `Approved a password reset for ${target?.name ?? "a player"}`,
      undefined,
      target ? { type: "player", id: target.id } : undefined,
    );
    return NextResponse.json({ ok: true });
  }

  if (body.action === "deny") {
    run("DELETE FROM password_reset_requests WHERE id = ?", id);
    logChange(
      actor,
      "password.deny",
      `Denied a password reset for ${target?.name ?? "a player"}`,
      undefined,
      target ? { type: "player", id: target.id } : undefined,
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
