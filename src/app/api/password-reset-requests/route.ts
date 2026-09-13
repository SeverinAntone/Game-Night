import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/apiAuth";
import { all, pruneExpiredResetRequests } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ResetRequestRow {
  id: number;
  player_id: number;
  name: string;
  username: string;
  requested_at: string;
  expires_at: string;
  approved_at: string | null;
}

/** Never includes the token or its hash — nobody needs either client-side. */
export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  pruneExpiredResetRequests();
  const requests = all<ResetRequestRow>(
    `SELECT r.id, r.player_id, p.name, p.username, r.requested_at, r.expires_at, r.approved_at
       FROM password_reset_requests r JOIN players p ON p.id = r.player_id
      ORDER BY r.id ASC`,
  );
  return NextResponse.json(requests);
}
