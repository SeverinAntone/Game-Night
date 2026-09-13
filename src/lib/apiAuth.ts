import { NextResponse } from "next/server";
import { currentPlayer } from "./auth";
import { canWrite, isStaff } from "./roles";
import type { Player } from "./types";

type Guarded = { player: Player } | { error: NextResponse };

/** Any signed-in account — middleware already guarantees this in practice, this is the typed accessor. */
export async function requireSignedIn(): Promise<Guarded> {
  const player = await currentPlayer();
  if (!player) return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  return { player };
}

/** Owner or admin only — for approving accounts, managing roles, deleting users. */
export async function requireStaff(): Promise<Guarded> {
  const signedIn = await requireSignedIn();
  if ("error" in signedIn) return signedIn;
  if (!isStaff(signedIn.player.role))
    return { error: NextResponse.json({ error: "Owners and admins only." }, { status: 403 }) };
  return signedIn;
}

/** Anyone except a Disabled account — for the routes that actually change data. */
export async function requireWriter(): Promise<Guarded> {
  const signedIn = await requireSignedIn();
  if ("error" in signedIn) return signedIn;
  if (!canWrite(signedIn.player.role))
    return { error: NextResponse.json({ error: "This account is view-only." }, { status: 403 }) };
  return signedIn;
}
