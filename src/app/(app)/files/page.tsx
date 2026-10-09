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
              <thead><tr><th>File</th><th>Course</th><th>Version</th><th>Completed</th><th>Download</th></tr></thead>
              <tbody>
                {versions.map((v) => {
                  const a = getAsset(v.assetId);
                  if (!a) return null;
                  return (
                    <tr key={`${v.assetId}-${v.version}`}>
                      <td>
                        <Link className="link" href={`/assets/${a.id}`}>{a.title}</Link>
                        {v.label && <div className="muted small">{v.label}</div>}
                      </td>
                      <td className="muted">{courseLabel(a.course)}</td>
                      <td>v{v.version}</td>
                      <td className="muted">{v.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}</td>
                      <td className="dl">
                        {formatsFor(a.id).map((f) => (
                          <a key={f} className="link" href={`/api/export/${a.id}?format=${f}&v=${v.version}`}>{LABEL[f]}</a>
                        ))}
                      </td>
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
