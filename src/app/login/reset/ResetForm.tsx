"use client";

import { useActionState, useState } from "react";
import { completeReset, type ResetFormState } from "../actions";

export default function ResetForm({ token }: { token: string }) {
  const [state, action, busy] = useActionState<ResetFormState, FormData>(completeReset, {});
  const [shown, setShown] = useState(false);
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <div className="field">
        <label htmlFor="password">New password</label>
        <div className="pw">
          <input className="input" id="password" name="password" type={shown ? "text" : "password"} autoComplete="new-password" minLength={10} required />
          <button type="button" className="pw-toggle" onClick={() => setShown((v) => !v)} aria-pressed={shown}>{shown ? "Hide" : "Show"}</button>
        </div>
        <span className="hint">At least 10 characters.</span>
      </div>
      {state.error && <p className="err">{state.error} <a className="link" href="/login/forgot">Ask for a new link</a></p>}
      <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save and log in"}</button>
    </form>
  );
}
