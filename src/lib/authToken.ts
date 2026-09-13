/**
 * Signed, self-contained session tokens.
 *
 * These are verified in `middleware.ts`, which Next.js runs on the Edge
 * runtime — no `better-sqlite3`, no `node:crypto`. So verification can't do a
 * database lookup and can't use Node-only APIs. Instead the token carries its
 * own expiry and is signed with HMAC via the Web Crypto API (`crypto.subtle`),
 * which is available identically in both the Edge runtime and Node 20 — no
 * import needed, no divergent implementations to keep in sync.
 *
 * The trade-off: because nothing is stored server-side, there's no way to
 * force-revoke one specific session before its natural expiry (e.g. a "log
 * out this device remotely" button). Logging out just clears the cookie on
 * that device. Sessions still expire on their own after 30 days either way.
 */

export interface SessionPayload {
  pid: number; // player id
  exp: number; // unix seconds
}

/**
 * Lives here (not in auth.ts) so middleware.ts can import just the cookie
 * name without pulling in auth.ts's node:crypto usage, which doesn't exist
 * on the Edge runtime middleware runs on.
 */
export const COOKIE = "bgn_session";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — see .env.example.`);
  return v;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

let keyPromise: Promise<CryptoKey> | null = null;
function hmacKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(must("AUTH_SECRET")),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }
  return keyPromise;
}

export const SESSION_DAYS = 30;

export async function makeSessionToken(playerId: number): Promise<string> {
  const payload: SessionPayload = {
    pid: playerId,
    exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60,
  };
  const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${toBase64Url(new Uint8Array(sig))}`;
}

/** Verifies signature and expiry. Returns the payload if valid, else null. */
export async function readSessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [payloadB64, sigB64] = token.split(".");
  if (!payloadB64 || !sigB64) return null;

  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      new Uint8Array(fromBase64Url(sigB64)),
      new TextEncoder().encode(payloadB64),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64))) as SessionPayload;
    if (typeof payload.pid !== "number" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
