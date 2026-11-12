// Course 05 worksheets. The One-Page Offer Template and the Offer-Builder Agent
// share one offer: the page shows the current offer_record every time it opens
// and writes its six sections back into it, so the Offer-Builder Agent and the
// Skeptical-Buyer Simulation always see the page as the member last left it.

import type { ProfileData, SheetData, TableRow, WorksheetDef } from "../types";

const s = (v: unknown) => (typeof v === "string" ? v : "");
const PAGE_KEYS = ["headline", "promise", "proof", "price_sentence", "tiers", "guarantee", "cta"] as const;

export function pageFromRecord(p: ProfileData): SheetData {
  const o = p.offer_record && typeof p.offer_record === "object" ? (p.offer_record as Record<string, unknown>) : null;
  if (!o) return {};
  const proof = Array.isArray(o.proof) ? (o.proof as unknown[]).map(s).filter(Boolean) : [];
  const tiers = Array.isArray(o.tiers)
    ? (o.tiers as Record<string, unknown>[]).map((t) => ({ name: s(t?.name), price: s(t?.price), scope: s(t?.scope) }))
    : [];
  const out: SheetData = {
    headline: s(o.headline),
    promise: s(o.promise),
    proof: proof.map((x) => `• ${x}`).join("\n"),
    price_sentence: s(o.price_sentence),
    tiers: tiers.some((t) => t.name || t.price || t.scope) ? tiers : [],
    guarantee: s(o.guarantee),
    cta: s(o.cta),
  };
  // Only what the record actually holds: an empty field never blanks the page.
  return Object.fromEntries(Object.entries(out).filter(([, v]) => (Array.isArray(v) ? v.length : v)));
}

// The page's sections merged onto the stored offer. Empty page fields keep
// what the record had, the same rule the Offer-Builder Agent saves by.
export function recordFromPage(d: SheetData, p: ProfileData): Record<string, unknown> | null {
  const prev = p.offer_record && typeof p.offer_record === "object" ? (p.offer_record as Record<string, unknown>) : {};
  const next: Record<string, unknown> = { ...prev };
  let changed = false;
  for (const k of PAGE_KEYS) {
    let v: unknown;
    if (k === "proof") {
      const lines = s(d.proof).split("\n").map((x) => x.replace(/^\s*[•\-*]\s*/, "").trim()).filter(Boolean);
      v = lines.length ? lines : null;
    } else if (k === "tiers") {
      const rows = (Array.isArray(d.tiers) ? (d.tiers as TableRow[]) : []).map((t, i) => ({
        name: s(t?.name).trim(),
        price: s(t?.price).trim(),
        scope: s(t?.scope).trim(),
        default: i === 1,
      }));
      v = rows.some((t) => t.name || t.price || t.scope) ? rows : null;
    } else {
      v = s(d[k]).trim() || null;
    }
    if (v === null) continue;
    if (JSON.stringify(v) !== JSON.stringify(prev[k])) changed = true;
    next[k] = v;
  }
  if (!changed) return null;
  next.updated_at = new Date().toISOString();
  return next;
}

export const onePageOffer: WorksheetDef = {
  assetId: "one-page-offer",
  exports: ["pdf", "docx"],
  dense: true, // one page
  reads: ["offer_record"],
  initial: pageFromRecord,
  live: pageFromRecord,
  writes: [{ key: "offer_record", from: (d, p) => recordFromPage(d, p) }],
  sections: [
    {
      title: "1 · Headline",
      intro: "The dream outcome in one line, in your buyer's words. Fails when it names your method instead of their result.",
      blocks: [{ kind: "fields", fields: [{ key: "headline", label: "Headline", type: "text" }] }],
    },
    {
      title: "2 · Promise",
      intro: "Two or three sentences you would still defend to a customer six months after the sale. Fails when it promises what you do not control.",
      blocks: [{ kind: "fields", fields: [{ key: "promise", label: "Promise", type: "textarea", lines: 3 }] }],
    },
    {
      title: "3 · Proof",
      intro: "Client results with numbers if you have them. If not, how you work, your own history with the problem, and relevant experience. Fails when it is vague or cannot be backed up.",
      blocks: [{ kind: "fields", fields: [{ key: "proof", label: "Proof", type: "textarea", lines: 4 }] }],
    },
    {
      title: "4 · Price and tiers",
      intro: "One price sentence with an anchor, then three tiers with the middle one marked as the default. Fails when the price stands alone with nothing to compare it to.",
      blocks: [
        { kind: "fields", fields: [{ key: "price_sentence", label: "Price sentence", type: "textarea", lines: 2 }] },
        {
          kind: "table",
          table: {
            key: "tiers",
            minRows: 3,
            maxRows: 3,
            rowLabels: ["Tier 1", "Tier 2 (default)", "Tier 3"],
            columns: [
              { key: "name", label: "Name", type: "text", width: 1.2 },
              { key: "price", label: "Price", type: "text", width: 0.8 },
              { key: "scope", label: "What is included", type: "text", width: 3 },
            ],
          },
        },
      ],
    },
    {
      title: "5 · Guarantee",
      intro: "What happens if it does not work, and the condition attached. Fails when it is vague (\"satisfaction guaranteed\") or one you could not afford to honor.",
      blocks: [{ kind: "fields", fields: [{ key: "guarantee", label: "Guarantee", type: "textarea", lines: 2 }] }],
    },
    {
      title: "6 · Call to action",
      intro: "One action, one next step, stated plainly. Fails when it offers two choices or asks for nothing.",
      blocks: [{ kind: "fields", fields: [{ key: "cta", label: "Call to action", type: "text" }] }],
    },
  ],
};

export const course05Worksheets = [onePageOffer];
