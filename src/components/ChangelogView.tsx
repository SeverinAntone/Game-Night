"use client";

import { useState } from "react";
import Link from "next/link";
import { formatGameDate, formatGameTime } from "@/lib/dates";
import type { ChangelogEntry, ChangelogTargetType } from "@/lib/changelog";

const TARGET_HREF: Record<ChangelogTargetType, (id: number) => string> = {
  game: (id) => `/games/${id}`,
  session: (id) => `/session/${id}`,
  player: (id) => `/players/${id}`,
};

/**
 * Read-only, visible to every signed-in account regardless of role — the
 * accountability side of the airlock. Nothing here can be edited or
 * deleted from the app; that's enforced at the database level (see the
 * two triggers on `changelog` in schema.sql), not just by this view
 * happening not to offer a button for it.
 *
 * `liveTargets` (computed server-side in settings/page.tsx) is what tells
 * an entry's #id apart from a dead link — a game.delete or session.delete
 * entry points at something that, by definition, no longer exists.
 */
export function ChangelogView({
  entries,
  liveTargets,
}: {
  entries: ChangelogEntry[];
  liveTargets: Set<string>;
}) {
  const [open, setOpen] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="card p-4">
      <h2 className="section-title mb-3">Changelog</h2>
      {entries.length === 0 ? (
        <p className="text-xs text-mist-400">Nothing recorded yet.</p>
      ) : (
        <ul className="max-h-96 space-y-1 overflow-y-auto text-xs">
          {entries.map((e) => {
            const expandable = !!e.details;
            const isOpen = open.has(e.id);
            const hasTarget = !!e.target_type && e.target_id != null;
            const isLive = hasTarget && liveTargets.has(`${e.target_type}:${e.target_id}`);

            return (
              <li key={e.id} className="border-b border-white/5 pb-1.5">
                <div className="flex items-baseline gap-2">
                  <button
                    type="button"
                    onClick={() => expandable && toggle(e.id)}
                    className={`flex min-w-0 flex-1 items-baseline gap-2 text-left ${
                      expandable ? "cursor-pointer" : "cursor-default"
                    }`}
                  >
                    <span className="shrink-0 text-mist-400">
                      {formatGameDate(e.created_at)} {formatGameTime(e.created_at)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold text-mist-200">{e.actor_name}</span>{" "}
                      <span className="text-mist-300">{e.summary}</span>
                    </span>
                    {expandable && (
                      <span
                        className={`shrink-0 text-mist-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        aria-hidden
                      >
                        ▾
                      </span>
                    )}
                  </button>
                  {hasTarget &&
                    (isLive ? (
                      <Link
                        href={TARGET_HREF[e.target_type!](e.target_id!)}
                        className="chip shrink-0 px-1.5 py-0 text-[10px] text-grape-300 hover:bg-grape-500/15"
                      >
                        #{e.target_id}
                      </Link>
                    ) : (
                      <span
                        className="chip shrink-0 px-1.5 py-0 text-[10px] text-mist-500"
                        title="This record no longer exists"
                      >
                        #{e.target_id} · gone
                      </span>
                    ))}
                </div>
                {expandable && isOpen && (
                  <pre className="mt-1.5 whitespace-pre-wrap rounded-lg bg-white/5 p-2 font-sans text-[11px] leading-relaxed text-mist-300">
                    {e.details}
                  </pre>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
