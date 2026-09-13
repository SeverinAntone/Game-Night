"use client";

import { useEffect, useState } from "react";

type Mode = "password" | "migrate";

const REDIRECT_FLAG = "bgn_login_redirect_check";

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bounceWarning, setBounceWarning] = useState(false);

  // If we land back here right after a sign-in attempt that the server
  // accepted, the cookie never stuck in the browser — almost always because
  // this page loaded over plain http:// instead of https://, which means a
  // Secure cookie (required in production) can't be set at all. Most common
  // cause in practice: an old bookmark or "Add to Home Screen" icon still
  // pointing at a local network address from before login was required.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(REDIRECT_FLAG)) {
        sessionStorage.removeItem(REDIRECT_FLAG);
        setBounceWarning(true);
      }
    } catch {
      /* sessionStorage unavailable (e.g. private mode) — skip the check */
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setBounceWarning(false);

    const body =
      mode === "password"
        ? { username, password }
        : { username, pin, new_password: newPassword };

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      try {
        sessionStorage.setItem(REDIRECT_FLAG, "1");
      } catch {
        /* ignore — worst case we just skip the bounce-warning check */
      }
      // Full navigation, not router.push — makes sure the new session cookie
      // is what middleware sees on the very next request.
      window.location.href = next;
      return;
    }

    setBusy(false);

    if (res.status === 409 && data.needsMigration) {
      setMode("migrate");
      setPassword("");
      setError(null);
      return;
    }

    setError(data.error ?? "Something went wrong.");
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      {bounceWarning && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
          That sign-in was accepted, but your browser didn&apos;t stay signed in. This almost
          always means you&apos;re on an old bookmark or home-screen icon pointing at a
          local-network address instead of the real site address — signing in needs a secure
          (https://) connection. Try opening the site fresh from its real web address, then
          re-add it to your home screen from there if you use that.
        </p>
      )}

      <div>
        <label className="label" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          className="input"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
      </div>

      {mode === "password" ? (
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-mist-400">
            This account still has the old-style PIN. Enter it once to confirm it&apos;s you,
            then pick a password — you&apos;ll use that from now on.
          </p>
          <div>
            <label className="label" htmlFor="pin">
              Current PIN
            </label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              className="input"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            />
          </div>
          <div>
            <label className="label" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              name="new-password"
              type="password"
              className="input"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
            />
            <p className="mt-1 text-[11px] text-mist-400">At least 8 characters.</p>
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-mist-400"
            onClick={() => {
              setMode("password");
              setError(null);
            }}
          >
            ← Back to password sign-in
          </button>
        </div>
      )}

      {error && <p className="text-sm text-rose-brand">{error}</p>}

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={
          busy ||
          !username.trim() ||
          (mode === "password" ? !password : pin.length < 4 || newPassword.length < 8)
        }
      >
        {busy ? "…" : mode === "password" ? "Sign in" : "Set password & sign in"}
      </button>
    </form>
  );
}
