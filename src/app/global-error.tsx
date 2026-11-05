"use client";

import { useEffect } from "react";

// Last-resort crash screen when even the page frame fails to load.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: location.pathname, message: error.message, digest: error.digest, stack: error.stack }),
    }).catch(() => {});
  }, [error]);
  return (
    <html lang="en">
      <body style={{ background: "#0b0b0d", color: "#f5f6f3", fontFamily: "system-ui, sans-serif", padding: 32 }}>
        <h2>Something went wrong.</h2>
        <p>Your work is saved. Reload the page to carry on.</p>
        <button onClick={() => location.reload()} style={{ padding: "10px 18px", borderRadius: 999, border: 0, background: "#6dfed7", fontWeight: 700 }}>
          Reload
        </button>
      </body>
    </html>
  );
}
