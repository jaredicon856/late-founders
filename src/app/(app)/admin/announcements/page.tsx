import ConfirmButton from "@/components/ConfirmButton";
import { when } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteNotice } from "../actions";
import { NewNotice } from "../MaterialForms";

export default async function AdminAnnouncements() {
  await requireAdmin();
  const notices = await db.notice.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <h1 className="title">Announcements</h1>
      <div className="accent" />
      <p className="muted">Posts go to every member's notification bell. Adding a course item or file with "Announce it" ticked posts here too.</p>
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card">
          <h3>New announcement</h3>
          <NewNotice />
        </div>
        <div className="card">
          <h3>Sent</h3>
          {notices.length === 0 ? <p className="muted">Nothing yet.</p> : (
            <div className="mat-list">
              {notices.map((n) => (
                <div key={n.id} className="mat-row">
                  <div className="mat-main">
                    <strong>{n.title}</strong>
                    {n.body && <div className="muted small" style={{ whiteSpace: "pre-wrap" }}>{n.body}</div>}
                    <div className="muted small">{when(n.createdAt)}{n.link ? ` · ${n.link}` : ""}</div>
                  </div>
                  <div className="mat-actions">
                    <form action={deleteNotice}>
                      <input type="hidden" name="id" value={n.id} />
                      <ConfirmButton className="btn-ghost btn-danger" message="Delete this announcement? It disappears from members' bells.">Delete</ConfirmButton>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
