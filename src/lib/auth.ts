import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { get, run } from "./db";
import { getPlayer } from "./queries";
import type { Player } from "./types";

/**
 * Deliberately lightweight identity (design doc §7). The app lives on a trusted
 * home network and needs no login to *log a session*; a name + PIN only gates
 * personal actions (your own Game Draft, editing your own profile).
 */

export const COOKIE = "bgn_player";

function secret(): string {
  const row = get<{ value: string }>("SELECT value FROM meta WHERE key = 'cookie_secret'");
  if (row?.value) return row.value;
  const s = randomBytes(32).toString("hex");
  run("INSERT OR REPLACE INTO meta (key, value) VALUES ('cookie_secret', ?)", s);
  return s;
}

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

const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("hex").slice(0, 32);

export const makeToken = (playerId: number) => `${playerId}.${sign(String(playerId))}`;

export function readToken(token: string | undefined): number | null {
  if (!token) return null;
  const [id, sig] = token.split(".");
  if (!id || !sig) return null;
  return sign(id) === sig ? Number(id) : null;
}

/** Who is signed in on this device, if anyone. */
export async function currentPlayer(): Promise<Player | null> {
  const jar = await cookies();
  const id = readToken(jar.get(COOKIE)?.value);
  return id ? getPlayer(id) ?? null : null;
}
