import Link from "next/link";
import { getAsset } from "@/content/catalog";
import { TOTAL_TOOLS, day, memberRows, when } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";

export default async function AdminMembers({ searchParams }: { searchParams: Promise<{ q?: string; missing?: string; tests?: string }> }) {
  await requireAdmin();
  const { q = "", missing = "", tests = "" } = await searchParams;
  const missingAsset = missing ? getAsset(missing) : undefined;
  const needle = q.trim().toLowerCase();
  const rows = (await memberRows())
    .filter((r) => tests === "1" || !r.test)
    .filter((r) => !needle || r.name.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle))
    .filter((r) => !missingAsset || (r.role !== "admin" && !r.doneIds.has(missingAsset.id)));

  return (
    <>
      <h1 className="title">Members</h1>
      <div className="accent" />
      <form className="admin-search" action="/admin/members">
        <input className="input" name="q" defaultValue={q} placeholder="Search by name or email" />
        {missing && <input type="hidden" name="missing" value={missing} />}
        <label className="small muted"><input type="checkbox" name="tests" value="1" defaultChecked={tests === "1"} /> Show test accounts</label>
        <button className="btn-primary">Search</button>
        <a className="btn-ghost" href={`/api/admin/export${tests === "1" ? "?tests=1" : ""}`}>Download CSV</a>
      </form>
      {missingAsset && (
        <p className="shelf-note" style={{ margin: "0 0 16px" }}>
          Showing members who haven't completed <strong>{missingAsset.title}</strong>. <Link className="link" href="/admin/members">Show everyone</Link>
        </p>
      )}
      <div className="card">
        {rows.length === 0 ? <p className="muted">No members match.</p> : (
          <div className="tbl-wrap" style={{ border: 0 }}>
            <table className="versions">
              <thead>
                <tr><th>Name</th><th>Founder type</th><th>Joined</th><th>Last active</th><th>Tools done</th><th>Messages today</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link className="link" href={`/admin/members/${r.id}`}>{r.name || r.email}</Link>
                      {r.role === "admin" && <span className="badge">Admin</span>}
                      {r.disabled && <span className="badge off">Turned off</span>}
                      {r.test && <span className="badge">Test</span>}
                      <div className="muted small">{r.email}</div>
                    </td>
                    <td>{r.founderType || <span className="muted">Not yet</span>}</td>
                    <td className="muted">{day(r.createdAt)}</td>
                    <td className="muted">{when(r.lastSeenAt)}</td>
                    <td>{r.done} / {TOTAL_TOOLS}</td>
                    <td>{r.messagesToday}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>{rows.length} shown.</p>
    </>
  );
}
