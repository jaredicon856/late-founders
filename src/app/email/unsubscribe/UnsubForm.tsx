"use client";

import { useActionState } from "react";
import { setUpdates, type UnsubState } from "./actions";

export default function UnsubForm({ u, t }: { u: string; t: string }) {
  const [state, action, busy] = useActionState<UnsubState, FormData>(setUpdates, {});
  const on = state.done === "off" ? "1" : "0";
  return (
    <form action={action}>
      <input type="hidden" name="u" value={u} />
      <input type="hidden" name="t" value={t} />
      <input type="hidden" name="on" value={on} />
      {state.done === "off" && <p>Done. You won't get Portal announcements, reminders or alerts by email. Password and login emails still reach you, and announcements stay on your bell in the Portal.</p>}
      {state.done === "on" && <p>Done. Portal updates by email are back on.</p>}
      {!state.done && <p>Stop getting Portal announcements, reminders and alerts by email? Password and login emails will still reach you.</p>}
      {state.error && <p className="err">{state.error}</p>}
      <button className={state.done === "off" ? "btn-ghost" : "btn-primary"} disabled={busy}>
        {busy ? "Saving…" : state.done === "off" ? "Turn updates back on" : state.done === "on" ? "Unsubscribe again" : "Unsubscribe"}
      </button>
    </form>
  );
}
