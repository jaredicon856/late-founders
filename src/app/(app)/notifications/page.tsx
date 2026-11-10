import Link from "next/link";
import { when } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { readNotices } from "@/lib/notices";

export const dynamic = "force-dynamic";

export default async function Notifications() {
  const user = await requireUser();
  const { notices, seenAt } = await readNotices(user.id);
  return (
    <>
      <div className="eyebrow">From the Late Founders team</div>
      <h1 className="title">Notifications</h1>
      <div className="accent" />
      {notices.length === 0 ? <div className="card"><p className="muted" style={{ margin: 0 }}>No announcements yet.</p></div> : (
        <div className="notice-list">
          {notices.map((n) => {
            const isNew = !seenAt || n.createdAt > seenAt;
            const inner = (
              <>
                <div className="notice-top">
                  <strong>{n.title}</strong>
                  {isNew && <span className="badge on">New</span>}
                </div>
                {n.body && <p style={{ whiteSpace: "pre-wrap" }}>{n.body}</p>}
                <span className="muted small">{when(n.createdAt)}{n.link ? " · Open →" : ""}</span>
              </>
            );
            return n.link ? (
              n.link.startsWith("/") ? (
                <Link key={n.id} href={n.link} className="card notice">{inner}</Link>
              ) : (
                <a key={n.id} href={n.link} target="_blank" rel="noopener noreferrer" className="card notice">{inner}</a>
              )
            ) : (
              <div key={n.id} className="card notice">{inner}</div>
            );
          })}
        </div>
      )}
    </>
  );
}
