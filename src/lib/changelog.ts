import { all, nowIso, run } from "./db";

export interface ChangelogEntry {
  id: number;
  actor_id: number | null;
  actor_name: string;
  action: string;
  summary: string;
  details: string | null;
  created_at: string;
}

/**
 * The only function anywhere in the app that writes to `changelog` — paired
 * with the immutable_update/immutable_delete triggers in schema.sql, that
 * makes this genuinely append-only rather than just append-only by
 * convention. `actorName` is stored alongside `actorId` (not just looked up
 * via the id) so an entry still reads sensibly after that player is deleted.
 *
 * `summary` is the one-line version always shown; `details` is optional
 * longer text (often multiple lines, one per changed field) shown behind
 * the entry's expand toggle in Settings — the "from what to what" for
 * anything more specific than the summary can carry on its own.
 */
export function logChange(
  actor: { id: number; name: string },
  action: string,
  summary: string,
  details?: string,
) {
  run(
    "INSERT INTO changelog (actor_id, actor_name, action, summary, details, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    actor.id,
    actor.name,
    action,
    summary,
    details ?? null,
    nowIso(),
  );
}

export const getChangelog = (limit = 200) =>
  all<ChangelogEntry>("SELECT * FROM changelog ORDER BY id DESC LIMIT ?", limit);
