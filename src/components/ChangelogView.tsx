import { formatGameDate, formatGameTime } from "@/lib/dates";
import type { ChangelogEntry } from "@/lib/changelog";

/**
 * Read-only, visible to every signed-in account regardless of role — the
 * accountability side of the airlock. Nothing here can be edited or
 * deleted from the app; that's enforced at the database level (see the
 * two triggers on `changelog` in schema.sql), not just by this view
 * happening not to offer a button for it.
 */
export function ChangelogView({ entries }: { entries: ChangelogEntry[] }) {
  return (
    <section className="card p-4">
      <h2 className="section-title mb-3">Changelog</h2>
      {entries.length === 0 ? (
        <p className="text-xs text-mist-400">Nothing recorded yet.</p>
      ) : (
        <ul className="max-h-96 space-y-1.5 overflow-y-auto text-xs">
          {entries.map((e) => (
            <li key={e.id} className="flex items-baseline gap-2 border-b border-white/5 pb-1.5">
              <span className="shrink-0 text-mist-400">
                {formatGameDate(e.created_at)} {formatGameTime(e.created_at)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-mist-200">{e.actor_name}</span>{" "}
                <span className="text-mist-300">{e.summary}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
