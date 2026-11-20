import UnsubForm from "./UnsubForm";

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ u?: string; t?: string }> }) {
  const { u = "", t = "" } = await searchParams;
  return (
    <main className="auth">
      <div className="card">
        <img src="/brand/lf_horizontal_bright_transparent.png" alt="Late Founders" style={{ height: 64, margin: "0 0 6px -12px" }} />
        <div className="eyebrow" style={{ marginBottom: 20 }}>Portal · Email updates</div>
        <UnsubForm u={u} t={t} />
        <p className="admin-switch"><a href="/login">Go to the Portal</a></p>
      </div>
    </main>
  );
}
