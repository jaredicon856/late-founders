import Link from "next/link";
import { ASSETS, FOUNDER_TYPE_COPY, courseLabel, getAsset } from "@/content/catalog";
import { asNumber, money } from "@/content/profile";
import FirstFive from "@/components/FirstFive";
import Greeting from "@/components/Greeting";
import { getStatuses, nextAsset, routeFor } from "@/lib/assets";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/record";

export default async function Dashboard() {
  const user = await requireUser();
  const [profile, statuses, versions] = await Promise.all([
    getProfile(user.id),
    getStatuses(user.id),
    db.assetVersion.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 40 }),
  ]);
  const type = typeof profile.founder_type === "string" ? profile.founder_type : null;
  const freedom = asNumber(profile.freedom_number);
  const moves = Array.isArray(profile.first_five_moves) ? (profile.first_five_moves as string[]) : [];
  const done = Array.isArray(profile.first_five_done) ? (profile.first_five_done as boolean[]) : [];
  const next = nextAsset(profile, statuses);
  const route = routeFor(profile);

  // Latest version per asset for the completed list.
  const latest = new Map<string, (typeof versions)[number]>();
  for (const v of versions) if (!latest.has(v.assetId)) latest.set(v.assetId, v);

  return (
    <>
      <div className="eyebrow">Your roadmap</div>
      <h1 className="title">
        <Greeting name={user.name} />
      </h1>
      <div className="accent" />

      {!type ? (
        <div className="card glow" style={{ marginBottom: 18 }}>
          <div className="eyebrow">Start here · {courseLabel(1)}</div>
          <h3>Founder Diagnostic</h3>
          <p className="muted">
            A 15 to 20 minute conversation that sets your founder type, your Freedom Number and your first five moves.
            Every other tool reads what you say here, so you only answer once.
          </p>
          <Link className="btn-primary" href="/assets/founder-diagnostic">Start the diagnostic</Link>
        </div>
      ) : (
        <div className="grid grid-3" style={{ marginBottom: 18 }}>
          <div className="card">
            <div className="eyebrow">Founder type</div>
            <div className="stat">{type}</div>
            <p className="muted small">{FOUNDER_TYPE_COPY[type]}</p>
          </div>
          <div className="card">
            <div className="eyebrow">Freedom Number</div>
            <div className="stat">
              {money(freedom)}
              <small>/mo</small>
            </div>
            <p className="muted small">The destination. Course 06 sets the lower number you need before you quit.</p>
          </div>
          <div className="card">
            <div className="eyebrow">90-day target</div>
            <div className="stat gradtext">{String(profile.ninety_day_target ?? "")}</div>
          </div>
        </div>
      )}

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <div className="card glow">
          {next ? (
            <>
              <div className="eyebrow">
                Next up · {courseLabel(next.course)}
                {next.lesson ? ` · ${next.lesson}` : ""}
              </div>
              <h3>{next.title}</h3>
              <p className="muted">{next.summary}</p>
              <Link className="btn-primary" href={`/assets/${next.id}`}>Open the tool</Link>
            </>
          ) : (
            <>
              <div className="eyebrow">Next up</div>
              <h3>Everything open to you is complete</h3>
              <p className="muted">New courses unlock as they are released. Your work stays in My Files.</p>
            </>
          )}
        </div>
        <div className="card">
          <div className="eyebrow">Your first five moves</div>
          {moves.length ? (
            <FirstFive moves={moves} done={done} />
          ) : (
            <p className="muted">Your five moves appear here when you finish the Founder Diagnostic.</p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>What you have completed</div>
        {latest.size ? (
          <table className="versions">
            <thead>
              <tr><th>Asset</th><th>Course</th><th>Completed</th><th>Download</th></tr>
            </thead>
            <tbody>
              {[...latest.values()].map((v) => {
                const a = getAsset(v.assetId);
                if (!a) return null;
                return (
                  <tr key={v.id}>
                    <td><Link className="link" href={`/assets/${a.id}`}>{a.title}</Link></td>
                    <td className="muted">{courseLabel(a.course)}</td>
                    <td className="muted">{v.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}</td>
                    <td><a className="link" href={`/api/export/${a.id}?format=pdf&v=${v.version}`}>PDF</a></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="muted">Nothing yet. Finished worksheets and AI outputs land here with download links.</p>
        )}
      </div>

      <div className="note-bar">
        Every tool reads this profile. Your route through the courses: {route.map((n) => courseLabel(n)).join(" → ")}.{" "}
        {Object.values(statuses).filter((s) => s.status === "complete").length} of {ASSETS.length} assets complete.
      </div>
    </>
  );
}
