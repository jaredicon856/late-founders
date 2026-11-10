import Link from "next/link";
import { COURSES, courseLabel, getAsset } from "@/content/catalog";
import { TOTAL_TOOLS, day, memberRows, realMembers, when } from "@/lib/admin";
import { DEFAULT_DAILY_LIMIT, dailyLimit } from "@/lib/assistant/limit";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

const DAY = 86_400_000;

export default async function AdminOverview() {
  await requireAdmin();
  const all = await memberRows();
  const members = realMembers(all);
  const ids = members.map((m) => m.id);
  const week = Date.now() - 7 * DAY;
  const [latest, messagesToday] = await Promise.all([
    db.assetVersion.findMany({
      where: { userId: { in: ids } },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, assetId: true, version: true, createdAt: true, user: { select: { id: true, name: true, lastName: true } } },
    }),
    db.message.count({ where: { userId: { in: ids }, role: "user", hidden: false, createdAt: { gte: new Date(Date.now() - DAY) } } }),
  ]);

  const total = members.length;
  const newThisWeek = members.filter((m) => m.createdAt.getTime() > week).length;
  const activeThisWeek = members.filter((m) => m.lastSeenAt && m.lastSeenAt.getTime() > week).length;
  const diagnosed = members.filter((m) => m.founderType).length;
  const limit = dailyLimit();
  const nearCap = members.filter((m) => m.messagesToday >= limit * 0.8).length;
  const doneCells = members.reduce((a, m) => a + m.done, 0);
  const pct = total ? Math.round((doneCells / (total * TOTAL_TOOLS)) * 100) : 0;
  // Signed up more than two days ago and still no Diagnostic: the first nudge.
  const stuck = members.filter((m) => !m.founderType && m.createdAt.getTime() < Date.now() - 2 * DAY).slice(0, 8);
  const quiet = members.filter((m) => m.founderType && (!m.lastSeenAt || m.lastSeenAt.getTime() < Date.now() - 14 * DAY)).slice(0, 8);
  const testCount = all.filter((m) => m.test).length;

  return (
    <>
      <h1 className="title">Overview</h1>
      <div className="accent" />
      <p className="muted" style={{ marginTop: -6 }}>
        Members only: the team{testCount ? ` and ${testCount} test account${testCount === 1 ? "" : "s"}` : ""} are left out of these numbers.
      </p>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="eyebrow">Members</div>
          <div className="stat">{total}</div>
          <p className="muted small">{newThisWeek} joined in the last 7 days</p>
        </div>
        <div className="card">
          <div className="eyebrow">Active this week</div>
          <div className="stat">{activeThisWeek}<small> / {total}</small></div>
          <p className="muted small">Opened the Command Center in the last 7 days</p>
        </div>
        <div className="card">
          <div className="eyebrow">Diagnostic done</div>
          <div className="stat">{diagnosed}<small> / {total}</small></div>
          <p className="muted small">Everything else builds on it</p>
        </div>
        <div className="card">
          <div className="eyebrow">Overall progress</div>
          <div className="stat">{pct}<small>%</small></div>
          <div className="bar"><span style={{ width: `${pct}%` }} /></div>
          <p className="muted small">Of all {TOTAL_TOOLS} tools, across every member</p>
        </div>
        <div className="card">
          <div className="eyebrow">Assistant messages today</div>
          <div className="stat">{messagesToday}</div>
          <p className="muted small">Last 24 hours, all members</p>
        </div>
        <div className="card">
          <div className="eyebrow">Near the daily cap</div>
          <div className="stat">{nearCap}</div>
          <p className="muted small">Members at {Math.round(limit * 0.8)}+ of {limit} messages today{limit !== DEFAULT_DAILY_LIMIT ? " (custom limit)" : ""}</p>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18, alignItems: "start" }}>
        <div className="card">
          <h3>Needs a nudge</h3>
          <p className="muted small">Joined over two days ago and hasn't done the Diagnostic.</p>
          {stuck.length === 0 ? <p className="muted">Nobody.</p> : (
            <ul className="admin-list">
              {stuck.map((m) => (
                <li key={m.id}><Link className="link" href={`/admin/members/${m.id}`}>{m.name}</Link> <span className="muted small">joined {day(m.createdAt)}</span></li>
              ))}
            </ul>
          )}
          <h3 style={{ marginTop: 18 }}>Gone quiet</h3>
          <p className="muted small">Did the Diagnostic but hasn't been back in two weeks.</p>
          {quiet.length === 0 ? <p className="muted">Nobody.</p> : (
            <ul className="admin-list">
              {quiet.map((m) => (
                <li key={m.id}><Link className="link" href={`/admin/members/${m.id}`}>{m.name}</Link> <span className="muted small">last active {when(m.lastSeenAt)}</span></li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h3>New sign-ups</h3>
          {members.length === 0 ? <p className="muted">Nobody yet.</p> : (
            <ul className="admin-list">
              {members.slice(0, 10).map((m) => (
                <li key={m.id}>
                  <Link className="link" href={`/admin/members/${m.id}`}>{m.name}</Link>{" "}
                  <span className="muted small">{m.email} · {day(m.createdAt)}{m.founderType ? ` · ${m.founderType}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3>Progress by tool</h3>
        <p className="muted small">How many members have completed each tool. Click a tool to see who hasn't.</p>
        {COURSES.map((c) => (
          <div key={c.number} className="admin-course">
            <div className="lbl">{courseLabel(c.number)} · {c.title}</div>
            {c.assets.map((id) => {
              const a = getAsset(id);
              if (!a) return null;
              const n = members.filter((m) => m.doneIds.has(id)).length;
              const p = total ? Math.round((n / total) * 100) : 0;
              return (
                <Link key={id} href={`/admin/members?missing=${id}`} className="prow">
                  <span className="prow-top"><span>{a.title}</span><span className="muted small">{n} / {total}</span></span>
                  <span className="bar"><span style={{ width: `${p}%` }} /></span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Latest saved work</h3>
        {latest.length === 0 ? <p className="muted">Nothing saved yet.</p> : (
          <ul className="admin-list">
            {latest.map((v) => (
              <li key={v.id}>
                <Link className="link" href={`/admin/members/${v.user.id}`}>{[v.user.name, v.user.lastName].filter(Boolean).join(" ")}</Link>{" "}
                <span className="muted">saved</span> {getAsset(v.assetId)?.title ?? v.assetId} v{v.version}{" "}
                <span className="muted small">· {when(v.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
