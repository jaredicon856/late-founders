import Link from "next/link";

// Shown for any address that doesn't exist, in the app's own look.
export default function NotFound() {
  return (
    <main className="auth">
      <div className="card" style={{ textAlign: "center" }}>
        <img src="/brand/lf_horizontal_bright_transparent.png" alt="Late Founders" style={{ height: 48, marginBottom: 18 }} />
        <h2 style={{ margin: "0 0 8px" }}>That page isn't here</h2>
        <p className="muted">It may have been deleted or moved.</p>
        <Link className="btn-primary" href="/dashboard">Back to the Command Center</Link>
      </div>
    </main>
  );
}
