import Link from "next/link";
import { notFound } from "next/navigation";
import { COURSES, FOUNDER_TYPE_COPY, courseLabel, getAsset } from "@/content/catalog";
import { asNumber, money } from "@/content/profile";
import { day, isTestEmail, when } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/record";
import { setDisabled } from "../../actions";
import ResetPassword from "./ResetPassword";

const DAY = 86_400_000;
const STATUS: Record<string, string> = { complete: "Complete", in_progress: "In progress" };

export default async function AdminMember({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) notFound();
  const [profile, states, versions, today, month, byTool] = await Promise.all([
    getProfile(id),
    db.assetState.findMany({ where: { userId: id }, select: { assetId: true, status: true, updatedAt: true } }),
    db.assetVersion.findMany({ where: { userId: id }, orderBy: { version: "desc" }, select: { assetId: true, version: true, createdAt: true, label: true } }),
    db.message.count({ where: { userId: id, role: "user", hidden: false, createdAt: { gte: new Date(Date.now() - DAY) } } }),
    db.message.count({ where: { userId: id, role: "user", hidden: false, createdAt: { gte: new Date(Date.now() - 30 * DAY) } } }),
    db.message.groupBy({ by: ["assetId"], where: { userId: id, role: "user", hidden: false }, _count: { _all: true } }),
  ]);
  const name = [user.name, user.lastName].filter(Boolean).join(" ");
  const stateOf = new Map(states.map((s) => [s.assetId, s]));
  const latestOf = new Map<string, (typeof versions)[number]>();
  for (const v of versions) if (!latestOf.has(v.assetId)) latestOf.set(v.assetId, v);
  const type = typeof profile.founder_type === "string" ? profile.founder_type : "";
  const freedom = asNumber(profile.freedom_number);
  const moves = Array.isArray(profile.first_five_moves) ? (profile.first_five_moves as string[]) : [];
  const movesDone = Array.isArray(profile.first_five_done) ? (profile.first_five_done as boolean[]).filter(Boolean).length : 0;
  const isMe = me.id === user.id;

  return (
    <>
      <p className="small" style={{ margin: "0 0 6px" }}><Link className="link" href="/admin/members">← All members</Link></p>
      <h1 className="title">{name || user.email}</h1>
      <div className="accent" />
      <p className="muted" style={{ marginTop: -6 }}>
        {user.email} · joined {day(user.createdAt)} · last active {when(user.lastSeenAt)}
        {user.role === "admin" && <span className="badge">Admin</span>}
        {user.disabled && <span className="badge off">Turned off</span>}
        {isTestEmail(user.email) && <span className="badge">Test</span>}
      </p>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="eyebrow">Founder type</div>
          <div className="stat" style={{ fontSize: 26 }}>{type || <span className="muted">Not yet</span>}</div>
          {type && <p className="muted small">{FOUNDER_TYPE_COPY[type]}</p>}
        </div>
        <div className="card">
          <div className="eyebrow">Freedom Number</div>
          <div className="stat" style={{ fontSize: 26 }}>{freedom ? <>{money(freedom)}<small>/mo</small></> : <span className="muted">Not yet</span>}</div>
          {moves.length > 0 && <p className="muted small">First five moves: {movesDone} of {moves.length} ticked</p>}
        </div>
        <div className="card">
          <div className="eyebrow">Assistant use</div>
          <div className="stat" style={{ fontSize: 26 }}>{today}<small> today</small></div>
          <p className="muted small">{month} messages in the last 30 days</p>
        </div>
      </div>

      {typeof profile.ninety_day_target === "string" && profile.ninety_day_target && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="eyebrow">90-day target</div>
          <p style={{ margin: "6px 0 0" }}>{profile.ninety_day_target}</p>
        </div>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        <h3>Account</h3>
        {isMe ? <p className="muted small">This is your own account.</p> : (
          <>
            <ResetPassword userId={user.id} />
            <form action={setDisabled} className="admin-action">
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="disabled" value={user.disabled ? "0" : "1"} />
              <button className={user.disabled ? "btn-primary" : "btn-ghost btn-danger"}>{user.disabled ? "Turn account back on" : "Turn account off"}</button>
              <span className="muted small">
                {user.disabled ? "They can't log in. Their work is kept." : "Logs them out and stops them logging in. Their work is kept, and you can turn it back on."}
              </span>
            </form>
          </>
        )}
      </div>

      <div className="card">
        <h3>Progress and files</h3>
        {COURSES.map((c) => {
          const rows = c.assets.map((a) => getAsset(a)).filter((a): a is NonNullable<typeof a> => !!a);
          return (
            <div key={c.number} className="admin-course">
              <div className="lbl">{courseLabel(c.number)} · {c.title}</div>
              <table className="versions">
                <tbody>
                  {rows.map((a) => {
                    const s = stateOf.get(a.id);
                    const v = latestOf.get(a.id);
                    const used = byTool.find((t) => t.assetId === a.id)?._count._all ?? 0;
                    return (
                      <tr key={a.id}>
                        <td style={{ width: "40%" }}>{a.title}</td>
                        <td className={s?.status === "complete" ? "" : "muted"}>{STATUS[s?.status ?? ""] ?? "Not started"}</td>
                        <td className="muted small">{used ? `${used} Assistant message${used === 1 ? "" : "s"}` : ""}</td>
                        <td className="dl">
                          {v ? (
                            <>
                              <span className="muted small">v{v.version} · {day(v.createdAt)}</span>
                              <a className="link" href={`/api/admin/members/${user.id}/export/${a.id}?format=pdf&v=${v.version}`}>PDF</a>
                            </>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </>
  );
}
