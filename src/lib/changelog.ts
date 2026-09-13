import { all, nowIso, run } from "./db";

export interface ChangelogEntry {
  id: number;
  actor_id: number | null;
  actor_name: string;
  action: string;
  summary: string;
  created_at: string;
}

/**
 * The only function anywhere in the app that writes to `changelog` — paired
 * with the immutable_update/immutable_delete triggers in schema.sql, that
 * makes this genuinely append-only rather than just append-only by
 * convention. `actorName` is stored alongside `actorId` (not just looked up
 * via the id) so an entry still reads sensibly after that player is deleted.
 */
export function logChange(
  actor: { id: number; name: string },
  action: string,
  summary: string,
) {
  run(
    "INSERT INTO changelog (actor_id, actor_name, action, summary, created_at) VALUES (?, ?, ?, ?, ?)",
    actor.id,
    actor.name,
    action,
    summary,
    nowIso(),
  );
}

export const getChangelog = (limit = 200) =>
  all<ChangelogEntry>("SELECT * FROM changelog ORDER BY id DESC LIMIT ?", limit);
