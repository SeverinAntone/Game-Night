import { all, nowIso, run } from "./db";

export type ChangelogTargetType = "game" | "session" | "player";

export interface ChangelogEntry {
  id: number;
  actor_id: number | null;
  actor_name: string;
  action: string;
  summary: string;
  details: string | null;
  target_type: ChangelogTargetType | null;
  target_id: number | null;
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
 * the entry's expand toggle in Settings. `target` is optional and, when
 * given, is what lets the Settings changelog show a stable #id and — if
 * the record still exists — a link straight to it, which is the difference
 * between "some session of Catan got edited" and "the one at /session/42."
 */
export function logChange(
  actor: { id: number; name: string },
  action: string,
  summary: string,
  details?: string,
  target?: { type: ChangelogTargetType; id: number },
) {
  run(
    `INSERT INTO changelog (actor_id, actor_name, action, summary, details, target_type, target_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    actor.id,
    actor.name,
    action,
    summary,
    details ?? null,
    target?.type ?? null,
    target?.id ?? null,
    nowIso(),
  );
}

export const getChangelog = (limit = 200) =>
  all<ChangelogEntry>("SELECT * FROM changelog ORDER BY id DESC LIMIT ?", limit);
