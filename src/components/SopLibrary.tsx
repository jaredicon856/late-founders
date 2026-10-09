"use client";

import Link from "next/link";
import { useState } from "react";
import type { SopContent, SopSummary } from "@/lib/sops";

type Draft = {
  id?: string;
  title: string;
  role: string;
  owner: string;
  nextReview: string;
  notes: string;
  content: SopContent;
};

const empty = (role: string): Draft => ({
  title: "", role, owner: "", nextReview: "", notes: "",
  content: { purpose: "", steps: [{ what: "", why: "" }], exceptions: [], notes: "" },
});

function Editor({ draft, roles, onCancel, onSaved }: { draft: Draft; roles: string[]; onCancel: () => void; onSaved: (sops: SopSummary[], roles: string[]) => void }) {
  const [d, setD] = useState<Draft>(draft);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const c = d.content;
  const setC = (patch: Partial<SopContent>) => setD({ ...d, content: { ...c, ...patch } });

  async function save() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/sops", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save", ...d }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error || "That didn't save.");
    onSaved(body.sops, body.roles);
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="row-fields">
        <div className="field w-half"><label>Title (name it by the task)</label><input className="input" value={d.title} placeholder="e.g. Send the monthly client report" onChange={(e) => setD({ ...d, title: e.target.value })} /></div>
        <div className="field w-half">
          <label>Role folder</label>
          <select className="select" value={d.role} onChange={(e) => setD({ ...d, role: e.target.value })}>
            {[...new Set([d.role, ...roles].filter(Boolean))].map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="field w-third"><label>Owner</label><input className="input" value={d.owner} onChange={(e) => setD({ ...d, owner: e.target.value })} /></div>
        <div className="field w-third"><label>Next review</label><input className="input" type="date" value={d.nextReview} onChange={(e) => setD({ ...d, nextReview: e.target.value })} /></div>
        <div className="field w-third"><label>What changed (version note)</label><input className="input" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} /></div>
        <div className="field w-full"><label>Purpose</label><input className="input" value={c.purpose} onChange={(e) => setC({ purpose: e.target.value })} /></div>
      </div>
      <div className="lbl" style={{ marginBottom: 8 }}>Steps</div>
      {c.steps.map((s, i) => (
        <div key={i} className="row-fields" style={{ marginBottom: 8 }}>
          <div className="field w-half"><input className="input" aria-label={`Step ${i + 1} what`} placeholder={`Step ${i + 1}: what`} value={s.what} onChange={(e) => setC({ steps: c.steps.map((x, j) => (j === i ? { ...x, what: e.target.value } : x)) })} /></div>
          <div className="field w-half" style={{ flexDirection: "row", gap: 8 }}>
            <input className="input" aria-label={`Step ${i + 1} why`} placeholder="Why" value={s.why} onChange={(e) => setC({ steps: c.steps.map((x, j) => (j === i ? { ...x, why: e.target.value } : x)) })} />
            <button className="btn-ghost" aria-label={`Remove step ${i + 1}`} onClick={() => setC({ steps: c.steps.filter((_, j) => j !== i) })}>×</button>
          </div>
        </div>
      ))}
      <button className="btn-ghost" style={{ marginBottom: 16 }} onClick={() => setC({ steps: [...c.steps, { what: "", why: "" }] })}>+ Step</button>
      <div className="lbl" style={{ marginBottom: 8 }}>What to do if</div>
      {c.exceptions.map((x, i) => (
        <div key={i} className="row-fields" style={{ marginBottom: 8 }}>
          <div className="field w-half"><input className="input" aria-label={`Exception ${i + 1} if`} placeholder="If…" value={x.when} onChange={(e) => setC({ exceptions: c.exceptions.map((y, j) => (j === i ? { ...y, when: e.target.value } : y)) })} /></div>
          <div className="field w-half" style={{ flexDirection: "row", gap: 8 }}>
            <input className="input" aria-label={`Exception ${i + 1} then`} placeholder="Then…" value={x.do} onChange={(e) => setC({ exceptions: c.exceptions.map((y, j) => (j === i ? { ...y, do: e.target.value } : y)) })} />
            <button className="btn-ghost" aria-label={`Remove exception ${i + 1}`} onClick={() => setC({ exceptions: c.exceptions.filter((_, j) => j !== i) })}>×</button>
          </div>
        </div>
      ))}
      <button className="btn-ghost" style={{ marginBottom: 18 }} onClick={() => setC({ exceptions: [...c.exceptions, { when: "", do: "" }] })}>+ Exception</button>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : d.id ? "Save as new version" : "Add to library"}</button>
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        {error && <span className="err">{error}</span>}
      </div>
    </div>
  );
}

