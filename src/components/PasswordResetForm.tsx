"use client";

import { useEffect, useRef, useState } from "react";

type Stage = "request" | "waiting" | "approved" | "done";

/**
 * Recovers access to an account with no working credential at all — old PIN
 * forgotten or never set, password forgotten, doesn't matter which. Starts
 * a request an owner/admin has to approve; the moment this tab's poll sees
 * that approval, it reveals the new-password fields right here, no
 * navigation needed. The claim token (returned once, at request time) is
 * what proves later requests — the poll, the finalize — come from the same
 * browser that asked; it's never sent anywhere except back to this app.
 */
export function PasswordResetForm({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState<Stage>("request");
  const [username, setUsername] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/password-reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setToken(data.token);
    setStage("waiting");

    pollRef.current = setInterval(async () => {
      const r = await fetch("/api/password-reset/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: data.token }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.status === "approved") {
        if (pollRef.current) clearInterval(pollRef.current);
        setStage("approved");
      } else if (d.status === "not_found") {
        if (pollRef.current) clearInterval(pollRef.current);
        setError("This request expired or was denied — you can ask again below.");
        setStage("request");
        setToken(null);
      }
    }, 4000);
  }

  async function submitNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/password-reset/finalize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password, password_confirm: passwordConfirm }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setStage("done");
    window.location.href = "/";
  }

  if (stage === "waiting") {
    return (
      <div className="card space-y-3 p-5 text-center">
        <p className="text-2xl">⏳</p>
        <p className="text-sm text-mist-300">
          Waiting for an owner or admin to approve this. Keep this tab open — you&apos;ll be
          asked to set a new password the moment they do.
        </p>
        <p className="text-[11px] text-mist-400">This request expires in 30 minutes.</p>
        <button
          type="button"
          className="text-xs font-semibold text-mist-400"
          onClick={() => {
            if (pollRef.current) clearInterval(pollRef.current);
            setStage("request");
            setToken(null);
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (stage === "approved" || stage === "done") {
    return (
      <form onSubmit={submitNewPassword} className="card space-y-4 p-5">
        <p className="text-sm text-mist-300">Approved — set a new password to finish signing in.</p>
        <div>
          <label className="label" htmlFor="reset-password">
            New password
          </label>
          <input
            id="reset-password"
            name="new-password"
            type="password"
            className="input"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            autoFocus
          />
          <p className="mt-1 text-[11px] text-mist-400">At least 8 characters.</p>
        </div>
        <div>
          <label className="label" htmlFor="reset-password-confirm">
            Confirm new password
          </label>
          <input
            id="reset-password-confirm"
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
          disabled={busy || password.length < 8 || password !== passwordConfirm}
        >
          {busy ? "…" : "Set password & sign in"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submitRequest} className="card space-y-4 p-5">
      <p className="text-xs text-mist-400">
        Forgot your password, or never set one? Enter your username and an owner or admin can
        approve getting you back in.
      </p>
      <div>
        <label className="label" htmlFor="reset-username">
          Username
        </label>
        <input
          id="reset-username"
          name="username"
          className="input"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
      </div>
      {error && <p className="text-sm text-rose-brand">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy || !username.trim()}>
        {busy ? "…" : "Request a reset"}
      </button>
      <button type="button" className="w-full text-center text-xs font-semibold text-mist-400" onClick={onDone}>
        ← Back to sign in
      </button>
    </form>
  );
}
