import Link from "next/link";
import { courseLabel, getAsset } from "@/content/catalog";
import { getMode, getWorksheet } from "@/content/registry";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const LABEL: Record<string, string> = { pdf: "PDF", docx: "Word", xlsx: "Excel", zip: "Zip" };

function formatsFor(assetId: string): string[] {
  const ws = getWorksheet(assetId);
  if (ws) return ws.exports;
  if (getMode(assetId)) return ["pdf", "docx"];
  return ["pdf", "xlsx"];
}

export default async function Files() {
  const user = await requireUser();
  const versions = await db.assetVersion.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }],
    select: { assetId: true, version: true, label: true, createdAt: true },
  });
  // One row per file, newest version first; earlier versions fold away under it.
  const byAsset = new Map<string, typeof versions>();
  for (const v of versions) byAsset.set(v.assetId, [...(byAsset.get(v.assetId) ?? []), v]);
  const groups = [...byAsset.entries()].map(([id, vs]) => [id, vs.sort((x, y) => y.version - x.version)] as const);
  return (
    <>
      <div className="eyebrow">Everything you have produced</div>
      <h1 className="title">My Files</h1>
      <div className="accent" />
      <div className="card">
        {versions.length === 0 ? (
          <p className="muted">
            Nothing here yet. Every worksheet you complete and every AI output you save appears here, with every earlier version kept.{" "}
            <Link className="link" href="/dashboard">Back to your next step</Link>
          </p>
        ) : (
          <div className="tbl-wrap" style={{ border: 0 }}>
            <table className="versions">
              <thead><tr><th>File</th><th>Course</th><th>Current version</th><th>Completed</th><th>Download</th></tr></thead>
              <tbody>
                {groups.map(([assetId, vs]) => {
                  const a = getAsset(assetId);
                  if (!a) return null;
                  const [cur, ...older] = vs;
                  const links = (v: (typeof vs)[number]) =>
                    formatsFor(a.id).map((f) => (
                      <a key={f} className="link" href={`/api/export/${a.id}?format=${f}&v=${v.version}`}>{LABEL[f]}</a>
                    ));
                  return (
                    <tr key={assetId}>
                      <td>
                        <Link className="link" href={`/assets/${a.id}`}>{a.title}</Link>
                        {cur.label && <div className="muted small">{cur.label}</div>}
                        {older.length > 0 && (
                          <details className="older">
                            <summary className="muted small">{older.length} earlier {older.length === 1 ? "version" : "versions"}</summary>
                            {older.map((v) => (
                              <div key={v.version} className="older-row small">
                                <span>v{v.version}</span>
                                <span className="muted">{v.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}</span>
                                <span className="dl">{links(v)}</span>
                              </div>
                            ))}
                          </details>
                        )}
                      </td>
                      <td className="muted">{courseLabel(a.course)}</td>
                      <td>v{cur.version} <span className="tag-current">Current</span></td>
                      <td className="muted">{cur.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}</td>
                      <td className="dl">{links(cur)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
