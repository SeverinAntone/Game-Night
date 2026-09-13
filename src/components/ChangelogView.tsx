"use client";

import { useState } from "react";
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
            return (
              <li key={e.id} className="border-b border-white/5 pb-1.5">
                <button
                  type="button"
                  onClick={() => expandable && toggle(e.id)}
                  className={`flex w-full items-baseline gap-2 text-left ${
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
