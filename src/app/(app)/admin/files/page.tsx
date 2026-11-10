import { requireAdmin } from "@/lib/auth";
import { listMaterials } from "@/lib/materials";
import { AddMaterial } from "../MaterialForms";
import MaterialList from "../MaterialList";

export default async function AdminFiles() {
  await requireAdmin();
  const items = await listMaterials({ courseKey: "" });
  return (
    <>
      <h1 className="title">Files</h1>
      <div className="accent" />
      <p className="muted">Files and links for every member, not tied to one course: templates, guides, recordings. Members find them under Resources.</p>
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card">
          <h3>Library</h3>
          <MaterialList items={items} />
        </div>
        <div className="card">
          <h3>Add a file or link</h3>
          <AddMaterial courseKey="" />
        </div>
      </div>
    </>
  );
}
