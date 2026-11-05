"use client";

import { useEffect } from "react";

// Shown instead of a blank "Application error" page when something on a page
// crashes in the browser. Reports the error so it reaches the server logs.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: location.pathname, message: error.message, digest: error.digest, stack: error.stack }),
    }).catch(() => {});
  }, [error]);
  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="eyebrow">Something went wrong on this page</div>
      <h3>Your work is saved.</h3>
      <p className="muted">
        Try again first. If it keeps happening, reload the page, and if that does not help, try a private window: some browser
        extensions interfere with the page.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn-primary" onClick={() => reset()}>Try again</button>
        <button className="btn-ghost" onClick={() => location.reload()}>Reload the page</button>
      </div>
    </div>
  );
}
