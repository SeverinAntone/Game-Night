"use client";

import { useState } from "react";

/**
 * The link to hand round the table. Everyone on the wifi opens the same app —
 * there are no separate "admin" and "user" sites, so this is simply the
 * address of this machine on the LAN.
 */
export function ShareLink({ urls }: { urls: { label: string; url: string }[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard needs a secure context; a plain-http LAN origin may refuse.
      const field = document.createElement("textarea");
      field.value = url;
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopied(url);
    setTimeout(() => setCopied((c) => (c === url ? null : c)), 1800);
  }

  if (urls.length === 0)
    return (
      <p className="text-sm text-mist-400">
        No network address found — this machine may only be reachable as{" "}
        <code>localhost</code>. Check that it&apos;s on the wifi.
      </p>
    );

  return (
    <ul className="space-y-2">
      {urls.map((u) => (
        <li key={u.url} className="flex items-center gap-2">
          <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-950/70 px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
              {u.label}
            </div>
            <code className="block truncate text-sm text-mist-100">{u.url}</code>
          </div>
          <button className="btn-ghost shrink-0" onClick={() => copy(u.url)}>
            {copied === u.url ? "Copied ✓" : "Copy"}
          </button>
        </li>
      ))}
    </ul>
  );
}
