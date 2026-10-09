"use client";

import { useActionState, useState } from "react";
import { login, signup, type AuthState } from "./actions";

export default function LoginForm({ needsCode, next }: { needsCode: boolean; next: string | null }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginState, loginAction, loggingIn] = useActionState<AuthState, FormData>(login, {});
  const [signupState, signupAction, signingUp] = useActionState<AuthState, FormData>(signup, {});
  const error = mode === "login" ? loginState.error : signupState.error;

  return (
    <>
      <div className="tabs">
        <button type="button" className={`pill ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>Log in</button>
        <button type="button" className={`pill ${mode === "signup" ? "active" : ""}`} onClick={() => setMode("signup")}>Create account</button>
      </div>
      {mode === "login" ? (
        <form action={loginAction}>
          {next && <input type="hidden" name="next" value={next} />}
          <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>
          <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required /></div>
          {error && <p className="err">{error}</p>}
          <button className="btn-primary" disabled={loggingIn}>{loggingIn ? "Logging in…" : "Log in"}</button>
        </form>
      ) : (
        <form action={signupAction}>
          {next && <input type="hidden" name="next" value={next} />}
          <div className="field"><label htmlFor="name">First name</label><input className="input" id="name" name="name" autoComplete="given-name" required /></div>
          <div className="field"><label htmlFor="email2">Email</label><input className="input" id="email2" name="email" type="email" autoComplete="email" required /></div>
          <div className="field"><label htmlFor="password2">Password</label><input className="input" id="password2" name="password" type="password" autoComplete="new-password" minLength={10} required /></div>
          {needsCode && (
            <div className="field"><label htmlFor="code">Member code</label><input className="input" id="code" name="code" required /><span className="hint">From the Start Here lesson in Skool.</span></div>
          )}
          {error && <p className="err">{error}</p>}
          <button className="btn-primary" disabled={signingUp}>{signingUp ? "Creating…" : "Create account"}</button>
        </form>
      )}
    </>
  );
}