export default function SopLibrary({ initialSops, initialRoles }: { initialSops: SopSummary[]; initialRoles: string[] }) {
  const [sops, setSops] = useState(initialSops);
  const [roles, setRoles] = useState<string[]>(initialRoles);
  const [newRole, setNewRole] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const allRoles = [...new Set([...roles, ...sops.map((s) => s.role)])];

  async function addRole() {
    if (!newRole.trim()) return;
    const res = await fetch("/api/sops", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "add_role", role: newRole }) });
    if (res.ok) {
      const body = await res.json();
      setRoles(body.roles);
      setNewRole("");
    }
  }

  const overdue = sops.filter((s) => s.overdue).length;

  return (
    <>
      <div className="card" style={{ marginBottom: 18, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ flex: "1 1 240px" }}>
          <label htmlFor="role">New role folder</label>
          <input id="role" className="input" value={newRole} placeholder="e.g. Client delivery" onChange={(e) => setNewRole(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRole()} />
        </div>
        <button className="btn-ghost" onClick={addRole}>Add folder</button>
        <Link className="btn-primary" href="/assets/sop-generator">Generate an SOP from a recording</Link>
      </div>
      {overdue > 0 && <div className="callout warning"><strong>{overdue} SOP{overdue > 1 ? "s are" : " is"} overdue for review</strong>Open each one, check it still matches how the task is done, and save it with a new review date.</div>}
      {editing && (
        <Editor draft={editing} roles={allRoles} onCancel={() => setEditing(null)} onSaved={(s, r) => { setSops(s); setRoles(r); setEditing(null); }} />
      )}
      {allRoles.length === 0 && !editing && (
        <div className="card"><p className="muted" style={{ margin: 0 }}>Create a folder for each role in your business, then add SOPs to it by hand or from the SOP Generator.</p></div>
      )}
      {allRoles.map((role) => {
        const list = sops.filter((s) => s.role === role);
        return (
          <section key={role} className="shelf">
            <div className="shelf-head">
              <div>
                <div className="name">{role}</div>
                <div className="meta">{list.length} SOP{list.length === 1 ? "" : "s"}</div>
              </div>
              <button className="btn-ghost" style={{ marginLeft: "auto" }} onClick={() => setEditing(empty(role))}>+ SOP</button>
            </div>
            {list.length > 0 && (
              <div className="shelf-body">
                {list.map((s) => (
                  <div key={s.id} style={{ borderBottom: "1px solid var(--line)", padding: "14px 0" }}>
                    <div className="asset-row" style={{ border: 0, padding: 0 }}>
                      <button className="link" style={{ all: "unset", cursor: "pointer", fontWeight: 700 }} onClick={() => setOpen(open === s.id ? null : s.id)}>{s.title}</button>
                      <span className="muted small">Owner: {s.owner || "not set"} · Updated {new Date(s.updatedAt).toLocaleDateString("en-US", { dateStyle: "medium" })} · v{s.version}</span>
                      <span className="s" style={{ color: s.overdue ? "var(--danger)" : "var(--muted)" }}>
                        {s.overdue ? `Review overdue (${s.nextReview})` : s.nextReview ? `Review ${s.nextReview}` : "No review date"}
                      </span>
                    </div>
                    {open === s.id && (
                      <div style={{ marginTop: 12 }}>
                        {s.content.purpose && <p className="muted">{s.content.purpose}</p>}
                        <ol>{s.content.steps.map((st, i) => <li key={i}>{st.what}{st.why && <span className="muted"> · {st.why}</span>}</li>)}</ol>
                        {s.content.exceptions.length > 0 && (
                          <>
                            <div className="lbl">What to do if</div>
                            <ul>{s.content.exceptions.map((e, i) => <li key={i}><strong>{e.when}</strong>: {e.do}</li>)}</ul>
                          </>
                        )}
                        <div className="dl" style={{ marginBottom: 10 }}>
                          <button className="btn-ghost" onClick={() => setEditing({ id: s.id, title: s.title, role: s.role, owner: s.owner, nextReview: s.nextReview ?? "", notes: "", content: s.content })}>Edit (new version)</button>
                          <a className="btn-ghost" href={`/api/sops/${s.id}/export`}>PDF</a>
                          <a className="btn-ghost" href={`/api/sops/${s.id}/export?format=docx`}>Word</a>
                        </div>
                        <div className="lbl">Versions</div>
                        <ul className="small muted">
                          {s.versions.map((v) => (
                            <li key={v.version}>
                              v{v.version} · {new Date(v.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })} · {v.notes}{" "}
                              <a className="link" href={`/api/sops/${s.id}/export?v=${v.version}`}>PDF</a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
