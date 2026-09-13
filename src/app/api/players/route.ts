import { NextResponse } from "next/server";
import { getPlayers } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Read-only. Creating a player used to be a direct POST here; now the only
 * way in is the sign-up request on /login, approved by an owner or admin —
 * see api/signup and api/signup-requests. Nothing constructs a new player
 * row anywhere else in the app.
 */
export async function GET() {
  return NextResponse.json(getPlayers(true));
}
