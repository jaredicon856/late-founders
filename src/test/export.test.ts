import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { ASSETS } from "@/content/catalog";
import { getWorksheet } from "@/content/registry";
import { worksheetToDoc } from "@/lib/docs/fromWorksheet";
import { renderDocx } from "@/lib/export/docx";
import { FIELD, renderPdf, wrap } from "@/lib/export/pdf";
import { renderXlsx } from "@/lib/export/xlsx";

const sheets = ASSETS.filter((a) => getWorksheet(a.id)).map((a) => [a.id, a, getWorksheet(a.id)!] as const);

describe("exports", () => {
  it.each(sheets)("%s exports to every listed format", async (_id, asset, def) => {
    const doc = worksheetToDoc(asset, def, { ...(def.initial?.({}) ?? {}), ...(def.live?.({}) ?? {}) }, {});
    const pdf = await renderPdf(doc);
    const parsed = await PDFDocument.load(pdf);
    expect(parsed.getPageCount()).toBeGreaterThan(0);
    if (!def.readOnly && def.sections.some((s) => s.blocks.some((b) => b.kind === "fields" || b.kind === "table"))) {
      expect(parsed.getForm().getFields().length).toBeGreaterThan(0); // fillable
    }
    if (def.exports.includes("docx")) expect((await renderDocx(doc)).length).toBeGreaterThan(1000);
    if (def.exports.includes("xlsx")) expect((await renderXlsx(doc)).length).toBeGreaterThan(1000);
  }, 30_000);

  it.each(["hidden-assets-inventory", "name-candidates", "entity-setup-checklist", "role-scorecard"])(
    "%s fits on one page, as the spec requires",
    async (id) => {
      const asset = ASSETS.find((a) => a.id === id)!;
      const def = getWorksheet(id)!;
      const pdf = await PDFDocument.load(await renderPdf(worksheetToDoc(asset, def, def.initial?.({}) ?? {}, {})));
      expect(pdf.getPageCount()).toBe(1);
    },
  );

  it("makes table cells tall enough that typed text is not clipped", () => {
    for (const [font, row] of [[FIELD.font, FIELD.row], [FIELD.denseFont, FIELD.denseRow]]) {
      expect(row - FIELD.inset * 2).toBeGreaterThanOrEqual(font * 1.25 + 3);
    }
  });

  it("keeps a filled-in Hidden Assets Inventory on one page", async () => {
    const asset = ASSETS.find((a) => a.id === "hidden-assets-inventory")!;
    const def = getWorksheet(asset.id)!;
    const row = (i: number) => ({ name: `Person ${i}`, source: "Former colleague at a large agency", ask: "An introduction to their head of operations" });
    const data = {
      experience: Array.from({ length: 5 }, () => ({ skill: "Enterprise sales", outcome: "Closed $400k in new contracts in 2024" })),
      network: Array.from({ length: 20 }, (_, i) => row(i)),
      top_five: Array.from({ length: 5 }, (_, i) => row(i)),
      runway_months: 8,
      financial_standing: 40000,
      judgment: "I can tell within one call whether a client will churn in six months.",
    };
    const pdf = await PDFDocument.load(await renderPdf(worksheetToDoc(asset, def, data, {})));
    expect(pdf.getPageCount()).toBe(1);
  });

  it("wraps long words without losing characters", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont("Helvetica");
    const lines = wrap("a ".repeat(50) + "x".repeat(300), font, 10, 200);
    expect(lines.join("").replace(/\s/g, "")).toBe("a".repeat(50) + "x".repeat(300));
  });
});
