import { isTestEmail } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { AddAdmin, RemoveAdmin, RemoveTests } from "./TeamForms";

export default async function AdminTeam() {
  const me = await requireAdmin();
  const [admins, emails] = await Promise.all([
    db.user.findMany({ where: { role: "admin" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, lastName: true, email: true } }),
    db.user.findMany({ select: { email: true } }),
  ]);
  const tests = emails.filter((u) => isTestEmail(u.email)).length;
  return (
    <div style={{ maxWidth: 820 }}>
      <h1 className="title">Team</h1>
      <div className="accent" />
      <p className="muted">
        Admins see this Admin area: every member, their progress and files, and can reset passwords or turn accounts off. They can also use
        the Command Center like any member.
      </p>
      <div className="card" style={{ marginBottom: 18 }}>
        <h3>Admins</h3>
        <table className="versions">
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td><strong>{[a.name, a.lastName].filter(Boolean).join(" ")}</strong> <span className="muted small">{a.email}</span></td>
                <td style={{ textAlign: "right" }}>{a.id === me.id ? <span className="badge">You</span> : <RemoveAdmin email={a.email} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginBottom: 18 }}>
        <h3>Add an admin</h3>
        <p className="muted small">
          They need a Command Center account first: sign up with the member code, then enter that email here. Admins can only be added
          from this page, never at sign-up, because sign-up doesn't check that someone owns the email they type.
        </p>
        <AddAdmin />
      </div>
      <div className="card">
        <h3>Test accounts</h3>
        <p className="muted small">
          Accounts on test email addresses (anything @example.com, which is what our automated checks use). There {tests === 1 ? "is" : "are"}{" "}
          <strong>{tests}</strong> right now. They're left out of the Overview numbers either way.
        </p>
        <RemoveTests count={tests} />
      </div>
    </div>
  );
}
