import ForgotForm from "./ForgotForm";

export default function ForgotPage() {
  return (
    <main className="auth">
      <div className="card">
        <img src="/brand/lf_horizontal_bright_transparent.png" alt="Late Founders" style={{ height: 64, margin: "0 0 6px -12px" }} />
        <div className="eyebrow" style={{ marginBottom: 20 }}>Portal · Reset your password</div>
        <ForgotForm />
        <p className="admin-switch"><a href="/login">← Back to log in</a></p>
      </div>
    </main>
  );
}
