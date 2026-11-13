"use client";

import { useActionState } from "react";
import { changeOwnPassword, removeTestAccounts, setAdmin, type TeamState } from "../actions";

export function ChangePassword() {
  const [state, action, pending] = useActionState<TeamState, FormData>(changeOwnPassword, {});
  return (
    <form action={action} className="admin-action">
      <input className="input" name="current" type="password" autoComplete="current-password" required placeholder="Current password" style={{ maxWidth: 220 }} />
      <input className="input" name="next" type="password" autoComplete="new-password" minLength={10} required placeholder="New password (10+ characters)" style={{ maxWidth: 260 }} />
      <button className="btn-primary" disabled={pending}>Change password</button>
      {state.ok && <span className="small" style={{ color: "var(--mint)" }}>{state.ok}</span>}
      {state.error && <span className="err">{state.error}</span>}
    </form>
  );
}

export function AddAdmin() {
  const [state, action, pending] = useActionState<TeamState, FormData>(setAdmin, {});
  return (
    <form action={action} className="admin-action">
      <input type="hidden" name="make" value="1" />
      <input className="input" name="email" type="email" required placeholder="Their Portal login email" style={{ maxWidth: 340 }} />
      <button className="btn-primary" disabled={pending}>Make admin</button>
      {state.ok && <span className="small" style={{ color: "var(--mint)" }}>{state.ok}</span>}
      {state.error && <span className="err">{state.error}</span>}
    </form>
  );
}

export function RemoveAdmin({ email }: { email: string }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(setAdmin, {});
  return (
    <form action={action}>
      <input type="hidden" name="make" value="0" />
      <input type="hidden" name="email" value={email} />
      <button className="btn-ghost btn-danger" disabled={pending}>Remove admin</button>
      {state.error && <span className="err"> {state.error}</span>}
    </form>
  );
}

export function RemoveTests({ count }: { count: number }) {
  const [state, action, pending] = useActionState<TeamState, FormData>(removeTestAccounts, {});
  return (
    <form
      action={action}
      className="admin-action"
      onSubmit={(e) => {
        if (!confirm(`Delete ${count} test account${count === 1 ? "" : "s"} and everything in them? This can't be undone.`)) e.preventDefault();
      }}
    >
      <button className="btn-ghost btn-danger" disabled={pending || count === 0}>Remove test accounts</button>
      {state.ok && <span className="small" style={{ color: "var(--mint)" }}>{state.ok}</span>}
    </form>
  );
}
