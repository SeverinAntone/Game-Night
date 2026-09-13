"use client";

import { useState } from "react";

/** Requests a new account. Doesn't sign anyone in — an owner or admin has to approve first. */
export function SignupForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, username, password, password_confirm: passwordConfirm }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setSubmitted(true);
    onSubmitted();
  }

  if (submitted) {
    return (
      <div className="card p-5 text-center">
        <p className="mb-2 text-2xl">📨</p>
        <p className="text-sm text-mist-300">
          Request sent. An owner or admin needs to approve it before you can sign in — it expires
          in 10 minutes if nobody does, so check back or ask in person.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div>
        <label className="label" htmlFor="signup-name">
          Your name
        </label>
        <input
          id="signup-name"
          name="name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <div>
        <label className="label" htmlFor="signup-username">
          Username
        </label>
        <input
          id="signup-username"
          name="username"
          className="input"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="signup-password">
          Password
        </label>
        <input
          id="signup-password"
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
      <div>
        <label className="label" htmlFor="signup-password-confirm">
          Confirm password
        </label>
        <input
          id="signup-password-confirm"
          name="new-password-confirm"
          type="password"
          className="input"
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
        />
        {passwordConfirm && password !== passwordConfirm && (
          <p className="mt-1 text-[11px] text-rose-brand">Passwords don&apos;t match.</p>
        )}
      </div>

      {error && <p className="text-sm text-rose-brand">{error}</p>}

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={
          busy ||
          !name.trim() ||
          !username.trim() ||
          password.length < 8 ||
          password !== passwordConfirm
        }
      >
        {busy ? "…" : "Request an account"}
      </button>
    </form>
  );
}
