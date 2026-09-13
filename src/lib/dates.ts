/**
 * Every date this app stores (`played_at`, `created_at`, ...) is UTC, which is
 * correct for storage but wrong to *display* or *group by* without deciding
 * whose calendar day it falls on.
 *
 * This used to work by accident: the app ran on one laptop, so "the server's
 * local timezone" and "everyone's actual timezone" were the same thing, and
 * `new Date(iso).toLocaleDateString()` — evaluated wherever it happened to run
 * — landed on the right day either way. Now the server runs in a Docker
 * container (which defaults to UTC) while the people looking at the site are
 * in their own timezone, so "wherever this happens to run" no longer gives a
 * consistent answer — the exact bug behind sessions showing up a day early on
 * the History tab.
 *
 * The fix is to stop asking "what timezone is this code running in?" and
 * always pick one, explicitly, everywhere a date is grouped or shown. A game
 * night is a shared, real-world event for the whole household, so one fixed
 * timezone for the whole app is the right model — not each viewer's own
 * device, which would make the same session show a different date to
 * different people.
 */

const APP_TZ = process.env.APP_TIMEZONE || "America/Los_Angeles";

/** "2026-09-11" — the calendar day `iso` falls on in the app's timezone. */
export function gameDayKey(iso: string | number): string {
  // en-CA formats as YYYY-MM-DD, which is what every caller wants as a key.
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ }).format(new Date(iso));
}

/** "Sep 11, 2026" — for display. Always the app's timezone, never ambient. */
export function formatGameDate(iso: string | number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

/** "Friday, Sep 11" — the reveal screen's long form, same timezone as everywhere else. */
export function formatGameDateLong(iso: string | number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TZ,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

/** "9:34 PM" — for display, always the app's timezone. */
export function formatGameTime(iso: string | number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "Sep 26" — compact month/year, for chart axis labels in the app's timezone. */
export function formatMonthYear(iso: string | number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TZ,
    month: "short",
    year: "2-digit",
  }).format(new Date(iso));
}
