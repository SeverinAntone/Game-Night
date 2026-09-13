import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/apiAuth";
import { all, pruneExpiredSignupRequests } from "@/lib/db";

export const dynamic = "force-dynamic";

interface SignupRequestRow {
  id: number;
  name: string;
  username: string;
  requested_at: string;
  expires_at: string;
}

/** Never includes password_hash — nobody needs it client-side, ever. */
export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;

  pruneExpiredSignupRequests();
  const requests = all<SignupRequestRow>(
    "SELECT id, name, username, requested_at, expires_at FROM signup_requests ORDER BY id ASC",
  );
  return NextResponse.json(requests);
}
