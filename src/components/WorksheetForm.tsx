"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getWorksheet } from "@/content/registry";
import type { Block, ColumnDef, Computed, FieldDef, FieldType, ProfileData, SheetData, TableRow } from "@/content/types";
import { safeCompute } from "@/lib/docs/fromWorksheet";

type SaveState = "idle" | "saving" | "saved" | "error";

function Input({
  type, value, onChange, options, lines, placeholder, label, disabled,
}: {
  type: FieldType; value: unknown; onChange: (v: unknown) => void; options?: string[]; lines?: number;
  placeholder?: string; label: string; disabled?: boolean;
}) {
  const v = value ?? "";
  switch (type) {
    case "textarea":
      return <textarea className="textarea" aria-label={label} rows={lines ?? 3} value={String(v)} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
    case "number":
    case "money":
    case "percent":
      return (
        <input className="input" aria-label={label} type="number" inputMode="decimal" step="any" value={v === null ? "" : String(v)} placeholder={placeholder ?? (type === "money" ? "$" : type === "percent" ? "%" : "")} disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
      );
    case "date":
      return <input className="input" aria-label={label} type="date" value={String(v)} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return (
        <select className="select" aria-label={label} value={String(v)} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {(options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case "yesno":
    case "passfail": {
      const opts = type === "yesno" ? [["yes", "Yes"], ["no", "No"]] : [["pass", "Pass"], ["fail", "Fail"]];
      return (
        <div className="seg" role="group" aria-label={label}>
          {opts.map(([k, l]) => (
            <button type="button" key={k} className={v === k ? "on" : ""} disabled={disabled} onClick={() => onChange(v === k ? "" : k)}>{l}</button>
          ))}
        </div>
      );
    }
    case "checkbox":
      return <input className="check" aria-label={label} type="checkbox" checked={v === true} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />;
    case "signature":
      return <input className="input" aria-label={label} value={String(v)} placeholder="Type your name, or sign the printed copy" disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
    default:
      return <input className="input" aria-label={label} value={String(v)} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  }
}

function ComputedView({ label, value, big }: { label: string; value: Computed; big?: boolean }) {
  if (value !== null && typeof value === "object") {
    return (
      <div style={{ marginBottom: 14 }}>
        <div className="lbl" style={{ marginBottom: 8 }}>{label}</div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>{value.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>{value.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ padding: 10 }}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>
    );
  }
  return (
    <div className={`computed ${big ? "big" : ""}`}>
      <div className="lbl">{label}</div>
      <div className="v">{value === null || value === "" ? <span className="muted" style={{ fontSize: 15, fontWeight: 400 }}>Fills in as you complete the sheet</span> : String(value)}</div>
    </div>
  );
}

export default function WorksheetForm({
  assetId, initialData, profile, status: initialStatus, readOnly,
}: {
  assetId: string; initialData: SheetData; profile: ProfileData; status: string; readOnly: boolean;
}) {
  const def = getWorksheet(assetId);
  const router = useRouter();
  const [data, setData] = useState<SheetData>(initialData);
  const [status, setStatus] = useState(initialStatus);
  const [save, setSave] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string>("");
  const [completing, setCompleting] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(data);
  latest.current = data;

  const post = useCallback(
    async (complete: boolean) => {
      const res = await fetch(`/api/assets/${assetId}/state`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: latest.current, complete }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { status: string; version: number | null };
    },
    [assetId],
  );

  const flush = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    setSave("saving");
    try {
      const r = await post(false);
      setStatus(r.status);
      setSave("saved");
      setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    } catch {
      dirty.current = true;
      setSave("error");
    }
  }, [post]);

  // Autosave: a short pause after typing, and whenever the tab is hidden.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && dirty.current) {
        navigator.sendBeacon(`/api/assets/${assetId}/state`, new Blob([JSON.stringify({ data: latest.current, complete: false })], { type: "application/json" }));
        dirty.current = false;
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [assetId]);

  const update = (next: SheetData) => {
    setData(next);
    dirty.current = true;
    setSave("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  };
  const setField = (key: string, v: unknown) => update({ ...latest.current, [key]: v });

  async function complete() {
    setCompleting(true);
    setMessage("");
    try {
      if (timer.current) clearTimeout(timer.current);
      dirty.current = false;
      const r = await post(true);
      setStatus(r.status);
      setSave("saved");
      setMessage(readOnly ? "Marked as read." : `Saved as version ${r.version}. Downloads are below.`);
      router.refresh();
    } catch {
      setMessage("That didn't save. Check your connection and try again.");
    } finally {
      setCompleting(false);
    }
  }

  if (!def) return <p className="err">This worksheet is missing.</p>;

  const renderField = (f: FieldDef) => (
    <div key={f.key} className={`field w-${f.width ?? "full"}`}>
      <label>{f.label}</label>
      {f.readOnly || readOnly ? (
        <div className="v">{String(data[f.key] ?? "") || <span className="muted">Not set yet</span>}</div>
      ) : (
        <Input type={f.type} label={f.label} value={data[f.key]} options={f.options} lines={f.lines} placeholder={f.placeholder} onChange={(v) => setField(f.key, v)} />
      )}
      {f.hint && <span className="hint">{f.hint}</span>}
    </div>
  );

  const renderTable = (label: string | undefined, t: Extract<Block, { kind: "table" }>["table"]) => {
    const rows = (Array.isArray(data[t.key]) ? (data[t.key] as TableRow[]) : []).slice();
    while (rows.length < t.minRows) rows.push({});
    const setCell = (r: number, c: ColumnDef, v: unknown) => {
      const next = rows.map((row, i) => (i === r ? { ...row, [c.key]: v } : row));
      setField(t.key, next);
    };
    const canAdd = !readOnly && t.addable && (t.maxRows === undefined || rows.length < t.maxRows);
    return (
      <div key={t.key}>
        {label && <div className="lbl" style={{ margin: "6px 0 8px" }}>{label}</div>}
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {t.rowLabels && <th />}
                {t.columns.map((c) => <th key={c.key}>{c.label}</th>)}
                {canAdd && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className={t.highlightFrom !== undefined && r >= t.highlightFrom ? "hl" : ""}>
                  {t.rowLabels && <td className="label">{t.rowLabels[r]}</td>}
                  {t.columns.map((c) => (
                    <td key={c.key} style={c.type === "checkbox" ? { textAlign: "center", verticalAlign: "middle" } : undefined}>
                      <Input type={c.type} label={`${c.label} row ${r + 1}`} value={row[c.key]} options={c.options} disabled={readOnly} onChange={(v) => setCell(r, c, v)} />
                    </td>
                  ))}
                  {canAdd && (
                    <td style={{ verticalAlign: "middle" }}>
                      {r >= t.minRows && (
                        <button type="button" className="btn-ghost" aria-label={`Remove row ${r + 1}`} onClick={() => setField(t.key, rows.filter((_, i) => i !== r))}>×</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canAdd && (
          <button type="button" className="btn-ghost" style={{ marginBottom: 14 }} onClick={() => setField(t.key, [...rows, {}])}>+ Add row</button>
        )}
      </div>
    );
  };

  const renderBlock = (b: Block, i: number) => {
    switch (b.kind) {
      case "fields":
        return <div key={i} className="row-fields">{b.fields.map(renderField)}</div>;
      case "table":
        return renderTable(b.label, b.table);
      case "checklist": {
        const state = (data[b.key] as Record<string, Record<string, unknown>>) ?? {};
        const setItem = (k: string, patch: Record<string, unknown>) =>
          setField(b.key, { ...state, [k]: { ...(state[k] ?? {}), ...patch } });
        return (
          <div key={i} className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {b.mode === "check" && <th style={{ width: 48 }} />}
                  <th>Item</th>
                  {b.mode === "passfail" && <th>Pass / fail</th>}
                  {b.notes && <th>Notes</th>}
                </tr>
              </thead>
              <tbody>
                {b.items.map((it) => {
                  const s = state[it.key] ?? {};
                  return (
                    <tr key={it.key}>
                      {b.mode === "check" && (
                        <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                          <Input type="checkbox" label={it.label} value={s.done} disabled={readOnly} onChange={(v) => setItem(it.key, { done: v })} />
                        </td>
                      )}
                      <td className="label">
                        {it.label}
                        {it.detail && <div className="muted small" style={{ fontWeight: 400, whiteSpace: "pre-line" }}>{it.detail}</div>}
                      </td>
                      {b.mode === "passfail" && (
                        <td style={{ verticalAlign: "middle" }}>
                          <Input type="passfail" label={it.label} value={s.result} disabled={readOnly} onChange={(v) => setItem(it.key, { result: v })} />
                        </td>
                      )}
                      {b.notes && (
                        <td><Input type="text" label={`${it.label} notes`} value={s.notes} disabled={readOnly} onChange={(v) => setItem(it.key, { notes: v })} /></td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }
      case "prose":
        return (
          <div key={i} className="prose">
            {b.heading && <h3>{b.heading}</h3>}
            {b.paragraphs?.map((p, j) => <p key={j}>{p}</p>)}
            {b.bullets && <ul>{b.bullets.map((x, j) => <li key={j}>{x}</li>)}</ul>}
            {b.numbered && <ol>{b.numbered.map((x, j) => <li key={j}>{x}</li>)}</ol>}
          </div>
        );
      case "callout":
        return (
          <div key={i} className={`callout ${b.tone}`}>
            {b.title && <strong>{b.title}</strong>}
            {b.text}
          </div>
        );
      case "computed":
        return <ComputedView key={i} label={b.label} big={b.big} value={safeCompute(b, data, profile)} />;
    }
  };

  return (
    <div>
      {def.sections.map((s, i) => (
        <section key={i} className="card sheet-section">
          <h2>{s.title}</h2>
          {s.intro && <p className="intro">{s.intro}</p>}
          {s.blocks.map(renderBlock)}
        </section>
      ))}
      <div className="savebar">
        <button className="btn-primary" onClick={complete} disabled={completing}>
          {completing ? "Saving…" : readOnly ? (status === "complete" ? "Read ✓" : "Mark as read") : status === "complete" ? "Save a new version" : "Mark complete"}
        </button>
        {!readOnly && (
          <span className="status" aria-live="polite">
            {save === "saving" ? "Saving…" : save === "saved" ? `All changes saved ${savedAt}` : save === "error" ? "Not saved. Retrying when you type again." : "Changes save automatically"}
          </span>
        )}
        {message && <span className="status" style={{ color: "var(--mint)" }}>{message}</span>}
      </div>
    </div>
  );
}
