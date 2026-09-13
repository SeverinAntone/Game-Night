"use client";

import { useState } from "react";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";

export function LoginOrSignup({ next }: { next: string }) {
  const [mode, setMode] = useState<"login" | "signup">("login");

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
      <p className="mt-4 text-center text-xs text-mist-400">
        Need an account?{" "}
        <button
          type="button"
          className="font-semibold text-grape-300"
          onClick={() => setMode("signup")}
        >
          Request one
        </button>
      </p>
    </>
  );
}
