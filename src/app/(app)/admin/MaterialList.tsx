import type { MaterialRow } from "@/lib/materials";
import { materialHref, sizeText } from "@/lib/materials";
import { day } from "@/lib/admin";
import ConfirmButton from "@/components/ConfirmButton";
import { deleteMaterial, toggleMaterial } from "./actions";

const KIND = { file: "File", link: "Link", note: "Note" } as Record<string, string>;

// The team's view of a course's or the library's materials, with publish and delete.
export default function MaterialList({ items }: { items: MaterialRow[] }) {
  if (!items.length) return <p className="muted">Nothing added yet.</p>;
  return (
    <div className="mat-list">
      {items.map((m) => (
        <div key={m.id} className={`mat-row ${m.published ? "" : "hidden-item"}`}>
          <span className="mat-kind">{KIND[m.kind] ?? m.kind}</span>
          <div className="mat-main">
            <strong>{m.title}</strong>
            {!m.published && <span className="badge">Hidden</span>}
            {m.description && <div className="muted small">{m.description}</div>}
            <div className="muted small">
              {m.kind === "file" ? `${m.fileName} · ${sizeText(m.sizeBytes)}` : m.kind === "link" ? m.url : `${m.body.slice(0, 120)}${m.body.length > 120 ? "…" : ""}`} · added {day(m.createdAt)}
            </div>
          </div>
          <div className="mat-actions">
            {materialHref(m) && <a className="btn-ghost" href={materialHref(m)} target="_blank" rel="noopener noreferrer">View</a>}
            <form action={toggleMaterial}><input type="hidden" name="id" value={m.id} /><button className="btn-ghost">{m.published ? "Hide" : "Show"}</button></form>
            <form action={deleteMaterial}><input type="hidden" name="id" value={m.id} /><ConfirmButton className="btn-ghost btn-danger" message={`Delete “${m.title}”? Members lose access to it.`}>Delete</ConfirmButton></form>
          </div>
        </div>
      ))}
    </div>
  );
}
