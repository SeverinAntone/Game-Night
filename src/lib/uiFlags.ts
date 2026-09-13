/**
 * sessionStorage key set right before a successful login redirects away from
 * /login, and checked on /login's next mount — see LoginForm.tsx. If it's
 * still there when /login loads, the browser didn't keep the session cookie
 * from that redirect (almost always a plain-http:// access, see the banner
 * copy in LoginForm.tsx for why).
 *
 * Cleared as soon as any authenticated page actually renders (AppChrome),
 * not just when /login happens to check for it — otherwise a routine sign-out
 * later in the same tab reads as a leftover flag from the *original* login
 * and shows the same warning for no reason.
 */
export const LOGIN_REDIRECT_FLAG = "bgn_login_redirect_check";
