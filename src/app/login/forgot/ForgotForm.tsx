"use client";

import { useActionState } from "react";
import { requestReset, type ForgotState } from "../actions";

export default function ForgotForm() {
  const [state, action, busy] = useActionState<ForgotState, FormData>(requestReset, {});
  if (state.done)
    return <p>If that email has a Portal account, we've sent it a link to choose a new password. It works for one hour. Check your spam folder if it doesn't arrive in a few minutes.</p>;
  return (
    <form action={action}>
      <p className="muted">Enter the email you log in with and we'll send you a link to choose a new password.</p>
      <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>
      {state.error && <p className="err">{state.error}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send me a link"}</button>
    </form>
  );
}
