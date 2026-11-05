"use client";

import { useEffect, useState } from "react";
import type { Block, ProfileData } from "@/content/types";

type LibraryBlock = Extract<Block, { kind: "library" }>;

// A browsable library: filter chips, one card per entry, copy buttons on the
// parts meant to be adapted. Opens on the member's own categories when known.
export default function LibraryView({ block, profile }: { block: LibraryBlock; profile: ProfileData }) {
  const forYou = (() => {
    try {
      return (block.forYou?.(profile) ?? []).filter((c) => block.categories.includes(c));
    } catch {
      return [];
    }
  })();
  const [filter, setFilter] = useState<string>(forYou.length ? "For you" : "All");
  const [copied, setCopied] = useState("");
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(""), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const shown = block.entries.filter((e) =>
    filter === "All" ? true : filter === "For you" ? forYou.includes(e.category) : e.category === filter,
  );
  const chips = [...(forYou.length ? ["For you"] : []), "All", ...block.categories];

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
    } catch {
      setCopied("");
    }
  }

  return (
    <div className="library">
      <div className="chips" role="group" aria-label="Filter the library">
        {chips.map((c) => (
          <button key={c} type="button" className={`pill ${filter === c ? "active" : ""}`} onClick={() => setFilter(c)}>
            {c}
          </button>
        ))}
      </div>
      {filter === "For you" && <p className="muted small">Matched to your top automation targets from the AI Audit Tracker.</p>}
      {shown.map((e) => (
        <article key={`${e.category}-${e.title}`} className="lib-entry">
          <div className="eyebrow">{e.category}</div>
          <h3>{e.title}</h3>
          {e.parts.map((p, j) => {
            const id = `${e.title}-${j}`;
            return (
              <div key={j} className={`lib-part ${p.copy ? "copyable" : ""}`}>
                <div className="lbl">{p.label}</div>
                <p>{p.text}</p>
                {p.copy && (
                  <button type="button" className="btn-ghost" onClick={() => copy(id, p.text)}>
                    {copied === id ? "Copied" : "Copy"}
                  </button>
                )}
              </div>
            );
          })}
        </article>
      ))}
    </div>
  );
}
