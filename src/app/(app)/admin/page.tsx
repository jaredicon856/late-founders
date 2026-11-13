import Link from "next/link";
import { COURSES, courseLabel, getAsset } from "@/content/catalog";
import { FILTERS, TOTAL_TOOLS, day, memberRows, realMembers, when } from "@/lib/admin";
import { dailyLimit } from "@/lib/assistant/limit";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

const DAY = 86_400_000;

function Stat({ href, label, value, of, note, bar }: { href: string; label: string; value: number; of?: number; note: string; bar?: number }) {
  return (
    <Link href={href} className="card kpi">
      <span className="eyebrow">{label}</span>
      <span className="kpi-num">{value}{of !== undefined && <small> / {of}</small>}</span>
      {bar !== undefined && <span className="bar"><span style={{ width: `${bar}%` }} /></span>}
      <span className="muted small">{note}</span>
      <span className="kpi-go">View →</span>
    </Link>
  );
}

export default async function AdminOverview() {
  await requireAdmin();
  const all = await memberRows();
  const members = realMembers(all);
  const ids = members.map((m) => m.id);
  const [latest, messagesToday] = await Promise.all([
    db.assetVersion.findMany({
      where: { userId: { in: ids } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, assetId: true, version: true, createdAt: true, user: { select: { id: true, name: true, lastName: true } } },
    }),
    db.message.count({ where: { userId: { in: ids }, role: "user", hidden: false, createdAt: { gte: new Date(Date.now() - DAY) } } }),
  ]);
  const count = (k: keyof typeof FILTERS) => members.filter(FILTERS[k].test).length;
  const total = members.length;
  const doneCells = members.reduce((a, m) => a + m.done, 0);
  const pct = total ? Math.round((doneCells / (total * TOTAL_TOOLS)) * 100) : 0;
  const limit = dailyLimit();
  const stuck = members.filter(FILTERS.stuck.test).slice(0, 5);
  const quiet = members.filter(FILTERS.quiet.test).slice(0, 5);

  return (
    <>
      <div className="eyebrow">Admin</div>
      <h1 className="title">Overview</h1>
      <div className="accent" />

      <div className="kpi-grid">
        <Stat href="/admin/members" label="Members" value={total} note={`${count("new")} joined this week`} />
        <Stat href="/admin/members?show=active" label="Active this week" value={count("active")} of={total} note="Opened the Portal in 7 days" />
        <Stat href="/admin/members?show=diagnosed" label="Diagnostic done" value={count("diagnosed")} of={total} note="The first step for everyone" />
        <Stat href="/admin/members?sort=progress" label="Overall progress" value={pct} note={`% of all ${TOTAL_TOOLS} tools, every member`} bar={pct} />
        <Stat href="/admin/members?show=today" label="Assistant today" value={messagesToday} note={`Messages in 24h · cap ${limit} each`} />
        <Stat href="/admin/members?show=stuck" label="Needs a nudge" value={count("stuck")} note="Joined 2+ days ago, no Diagnostic" />
      </div>

      <div className="grid grid-2" style={{ margin: "18px 0", alignItems: "start" }}>
        <div className="card">
          <div className="card-head"><h3>Needs attention</h3></div>
          <Link href="/admin/members?show=stuck" className="sub-head">No Diagnostic yet <span className="muted small">({count("stuck")}) →</span></Link>
          {stuck.length === 0 ? <p className="muted small">Nobody.</p> : (
            <div className="people">{stuck.map((m) => <Person key={m.id} id={m.id} name={m.name} sub={`joined ${day(m.createdAt)}`} />)}</div>
          )}
          <Link href="/admin/members?show=quiet" className="sub-head" style={{ marginTop: 14 }}>Gone quiet <span className="muted small">({count("quiet")}) →</span></Link>
          {quiet.length === 0 ? <p className="muted small">Nobody.</p> : (
            <div className="people">{quiet.map((m) => <Person key={m.id} id={m.id} name={m.name} sub={`last active ${when(m.lastSeenAt)}`} />)}</div>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h3>New sign-ups</h3><Link className="link small" href="/admin/members?show=new">All this week →</Link></div>
          {members.length === 0 ? <p className="muted">Nobody yet.</p> : (
            <div className="people">
              {members.slice(0, 7).map((m) => <Person key={m.id} id={m.id} name={m.name} sub={`${day(m.createdAt)}${m.founderType ? ` · ${m.founderType}` : ""}`} />)}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="card-head"><h3>Progress by course</h3></div>
          <p className="muted small" style={{ marginTop: 0 }}>Open a course to see each tool. Click a tool to see who hasn't done it.</p>
          {COURSES.map((c) => {
            const possible = total * c.assets.length;
            const done = members.reduce((a, m) => a + c.assets.filter((x) => m.doneIds.has(x)).length, 0);
            const p = possible ? Math.round((done / possible) * 100) : 0;
            return (
              <details key={c.number} className="course-progress">
                <summary>
                  <span className="cp-name">{courseLabel(c.number)} · {c.title}</span>
                  <span className="bar"><span style={{ width: `${p}%` }} /></span>
                  <span className="muted small cp-pct">{p}%</span>
                </summary>
                {c.assets.map((id) => {
                  const n = members.filter((m) => m.doneIds.has(id)).length;
                  return (
                    <Link key={id} href={`/admin/members?missing=${id}`} className="cp-tool">
                      <span>{getAsset(id)?.title}</span>
                      <span className="muted small">{n} / {total} done →</span>
                    </Link>
                  );
                })}
              </details>
            );
          })}
        </div>
        <div className="card">
          <div className="card-head"><h3>Latest saved work</h3></div>
          {latest.length === 0 ? <p className="muted">Nothing saved yet.</p> : (
            <div className="people">
              {latest.map((v) => (
                <Person
                  key={v.id}
                  id={v.user.id}
                  name={[v.user.name, v.user.lastName].filter(Boolean).join(" ")}
                  sub={`${getAsset(v.assetId)?.title ?? v.assetId} v${v.version} · ${when(v.createdAt)}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Person({ id, name, sub }: { id: string; name: string; sub: string }) {
  return (
    <Link href={`/admin/members/${id}`} className="person">
      <span className="avatar me">{name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?"}</span>
      <span className="person-main"><strong>{name}</strong><span className="muted small">{sub}</span></span>
      <span className="muted">›</span>
    </Link>
  );
}
