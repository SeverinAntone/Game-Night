import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getPlayer } from "./queries";
import { COOKIE, makeSessionToken, readSessionToken, SESSION_DAYS } from "./authToken";
import type { Player } from "./types";

/**
 * Real accounts (username + password), required to reach anything on the
 * site — see `middleware.ts` for where that's enforced. This replaced a
 * PIN-only scheme that made sense when the app only ever lived on one
 * trusted home network; it doesn't once the same app is reachable from the
 * open internet.
 *
 * `hashPin`/`verifyPin` stick around for exactly one purpose: letting
 * someone who set a PIN under the old scheme prove who they are *once*, so
 * they can set a real password. See the POST handler in
 * `app/api/auth/route.ts`.
 */

export { COOKIE };

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, hash: string | null): boolean {
  if (!hash) return false;
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const a = Buffer.from(key, "hex");
  const b = scryptSync(password, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Legacy PINs — migration bridge only. Nothing new is ever written here.
// ---------------------------------------------------------------------------

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pin, salt, 32).toString("hex")}`;
}

export function verifyPin(pin: string, hash: string | null): boolean {
  if (!hash) return false;
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const a = Buffer.from(key, "hex");
  const b = scryptSync(pin, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function setSessionCookie(playerId: number) {
  const jar = await cookies();
  jar.set(COOKIE, await makeSessionToken(playerId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Who is signed in on this device, if anyone. */
export async function currentPlayer(): Promise<Player | null> {
  const jar = await cookies();
  const payload = await readSessionToken(jar.get(COOKIE)?.value);
  return payload ? getPlayer(payload.pid) ?? null : null;
}
