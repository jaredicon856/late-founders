// Course 05 worksheets. The One-Page Offer Template reads offer_record (written
// by the Offer-Builder Agent) to populate itself the first time it opens. It
// writes nothing back: the Offer-Builder Agent owns offer_record.

import type { ProfileData, SheetData, WorksheetDef } from "../types";

function fromOfferRecord(p: ProfileData): SheetData {
  const o = p.offer_record && typeof p.offer_record === "object" ? (p.offer_record as Record<string, unknown>) : null;
  if (!o) return {};
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  const proof = Array.isArray(o.proof) ? (o.proof as unknown[]).map(s).filter(Boolean) : [];
  const tiers = Array.isArray(o.tiers)
    ? (o.tiers as Record<string, unknown>[]).map((t) => ({
        name: s(t?.name),
        price: s(t?.price),
        scope: s(t?.scope),
        default: t?.default === true,
      }))
    : [];
  return {
    headline: s(o.headline),
    promise: s(o.promise),
    proof: proof.map((x) => `• ${x}`).join("\n"),
    price_sentence: s(o.price_sentence),
    tiers,
    guarantee: s(o.guarantee),
    cta: s(o.cta),
  };
}

export const onePageOffer: WorksheetDef = {
  assetId: "one-page-offer",
  exports: ["pdf", "docx"],
  dense: true, // one page
  reads: ["offer_record"],
  initial: fromOfferRecord,
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
      intro: "Specific results with numbers, from your own track record. Fails when it is adjectives, credentials or a list of years served.",
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
      intro: "What happens if it does not work, and the condition attached. Fails when it is vague (\"satisfaction guaranteed\") or one you could not afford to honour.",
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
