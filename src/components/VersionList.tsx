type V = { version: number; label: string; createdAt: string };

const LABEL: Record<string, string> = { pdf: "PDF", docx: "Word", xlsx: "Excel", zip: "Zip" };

export default function VersionList({
  assetId, versions, formats, current, canExportCurrent,
}: {
  assetId: string;
  versions: V[];
  formats: string[];
  current?: boolean; // always offer the current state (guides, generated docs)
  canExportCurrent?: boolean; // worksheets can export their live state; AI apps only versions
}) {
  const showCurrent = !!canExportCurrent && (current || versions.length === 0);
  return (
    <section className="card" style={{ marginTop: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Downloads and versions</div>
      {showCurrent && formats.length > 0 && (
        <div className="dl" style={{ marginBottom: versions.length ? 14 : 0 }}>
          <span className="muted small" style={{ alignSelf: "center" }}>{versions.length ? "Current:" : "Download as it stands:"}</span>
          {formats.map((f) => (
            <a key={f} className="btn-ghost" href={`/api/export/${assetId}?format=${f}`}>{LABEL[f] ?? f}</a>
          ))}
        </div>
      )}
      {versions.length > 0 ? (
        <table className="versions">
          <thead><tr><th>Version</th><th>Saved</th><th>Note</th><th>Download</th></tr></thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.version}>
                <td>v{v.version}</td>
                <td className="muted">{new Date(v.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</td>
                <td className="muted">{v.label}</td>
                <td className="dl">
                  {formats.map((f) => (
                    <a key={f} className="link" href={`/api/export/${assetId}?format=${f}&v=${v.version}`}>{LABEL[f] ?? f}</a>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted small" style={{ margin: "10px 0 0" }}>Each time you complete or re-run this, a new version is kept here. Earlier versions are never overwritten.</p>
      )}
    </section>
  );
}
