"use client";

import { useActionState } from "react";
import { emailLoginLink, type LinkState } from "../../actions";

export default function EmailLink({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(emailLoginLink, {});
  return (
    <form action={action} className="admin-action">
      <input type="hidden" name="userId" value={userId} />
      <button className="btn-ghost" disabled={pending}>{pending ? "Sending…" : "Email a login link"}</button>
      {state.sent && <span className="small">{state.sent}</span>}
      {state.error && <span className="err">{state.error}</span>}
    </form>
  );
}
