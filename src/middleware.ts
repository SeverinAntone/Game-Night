import { NextRequest, NextResponse } from "next/server";
import { COOKIE, readSessionToken } from "@/lib/authToken";

/**
 * The whole point of moving to real accounts: nothing is reachable without a
 * valid session. This runs before every request except the ones listed in
 * `config.matcher` below (the login page itself, the auth API it calls, and
 * static assets — see the "excluded" comment there for why each is safe to
 * skip).
 *
 * Runs on the Edge runtime, so it can only use `readSessionToken` (Web
 * Crypto, no database) — never `better-sqlite3` or `node:crypto` directly.
 */
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  const session = await readSessionToken(token);
  if (session) return NextResponse.next();

  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Everything EXCEPT:
     *  - /login              the sign-in page itself
     *  - /api/auth           login / migrate-password / logout / who-am-i —
     *                        has to work before a session exists
     *  - /api/setup          creates the very first account on an empty
     *                        database — see api/setup/route.ts for why this
     *                        is safe to leave open (it self-closes)
     *  - /api/signup         requests a new account — unauthenticated by
     *                        design, this is the airlock itself
     *                        (note: this is /api/signup exactly — the
     *                        (?!-) below stops it from also matching
     *                        /api/signup-requests, which is staff-only and
     *                        must stay behind the gate)
     *  - /_next/*            Next.js's own build assets
     *  - known public files  manifest + icons referenced directly by the
     *                        browser/PWA install flow, not app pages
     */
    "/((?!login|api/auth|api/setup|api/signup(?!-)|_next/static|_next/image|favicon.ico|manifest\\.webmanifest|icon\\.svg|icon-192\\.png|icon-512\\.png).*)",
  ],
};
