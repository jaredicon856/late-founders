"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FieldDef } from "@/content/types";
import Markdown from "./Markdown";

type Line = { id: string; role: "user" | "assistant"; text: string; createdAt: string };
type Saved = { version: number; summary: string };

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "ME";
}

function MemberEntry({
  assetId, entry,
}: {
  assetId: string;
  entry: { key: string; label: string; fields: FieldDef[]; values: Record<string, unknown> };
}) {
  const [values, setValues] = useState<Record<string, unknown>>(entry.values);
  const [state, setState] = useState<"" | "saving" | "saved" | "error">("");

  async function save() {
    setState("saving");
    const res = await fetch(`/api/assistant/${assetId}/entry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ values }),
    });
    setState(res.ok ? "saved" : "error");
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>{entry.label}</div>
      <div className="row-fields">
        {entry.fields.map((f) => (
          <div key={f.key} className={`field w-${f.width ?? "third"}`}>
            <label htmlFor={`me-${f.key}`}>{f.label}</label>
            <input
              id={`me-${f.key}`}
              className="input"
              type={["number", "money", "percent"].includes(f.type) ? "number" : f.type === "date" ? "date" : "text"}
              step="any"
              value={values[f.key] === null || values[f.key] === undefined ? "" : String(values[f.key])}
              onChange={(e) => {
                const raw = e.target.value;
                const num = ["number", "money", "percent"].includes(f.type);
                setValues({ ...values, [f.key]: raw === "" ? null : num ? Number(raw) : raw });
                setState("");
              }}
            />
            {f.hint && <span className="hint">{f.hint}</span>}
          </div>
        ))}
      </div>
      <button className="btn-ghost" onClick={save} disabled={state === "saving"}>
        {state === "saving" ? "Saving…" : "Save to my profile"}
      </button>{" "}
      {state === "saved" && <span className="small" style={{ color: "var(--mint)" }}>Saved. The Assistant will use these numbers.</span>}
      {state === "error" && <span className="err">That didn't save. Check the numbers and try again.</span>}
    </div>
  );
}

export default function Chat({
  assetId, initial, persistent, disclaimer, memberEntry, connected, name, uploads,
}: {
  assetId: string;
  initial: Line[];
  persistent: boolean;
  disclaimer: string | null;
  memberEntry: { key: string; label: string; fields: FieldDef[]; values: Record<string, unknown> } | null;
  connected: boolean;
  name: string;
  uploads?: boolean; // transcript / recording upload (SOP Generator)
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState<Saved | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const draftKey = `lf-draft-${assetId}`;

  // Keep an unsent draft across reloads.
  useEffect(() => {
    try {
      const d = localStorage.getItem(draftKey);
      if (d) setDraft(d);
    } catch {}
  }, [draftKey]);
  useEffect(() => {
    try {
      if (draft) localStorage.setItem(draftKey, draft);
      else localStorage.removeItem(draftKey);
    } catch {}
  }, [draft, draftKey]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines.length, busy]);

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setNotice("");
    const temp: Line = { id: `tmp-${Date.now()}`, role: "user", text, createdAt: new Date().toISOString() };
    setLines((l) => [...l, temp]);
    setDraft("");
    try {
      const res = await fetch(`/api/assistant/${assetId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const body = (await res.json().catch(() => ({}))) as { messages?: Line[]; saved?: Saved; notice?: string; error?: string };
      if (!res.ok) throw new Error(body.error || "Request failed");
      setLines((l) => [...l.filter((x) => x.id !== temp.id), ...(body.messages?.length ? body.messages : [temp])]);
      if (body.notice) setNotice(body.notice);
      if (body.saved) {
        setSaved(body.saved);
        router.refresh();
      }
    } catch {
      setNotice("Your message didn't reach the Assistant. It is back in the box; send it again.");
      setLines((l) => l.filter((x) => x.id !== temp.id));
      setDraft(text);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    setNotice("");
    if (/\.(txt|vtt|srt|md)$/i.test(file.name) || file.type.startsWith("text/")) {
      if (file.size > 2_000_000) return setNotice("That transcript is over 2 MB. Paste the part covering one task.");
      const text = await file.text();
      setDraft((d) => `${d ? d + "\n\n" : ""}Transcript (${file.name}):\n${text}`);
      return;
    }
    if (file.type.startsWith("audio/") || file.type.startsWith("video/")) {
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/transcribe", { method: "POST", body: fd });
        const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok || !body.text) throw new Error(body.error || "Transcription failed");
        setDraft((d) => `${d ? d + "\n\n" : ""}Transcript (${file.name}):\n${body.text}`);
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "Transcription failed. Paste a transcript instead.");
      } finally {
        setBusy(false);
      }
      return;
    }
    setNotice("Upload a recording (audio or video) or a transcript (.txt, .vtt, .srt).");
  }

  async function freshRun() {
    if (!confirm("Start a fresh run? This conversation stays saved, and your earlier results stay in the version list.")) return;
    const res = await fetch(`/api/assistant/${assetId}/run`, { method: "POST" });
    if (res.ok) {
      const body = (await res.json()) as { messages: Line[] };
      setLines(body.messages);
      setSaved(null);
      setNotice("");
    }
  }

  return (
    <>
      {memberEntry && <MemberEntry assetId={assetId} entry={memberEntry} />}
      {disclaimer && (
        <div className="legal" style={{ marginBottom: 18 }}>
          <strong>General guidance, not advice. </strong>
          {disclaimer}
        </div>
      )}
      {!connected && (
        <div className="legal" style={{ marginBottom: 18 }}>
          <strong>The Assistant isn't connected yet.</strong> An administrator needs to add the Claude API key to the server. Your messages won't be answered until then.
        </div>
      )}
      <div className="chat">
        {lines.map((l) => (
          <div key={l.id} className="msg">
            <div className={`avatar ${l.role === "assistant" ? "lf" : "me"}`}>{l.role === "assistant" ? "LF" : initials(name)}</div>
            <div className="bubble">{l.role === "assistant" ? <Markdown text={l.text} /> : <p style={{ whiteSpace: "pre-wrap" }}>{l.text}</p>}</div>
          </div>
        ))}
        {busy && <div className="typing">The Assistant is thinking…</div>}
        {saved && (
          <div className="saved">
            <span>Saved as version {saved.version}: {saved.summary}</span>
            <a className="link" href={`/api/export/${assetId}?format=pdf&v=${saved.version}`}>Download PDF</a>
            <a className="link" href={`/api/export/${assetId}?format=docx&v=${saved.version}`}>DOCX</a>
          </div>
        )}
        {notice && <p className="err" role="status">{notice}</p>}
        <div ref={endRef} />
        <div className="composer">
          <textarea
            aria-label="Message the Assistant"
            placeholder={persistent ? "Pick up where you left off, or log something new…" : "Type your answer…"}
            value={draft}
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button className="btn-primary" onClick={send} disabled={busy || !draft.trim()}>Send</button>
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {uploads && (
            <label className="btn-ghost" style={{ cursor: "pointer" }}>
              Upload recording or transcript
              <input
                type="file"
                accept="audio/*,video/*,.txt,.vtt,.srt,.md,text/plain"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <button className="btn-ghost" onClick={freshRun} disabled={busy}>
            {persistent ? "Start a separate conversation" : "Start a fresh run"}
          </button>
        </div>
      </div>
    </>
  );
}
