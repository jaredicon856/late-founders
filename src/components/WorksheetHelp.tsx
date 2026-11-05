"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "./Markdown";

type Line = { id: string; role: "user" | "assistant"; text: string; createdAt: string };

// "Ask for help" on a worksheet: opens a small chat with the Assistant, which
// can see the sheet's questions and what the member has typed so far.
export default function WorksheetHelp({ assetId, title }: { assetId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || lines) return;
    fetch(`/api/help/${assetId}`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((b: { messages?: Line[] }) => setLines(b.messages ?? []))
      .catch(() => setLines([]));
  }, [open, lines, assetId]);

  useEffect(() => endRef.current?.scrollIntoView({ block: "nearest" }), [lines, busy]);

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setNotice("");
    setDraft("");
    try {
      const res = await fetch(`/api/help/${assetId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const body = (await res.json().catch(() => ({}))) as { messages?: Line[]; notice?: string; error?: string };
      if (!res.ok) {
        setNotice(body.error || "Your question didn't send. Try again.");
        setDraft(text);
        return;
      }
      setLines((l) => [...(l ?? []), ...(body.messages ?? [])]);
      if (body.notice) setNotice(body.notice);
    } catch {
      setNotice("Your question didn't send. Check your connection and try again.");
      setDraft(text);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-ghost help-toggle" onClick={() => setOpen(true)}>
        Stuck? Ask the Assistant about this worksheet
      </button>
    );
  }

  return (
    <section className="card help-panel">
      <div className="help-head">
        <div className="eyebrow">Help with {title}</div>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Close</button>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Ask what a question means or how to answer it. The Assistant can see this worksheet and what you have typed so far. It explains; you write the answers.
      </p>
      <div className="chat">
        {lines === null && <div className="typing">Loading…</div>}
        {lines?.map((l) => (
          <div key={l.id} className="msg">
            <div className={`avatar ${l.role === "assistant" ? "lf" : "me"}`}>{l.role === "assistant" ? "LF" : "Me"}</div>
            <div className="bubble">{l.role === "assistant" ? <Markdown text={l.text} /> : <p style={{ whiteSpace: "pre-wrap" }}>{l.text}</p>}</div>
          </div>
        ))}
        {busy && <div className="typing">The Assistant is thinking…</div>}
        {notice && <p className="err" role="status">{notice}</p>}
        <div ref={endRef} />
        <div className="composer">
          <textarea
            aria-label="Ask about this worksheet"
            placeholder="For example: what counts as a concrete outcome?"
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
          <button className="btn-primary" onClick={send} disabled={busy || !draft.trim()}>Ask</button>
        </div>
      </div>
    </section>
  );
}
