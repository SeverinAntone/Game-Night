import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/apiAuth";
import { logChange } from "@/lib/changelog";
import { get, nowIso, pruneExpiredSignupRequests, run } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

interface PendingRow {
  id: number;
  name: string;
  username: string;
  password_hash: string;
}

/** Body: { action: "approve" | "deny" }. Owner/admin only. */
export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const { player: actor } = auth;

  pruneExpiredSignupRequests();

  const id = Number((await params).id);
  const pending = get<PendingRow>("SELECT * FROM signup_requests WHERE id = ?", id);
  if (!pending)
    return NextResponse.json({ error: "That request no longer exists — it may have expired." }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  if (body.action === "approve") {
    let newId: number;
    try {
      const res = run(
        `INSERT INTO players (name, username, password_hash, role, join_date)
         VALUES (?, ?, ?, 'standard', ?)`,
        pending.name,
        pending.username,
        pending.password_hash,
        nowIso(),
      );
      newId = Number(res.lastInsertRowid);
    } catch {
      return NextResponse.json({ error: "That username was taken in the meantime." }, { status: 400 });
    }
    run("DELETE FROM signup_requests WHERE id = ?", id);
    logChange(actor, "signup.approve", `Approved ${pending.username}'s account request`);
    return NextResponse.json({ ok: true, id: newId });
  }

  if (body.action === "deny") {
    run("DELETE FROM signup_requests WHERE id = ?", id);
    logChange(actor, "signup.deny", `Denied ${pending.username}'s account request`);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
