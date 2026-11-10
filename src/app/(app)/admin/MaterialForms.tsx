"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { addMaterial, createCourse, postNotice, type FormState } from "./actions";

// Adds a file, link or note to a course (or to Resources when courseKey is "").
export type Place = { value: string; label: string };

export function AddMaterial({ courseKey, notifyDefault = true, places }: { courseKey: string; notifyDefault?: boolean; places?: Place[] }) {
  const [kind, setKind] = useState<"file" | "link" | "note">("file");
  const [state, action, pending] = useActionState<FormState, FormData>(addMaterial, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="admin-form">
      <input type="hidden" name="courseKey" value={courseKey} />
      <input type="hidden" name="kind" value={kind} />
      <div className="seg" role="group" aria-label="What are you adding?">
        {(["file", "link", "note"] as const).map((k) => (
          <button key={k} type="button" className={kind === k ? "on" : ""} onClick={() => setKind(k)}>
            {k === "file" ? "Upload a file" : k === "link" ? "Add a link" : "Write a note"}
          </button>
        ))}
      </div>
      {places && (
        <div className="field">
          <label htmlFor={`p-${courseKey}`}>Where should it go in the course?</label>
          <select className="select" id={`p-${courseKey}`} name="place" defaultValue="">
            {places.map((p) => <option key={p.value || "end"} value={p.value}>{p.label}</option>)}
          </select>
          <span className="hint">See it placed in “What members see” on the right after you add it. You can move it later.</span>
        </div>
      )}
      <div className="field"><label htmlFor={`t-${courseKey}`}>Title</label><input className="input" id={`t-${courseKey}`} name="title" required maxLength={160} /></div>
      <div className="field"><label htmlFor={`d-${courseKey}`}>Short description (optional)</label><input className="input" id={`d-${courseKey}`} name="description" maxLength={1000} /></div>
      {kind === "file" && (
        <div className="field">
          <label htmlFor={`f-${courseKey}`}>File</label>
          <input className="input" id={`f-${courseKey}`} name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip" required />
          <span className="hint">PDF, image, Word, Excel, PowerPoint, CSV, text or zip, up to 4 MB. Bigger? Put it in Google Drive and add the link.</span>
        </div>
      )}
      {kind === "link" && (
        <div className="field"><label htmlFor={`u-${courseKey}`}>Link</label><input className="input" id={`u-${courseKey}`} name="url" type="url" placeholder="https://" required /></div>
      )}
      {kind === "note" && (
        <div className="field"><label htmlFor={`b-${courseKey}`}>Note</label><textarea className="textarea" id={`b-${courseKey}`} name="body" rows={5} required maxLength={5000} /></div>
      )}
      <label className="check-line"><input type="checkbox" name="notify" defaultChecked={notifyDefault} /> Announce it on members' bell</label>
      <div className="admin-action">
        <button className="btn-primary" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
        {state.ok && <span className="small" style={{ color: "var(--mint)" }}>{state.ok}</span>}
        {state.error && <span className="err">{state.error}</span>}
      </div>
    </form>
  );
}

export function NewCourse() {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(createCourse, {});
  useEffect(() => {
    if (state.ok) router.push(`/admin/courses/${state.ok}`);
  }, [state, router]);
  return (
    <form action={action} className="admin-form">
      <div className="row-fields">
        <div className="field w-half"><label htmlFor="nc-title">Course title</label><input className="input" id="nc-title" name="title" required maxLength={120} /></div>
        <div className="field w-half"><label htmlFor="nc-pillar">Section (optional)</label><input className="input" id="nc-pillar" name="pillar" placeholder="e.g. Pillar 2" maxLength={80} /></div>
      </div>
      <div className="field"><label htmlFor="nc-summary">One-line summary (optional)</label><input className="input" id="nc-summary" name="summary" maxLength={500} /></div>
      <div className="admin-action">
        <button className="btn-primary" disabled={pending}>{pending ? "Creating…" : "Create course"}</button>
        <span className="muted small">Next you'll add its materials. Members don't see it until you publish.</span>
        {state.error && <span className="err">{state.error}</span>}
      </div>
    </form>
  );
}

export function NewNotice() {
  const [state, action, pending] = useActionState<FormState, FormData>(postNotice, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="admin-form">
      <div className="field"><label htmlFor="n-title">Headline</label><input className="input" id="n-title" name="title" required maxLength={200} /></div>
      <div className="field"><label htmlFor="n-body">Message (optional)</label><textarea className="textarea" id="n-body" name="body" rows={4} maxLength={2000} /></div>
      <div className="field">
        <label htmlFor="n-link">Link (optional)</label>
        <input className="input" id="n-link" name="link" placeholder="https://… or a page like /courses" />
      </div>
      <div className="admin-action">
        <button className="btn-primary" disabled={pending}>{pending ? "Posting…" : "Post announcement"}</button>
        {state.ok && <span className="small" style={{ color: "var(--mint)" }}>{state.ok}</span>}
        {state.error && <span className="err">{state.error}</span>}
      </div>
    </form>
  );
}
