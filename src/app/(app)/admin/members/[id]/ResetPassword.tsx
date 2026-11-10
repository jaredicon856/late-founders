"use client";

import { useActionState } from "react";
import { resetPassword, type ResetState } from "../../actions";

export default function ResetPassword({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, {});
  return (
    <form
      action={action}
      className="admin-action"
      onSubmit={(e) => {
        if (!confirm("Give this member a new password? They'll be logged out everywhere and need the new one to log back in.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <button className="btn-ghost" disabled={pending}>{pending ? "Resetting…" : "Reset password"}</button>
      {state.password && (
        <span className="small">
          New password: <code className="pw-code">{state.password}</code> · send it to them privately (Skool DM). It won't show again.
        </span>
      )}
      {state.error && <span className="err">{state.error}</span>}
    </form>
  );
}
