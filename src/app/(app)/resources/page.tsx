import MaterialItems from "@/components/MaterialItems";
import { requireUser } from "@/lib/auth";
import { listMaterials } from "@/lib/materials";

export default async function Resources() {
  await requireUser();
  const items = (await listMaterials({ courseKey: "", published: true })).reverse();
  return (
    <>
      <div className="eyebrow">From the Late Founders team</div>
      <h1 className="title">Resources</h1>
      <div className="accent" />
      <section className="shelf">
        <div className="shelf-body">
          {items.length === 0 ? <p className="muted" style={{ padding: "8px 0" }}>Nothing here yet. The team will add templates, guides and recordings here.</p> : <MaterialItems items={items} />}
        </div>
      </section>
    </>
  );
}
