"use client";

import { useActionState, useState } from "react";
import { login, signup, type AuthState } from "./actions";

// Password field with a Show/Hide toggle, so members can check what they typed.
function PasswordInput({ id, autoComplete, minLength }: { id: string; autoComplete: string; minLength?: number }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="pw">
      <input className="input" id={id} name="password" type={shown ? "text" : "password"} autoComplete={autoComplete} minLength={minLength} required />
      <button type="button" className="pw-toggle" onClick={() => setShown((v) => !v)} aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown}>
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  );
}

export default function LoginForm({ needsCode, next, adminOnly, emailOn }: { needsCode: boolean; next: string | null; adminOnly?: boolean; emailOn?: boolean }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginState, loginAction, loggingIn] = useActionState<AuthState, FormData>(login, {});
  const [signupState, signupAction, signingUp] = useActionState<AuthState, FormData>(signup, {});
  const error = mode === "login" ? loginState.error : signupState.error;

  return (
    <>
      {!adminOnly && <div className="tabs">
        <button type="button" className={`pill ${mode === "login" ? "active" : ""}`} onClick={() => setMode("login")}>Log in</button>
        <button type="button" className={`pill ${mode === "signup" ? "active" : ""}`} onClick={() => setMode("signup")}>Create account</button>
      </div>}
      {mode === "login" || adminOnly ? (
        <form action={loginAction}>
          {next && <input type="hidden" name="next" value={next} />}
          <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>
          <div className="field"><label htmlFor="password">Password</label><PasswordInput id="password" autoComplete="current-password" /></div>
          {error && <p className="err">{error}</p>}
          <button className="btn-primary" disabled={loggingIn}>{loggingIn ? "Logging in…" : "Log in"}</button>
          {emailOn && <p className="small" style={{ marginTop: 12 }}><a className="link" href="/login/forgot">Forgot your password?</a></p>}
        </form>
      ) : (
        <form action={signupAction}>
          {next && <input type="hidden" name="next" value={next} />}
          <div className="row-fields">
            <div className="field w-half"><label htmlFor="name">First name</label><input className="input" id="name" name="name" autoComplete="given-name" required /></div>
            <div className="field w-half"><label htmlFor="lastName">Last name</label><input className="input" id="lastName" name="lastName" autoComplete="family-name" required /></div>
          </div>
          <div className="field"><label htmlFor="email2">Email</label><input className="input" id="email2" name="email" type="email" autoComplete="email" required /></div>
          <div className="field"><label htmlFor="password2">Password</label><PasswordInput id="password2" autoComplete="new-password" minLength={10} /><span className="hint">At least 10 characters.</span></div>
          {needsCode && (
            <div className="field"><label htmlFor="code">Member code</label><input className="input" id="code" name="code" required /><span className="hint">From the Homeroom welcome in Skool.</span></div>
          )}
          {error && <p className="err">{error}</p>}
          <button className="btn-primary" disabled={signingUp}>{signingUp ? "Creating…" : "Create account"}</button>
        </form>
      )}
    </>
  );
}
