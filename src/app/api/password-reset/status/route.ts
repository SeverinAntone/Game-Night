import { NextResponse } from "next/server";
import { hashResetToken } from "@/lib/auth";
import { get, pruneExpiredResetRequests } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ResetRow {
  approved_at: string | null;
}

/**
 * What the requester's own browser polls after submitting a request — see
 * LoginOrSignup.tsx / PasswordResetForm.tsx. Takes the token in the POST
 * body rather than a URL/query param so it never ends up sitting in an
 * access log. "not_found" covers both "expired" and "denied" — from an
 * unauthenticated poller's point of view those need the same response
 * (start over), and there's no reason to reveal which one happened.
 */
export async function POST(req: Request) {
  pruneExpiredResetRequests();

  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "");
  if (!token) return NextResponse.json({ status: "not_found" });

  const row = get<ResetRow>(
    "SELECT approved_at FROM password_reset_requests WHERE token_hash = ?",
    hashResetToken(token),
  );
  if (!row) return NextResponse.json({ status: "not_found" });

  return NextResponse.json({ status: row.approved_at ? "approved" : "pending" });
}
