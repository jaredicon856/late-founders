import Link from "next/link";
import { courseLabel } from "@/content/catalog";
import type { ProfileData } from "@/content/types";
import { nextAsset, type StatusMap } from "@/lib/assets";

// Shown at the foot of a tool once it is complete, so the member never has to
// go back to the dashboard to find out where to go next.
export default function NextUp({ profile, statuses }: { profile: ProfileData; statuses: StatusMap }) {
  const next = nextAsset(profile, statuses);
  return (
    <section className="card glow next-up">
      {next ? (
        <>
          <div className="eyebrow">Next up on your route · {courseLabel(next.course)}{next.lesson ? ` · ${next.lesson}` : ""}</div>
          <h3>{next.title}</h3>
          <p className="muted">{next.summary}</p>
          <Link className="btn-primary" href={`/assets/${next.id}`}>Open {next.title}</Link>
        </>
      ) : (
        <>
          <div className="eyebrow">Next up</div>
          <h3>Everything open to you is complete</h3>
          <p className="muted">New courses unlock as they are released. Your work stays in My Files.</p>
        </>
      )}
    </section>
  );
}
