import ResetForm from "./ResetForm";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <main className="auth">
      <div className="card">
        <img src="/brand/lf_horizontal_bright_transparent.png" alt="Late Founders" style={{ height: 64, margin: "0 0 6px -12px" }} />
        <div className="eyebrow" style={{ marginBottom: 20 }}>Portal · Choose a new password</div>
        {token ? <ResetForm token={token} /> : <p>This link is missing its code. <a className="link" href="/login/forgot">Ask for a new link</a>.</p>}
        <p className="admin-switch"><a href="/login">← Back to log in</a></p>
      </div>
    </main>
  );
}
