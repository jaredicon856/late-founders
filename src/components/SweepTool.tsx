"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { NameSweep } from "@/lib/sweep";

const MARK = { available: "Free", taken: "Taken", unknown: "Couldn't check", not_run: "Check by hand" } as const;
const COLOR = { available: "var(--mint)", taken: "var(--danger)", unknown: "var(--warn)", not_run: "var(--muted)" } as const;

export default function SweepTool({ initialNames }: { initialNames: string[] }) {
  const router = useRouter();
  const [names, setNames] = useState<string[]>(() => [...initialNames.slice(0, 5), "", "", "", "", ""].slice(0, 5));
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<NameSweep[] | null>(null);
  const [version, setVersion] = useState<number | null>(null);

  async function run() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/sweep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ names, category }),
      });
      const body = (await res.json()) as { results?: NameSweep[]; version?: number; error?: string };
      if (!res.ok || !body.results) throw new Error(body.error || "The sweep failed");
      setResults(body.results);
      setVersion(body.version ?? null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The sweep failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 18 }}>
        <p className="muted" style={{ marginTop: 0 }}>
          Up to five names, checked in one pass: domains, social handles and trademark hits. You get raw results side by side. Deciding whether a hit is a real conflict is your call, using the Trademark Conflict Triage Guide.
        </p>
        <div className="row-fields">
          {names.map((n, i) => (
            <div key={i} className="field w-third">
              <label htmlFor={`n${i}`}>Name {i + 1}</label>
              <input id={`n${i}`} className="input" value={n} maxLength={60} onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
          <div className="field w-third">
            <label htmlFor="cat">Business category</label>
            <input id="cat" className="input" value={category} placeholder="e.g. bookkeeping software" onChange={(e) => setCategory(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary" onClick={run} disabled={busy}>{busy ? "Checking… this takes up to a minute" : "Run the sweep"}</button>
        {error && <p className="err">{error}</p>}
      </div>

      {results && (
        <>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Check</th>{results.map((r) => <th key={r.name}>{r.name}</th>)}</tr>
              </thead>
              <tbody>
                {results[0].domains.map((_, di) => (
                  <tr key={`d${di}`}>
                    <td className="label">{di === 0 ? ".com" : results[0].domains[di].variant === "hyphenated" ? "Hyphenated .com" : "Close variant"}</td>
                    {results.map((r) => {
                      const d = r.domains[di];
                      return <td key={r.name} style={{ padding: 10 }}>{d ? <><div className="small muted">{d.domain}</div><span style={{ color: COLOR[d.status], fontWeight: 700 }}>{MARK[d.status]}</span></> : "—"}</td>;
                    })}
                  </tr>
                ))}
                {results[0].handles.map((h, hi) => (
                  <tr key={`h${hi}`}>
                    <td className="label">{h.platform}</td>
                    {results.map((r) => {
                      const x = r.handles[hi];
                      return (
                        <td key={r.name} style={{ padding: 10 }}>
                          <a className="link" href={x.url} target="_blank" rel="noreferrer">@{x.handle}</a>{" "}
                          <span style={{ color: COLOR[x.status], fontWeight: 700 }}>{MARK[x.status]}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="label">Trademark</td>
                  {results.map((r) => (
                    <td key={r.name} style={{ padding: 10 }}>
                      <div className="small" style={{ color: r.trademark.status === "done" ? undefined : "var(--warn)" }}>{r.trademark.message}</div>
                      {r.trademark.hits.slice(0, 5).map((h, i) => (
                        <div key={i} className="small" style={{ marginTop: 6 }}>
                          <strong>{h.mark}</strong> · {h.similarity}% similar · class {h.classes || "?"} · {h.status}
                        </div>
                      ))}
                      <a className="link small" href={r.trademark.searchUrl} target="_blank" rel="noreferrer">Search USPTO</a>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {results.filter((r) => r.domainFlag).map((r) => (
            <div key={r.name} className="callout warning"><strong>{r.name}</strong>{r.domainFlag}</div>
          ))}
          <div className="callout legal">
            <strong>Raw results, not a legal clearance</strong>
            Run every close trademark hit in your category through the triage guide, and see a trademark attorney before you commit to a name with close hits.
          </div>
          {version && <p className="small muted">Saved as version {version}. Downloads are below.</p>}
        </>
      )}
    </>
  );
}
