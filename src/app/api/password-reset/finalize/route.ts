import { NextResponse } from "next/server";
import { hashPassword, hashResetToken, setSessionCookie } from "@/lib/auth";
import { logChange } from "@/lib/changelog";
import { get, pruneExpiredResetRequests, run } from "@/lib/db";
import { getPlayer } from "@/lib/queries";

export const dynamic = "force-dynamic";

interface ResetRow {
  id: number;
  player_id: number;
  approved_at: string | null;
}

/**
 * Completes an approved reset — the step the requester's screen reveals the
 * moment its poll sees "approved" (see PasswordResetForm.tsx). Requires the
 * original claim token AND an owner/admin having actually approved the row;
 * the token alone proves "this is the same browser that asked," not
 * "someone with authority signed off" — both have to be true.
 */
export async function POST(req: Request) {
  pruneExpiredResetRequests();

  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "");
  const password = String(body?.password ?? "");
  const passwordConfirm = String(body?.password_confirm ?? "");

  const row = get<ResetRow>(
    "SELECT id, player_id, approved_at FROM password_reset_requests WHERE token_hash = ?",
    hashResetToken(token),
  );
  if (!row)
    return NextResponse.json({ error: "This request has expired — ask for a new one." }, { status: 404 });
  if (!row.approved_at)
    return NextResponse.json({ error: "This request hasn't been approved yet." }, { status: 403 });

  if (password.length < 8)
    return NextResponse.json({ error: "Password needs to be at least 8 characters." }, { status: 400 });
  if (password !== passwordConfirm)
    return NextResponse.json({ error: "Passwords don't match." }, { status: 400 });

  const player = getPlayer(row.player_id);
  if (!player) {
    run("DELETE FROM password_reset_requests WHERE id = ?", row.id);
    return NextResponse.json({ error: "That account no longer exists." }, { status: 404 });
  }

  run("UPDATE players SET password_hash = ? WHERE id = ?", hashPassword(password), player.id);
  run("DELETE FROM password_reset_requests WHERE id = ?", row.id);
  logChange(player, "password.reset", `${player.name} finished a password reset`, undefined, {
    type: "player",
    id: player.id,
  });

  await setSessionCookie(player.id);
  return NextResponse.json({ ok: true, player: { id: player.id, name: player.name } });
}
