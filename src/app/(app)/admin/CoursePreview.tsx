import ConfirmButton from "@/components/ConfirmButton";
import { getAsset } from "@/content/catalog";
import { arrange, materialHref, sizeText, type MaterialRow } from "@/lib/materials";
import { deleteMaterial, moveMaterial, toggleMaterial } from "./actions";
import type { Place } from "./MaterialForms";

const KIND: Record<string, string> = { file: "File", link: "Link", note: "Note" };

// A built-in course laid out exactly as members see it, with the team's items
// in place and controls to move, hide or delete them.
export default function CoursePreview({ assetIds, items, places }: { assetIds: string[]; items: MaterialRow[]; places: Place[] }) {
  return (
    <div className="preview-list">
      {arrange(assetIds, items).map((e) =>
        e.type === "tool" ? (
          <div key={e.assetId} className="preview-row tool">
            <span className="tag">Tool</span>
            <span className="preview-title">{getAsset(e.assetId)?.title}</span>
            <a className="link small" href={`/assets/${e.assetId}`} target="_blank" rel="noopener noreferrer">Preview</a>
          </div>
        ) : (
          <div key={e.material.id} className={`preview-row team ${e.material.published ? "" : "hidden-item"}`}>
            <div className="preview-main">
              <span className="tag ai">{KIND[e.material.kind] ?? e.material.kind}</span>
              <span className="preview-title">
                {e.material.title}
                <span className="muted small">
                  Added by you{!e.material.published ? " · hidden from members" : ""}
                  {e.material.kind === "file" ? ` · ${sizeText(e.material.sizeBytes)}` : ""}
                </span>
              </span>
            </div>
            <div className="preview-actions">
              {materialHref(e.material) && <a className="btn-ghost" href={materialHref(e.material)} target="_blank" rel="noopener noreferrer">View</a>}
              <form action={moveMaterial} className="move-form">
                <input type="hidden" name="id" value={e.material.id} />
                <select className="select" name="place" defaultValue={e.material.place} aria-label="Move to">
                  {places.map((p) => <option key={p.value || "end"} value={p.value}>{p.label}</option>)}
                </select>
                <button className="btn-ghost">Move</button>
              </form>
              <form action={toggleMaterial}><input type="hidden" name="id" value={e.material.id} /><button className="btn-ghost">{e.material.published ? "Hide" : "Show"}</button></form>
              <form action={deleteMaterial}>
                <input type="hidden" name="id" value={e.material.id} />
                <ConfirmButton className="btn-ghost btn-danger" message={`Delete “${e.material.title}”? Members lose access to it.`}>Delete</ConfirmButton>
              </form>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
