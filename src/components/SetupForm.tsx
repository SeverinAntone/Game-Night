"use client";

import { useState } from "react";

/** Shown on /login only when the database has no players yet at all. */
export function SetupForm() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      window.location.href = "/";
      return;
    }
    setBusy(false);
    setError(data.error ?? "Something went wrong.");
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <p className="text-xs text-mist-400">
        Nobody&apos;s set up yet — create the first account. You can add everyone else once
        you&apos;re signed in.
      </p>
      <div>
        <label className="label" htmlFor="setup-name">
          Your name
        </label>
        <input id="setup-name" name="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="setup-username">
          Username
        </label>
        <input
          id="setup-username"
          name="username"
          className="input"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="setup-password">
          Password
        </label>
        <input
          id="setup-password"
          name="new-password"
          type="password"
          className="input"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
        />
        <p className="mt-1 text-[11px] text-mist-400">At least 8 characters.</p>
      </div>

      {error && <p className="text-sm text-rose-brand">{error}</p>}

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={busy || !name.trim() || !username.trim() || password.length < 8}
      >
        {busy ? "…" : "Create account & sign in"}
      </button>
    </form>
  );
}
