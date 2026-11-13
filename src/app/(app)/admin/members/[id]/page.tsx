import Link from "next/link";
import { notFound } from "next/navigation";
import { COURSES, FOUNDER_TYPE_COPY, courseLabel, getAsset } from "@/content/catalog";
import { asNumber, money } from "@/content/profile";
import { TOTAL_TOOLS, day, isTestEmail, when } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/record";
import { setDisabled } from "../../actions";
import ResetPassword from "./ResetPassword";
import EmailLink from "./EmailLink";
import { emailConfigured } from "@/lib/email";

const DAY = 86_400_000;

export default async function AdminMember({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) notFound();
  const [profile, states, versions, today, month, byTool] = await Promise.all([
    getProfile(id),
    db.assetState.findMany({ where: { userId: id }, select: { assetId: true, status: true, updatedAt: true } }),
    db.assetVersion.findMany({ where: { userId: id }, orderBy: { version: "desc" }, select: { assetId: true, version: true, createdAt: true } }),
    db.message.count({ where: { userId: id, role: "user", hidden: false, createdAt: { gte: new Date(Date.now() - DAY) } } }),
    db.message.count({ where: { userId: id, role: "user", hidden: false, createdAt: { gte: new Date(Date.now() - 30 * DAY) } } }),
    db.message.groupBy({ by: ["assetId"], where: { userId: id, role: "user", hidden: false }, _count: { _all: true } }),
  ]);
  const name = [user.name, user.lastName].filter(Boolean).join(" ") || user.email;
  const initials = name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const stateOf = new Map(states.map((s) => [s.assetId, s]));
  const latestOf = new Map<string, (typeof versions)[number]>();
  const versionCount = new Map<string, number>();
  for (const v of versions) {
    if (!latestOf.has(v.assetId)) latestOf.set(v.assetId, v);
    versionCount.set(v.assetId, (versionCount.get(v.assetId) ?? 0) + 1);
  }
  const done = states.filter((s) => s.status === "complete" && getAsset(s.assetId)).length;
  const pct = Math.round((done / TOTAL_TOOLS) * 100);
  const type = typeof profile.founder_type === "string" ? profile.founder_type : "";
  const freedom = asNumber(profile.freedom_number);
  const target = typeof profile.ninety_day_target === "string" ? profile.ninety_day_target : "";
  const moves = Array.isArray(profile.first_five_moves) ? (profile.first_five_moves as string[]) : [];
  const movesDone = Array.isArray(profile.first_five_done) ? (profile.first_five_done as boolean[]) : [];
  const isMe = me.id === user.id;
  const file = (assetId: string, v: number, inline: boolean) => `/api/admin/members/${user.id}/export/${assetId}?format=pdf&v=${v}${inline ? "&inline=1" : ""}`;

  return (
    <>
      <p className="small" style={{ margin: "0 0 14px" }}><Link className="link" href="/admin/members">← All members</Link></p>

      <section className="card member-head">
        <span className="avatar big lf">{initials}</span>
        <div className="member-id">
          <h1>{name}</h1>
          <div className="muted">{user.email}</div>
          <div className="member-badges">
            {type && <span className="badge on">{type}</span>}
            {user.role === "admin" && <span className="badge">Admin</span>}
            {user.disabled && <span className="badge off">Turned off</span>}
            {isTestEmail(user.email) && <span className="badge">Test account</span>}
          </div>
        </div>
        <dl className="member-meta">
          <div><dt>Joined</dt><dd>{day(user.createdAt)}</dd></div>
          <div><dt>Last active</dt><dd>{when(user.lastSeenAt)}</dd></div>
        </dl>
      </section>

      <div className="kpi-grid" style={{ margin: "18px 0" }}>
        <div className="card kpi static">
          <span className="eyebrow">Progress</span>
          <span className="kpi-num">{done}<small> / {TOTAL_TOOLS} tools</small></span>
          <span className="bar"><span style={{ width: `${pct}%` }} /></span>
        </div>
        <div className="card kpi static">
          <span className="eyebrow">Freedom Number</span>
          <span className="kpi-num">{freedom ? <>{money(freedom)}<small>/mo</small></> : <span className="muted">Not set</span>}</span>
        </div>
        <div className="card kpi static">
          <span className="eyebrow">Assistant</span>
          <span className="kpi-num">{today}<small> today</small></span>
          <span className="muted small">{month} messages in 30 days</span>
        </div>
      </div>

      <div className="member-grid">
        <div>
          <div className="card">
            <div className="card-head"><h3>Progress by course</h3><span className="muted small">View opens the PDF in your browser</span></div>
            {COURSES.map((c) => {
              const cDone = c.assets.filter((a) => stateOf.get(a)?.status === "complete").length;
              const started = c.assets.some((a) => stateOf.has(a));
              return (
                <details key={c.number} className="course-progress" open={started}>
                  <summary>
                    <span className="cp-name">{courseLabel(c.number)} · {c.title}</span>
                    <span className="bar"><span style={{ width: `${Math.round((cDone / c.assets.length) * 100)}%` }} /></span>
                    <span className="muted small cp-pct">{cDone}/{c.assets.length}</span>
                  </summary>
                  {c.assets.map((a) => {
                    const s = stateOf.get(a);
                    const v = latestOf.get(a);
                    const used = byTool.find((t) => t.assetId === a)?._count._all ?? 0;
                    const status = s?.status === "complete" ? "complete" : s ? "progress" : "none";
                    return (
                      <div key={a} className="tool-row">
                        <span className={`status-dot ${status}`} />
                        <span className="tool-name">
                          {getAsset(a)?.title}
                          <span className="muted small">
                            {status === "complete" ? "Complete" : status === "progress" ? "In progress" : "Not started"}
                            {s ? ` · ${day(s.updatedAt)}` : ""}
                            {used ? ` · ${used} Assistant message${used === 1 ? "" : "s"}` : ""}
                            {v && (versionCount.get(a) ?? 0) > 1 ? ` · ${versionCount.get(a)} versions` : ""}
                          </span>
                        </span>
                        {v && (
                          <span className="tool-actions">
                            <a className="btn-ghost" href={file(a, v.version, true)} target="_blank" rel="noopener noreferrer">View</a>
                            <a className="btn-ghost" href={file(a, v.version, false)}>Download</a>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </details>
              );
            })}
          </div>
        </div>

        <aside>
          <div className="card" style={{ marginBottom: 18 }}>
            <h3>Diagnostic</h3>
            {!type ? <p className="muted small">Not done yet.</p> : (
              <>
                <p className="muted small" style={{ marginTop: 0 }}>{FOUNDER_TYPE_COPY[type]}</p>
                {target && (<><div className="lbl">90-day target</div><p style={{ margin: "4px 0 14px" }}>{target}</p></>)}
                {moves.length > 0 && (
                  <>
                    <div className="lbl">First five moves · {movesDone.filter(Boolean).length} of {moves.length} done</div>
                    <ol className="moves-mini">
                      {moves.map((m, i) => <li key={i} className={movesDone[i] ? "done" : ""}>{m}</li>)}
                    </ol>
                  </>
                )}
              </>
            )}
          </div>
          <div className="card">
            <h3>Account</h3>
            {isMe ? <p className="muted small">This is your own account. Change your password under Team.</p> : (
              <>
                {emailConfigured() && <EmailLink userId={user.id} />}
                <ResetPassword userId={user.id} />
                <form action={setDisabled} className="admin-action">
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="disabled" value={user.disabled ? "0" : "1"} />
                  <button className={user.disabled ? "btn-primary" : "btn-ghost btn-danger"}>{user.disabled ? "Turn account back on" : "Turn account off"}</button>
                </form>
                <p className="muted small" style={{ margin: 0 }}>
                  {user.disabled ? "They can't log in. Their work is kept." : "Turning off logs them out and stops them logging in. Their work is kept."}
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
