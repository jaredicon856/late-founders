import { materialHref, sizeText, type MaterialRow } from "@/lib/materials";

// How members see team-added materials: files open in the browser, links in a
// new tab, notes expand in place.
export default function MaterialItems({ items }: { items: MaterialRow[] }) {
  return (
    <>
      {items.map((m) =>
        m.kind === "note" ? (
          <details key={m.id} className="asset-row material-note">
            <summary>
              <span className="tag">Note</span>
              <span className="t">{m.title}</span>
              <span className="s">Read</span>
            </summary>
            {m.description && <p className="muted small" style={{ margin: "0 0 8px" }}>{m.description}</p>}
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{m.body}</p>
          </details>
        ) : (
          <a key={m.id} className="asset-row" href={materialHref(m)} target="_blank" rel="noopener noreferrer">
            <span className="tag">{m.kind === "file" ? "File" : "Link"}</span>
            <span className="t">
              {m.title}
              {m.description && <span className="muted small" style={{ display: "block", fontWeight: 400 }}>{m.description}</span>}
            </span>
            <span className="s">{m.kind === "file" ? `Open · ${sizeText(m.sizeBytes)}` : "Open ↗"}</span>
          </a>
        ),
      )}
    </>
  );
}
