"use client";

import { useState } from "react";
import { LoginForm } from "./LoginForm";
import { PasswordResetForm } from "./PasswordResetForm";
import { SignupForm } from "./SignupForm";

type Mode = "login" | "signup" | "reset";

export function LoginOrSignup({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("login");

  if (mode === "reset") {
    return <PasswordResetForm onDone={() => setMode("login")} />;
  }

  if (mode === "signup") {
    return (
      <>
        <SignupForm onSubmitted={() => {}} />
        <p className="mt-4 text-center text-xs text-mist-400">
          Already have an account?{" "}
          <button
            type="button"
            className="font-semibold text-grape-300"
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
        </p>
      </>
    );
  }

  return (
    <>
      <LoginForm next={next} />
      <p className="mt-4 flex justify-center gap-3 text-center text-xs text-mist-400">
        <button type="button" className="font-semibold text-grape-300" onClick={() => setMode("reset")}>
          Forgot password?
        </button>
        <span className="text-mist-600">·</span>
        <span>
          Need an account?{" "}
          <button
            type="button"
            className="font-semibold text-grape-300"
            onClick={() => setMode("signup")}
          >
            Request one
          </button>
        </span>
      </p>
    </>
  );
}
