import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { ASSETS } from "@/content/catalog";
import { getWorksheet } from "@/content/registry";
import { worksheetToDoc } from "@/lib/docs/fromWorksheet";
import { renderDocx } from "@/lib/export/docx";
import { renderPdf, wrap } from "@/lib/export/pdf";
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

  it("wraps long words without losing characters", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont("Helvetica");
    const lines = wrap("a ".repeat(50) + "x".repeat(300), font, 10, 200);
    expect(lines.join("").replace(/\s/g, "")).toBe("a".repeat(50) + "x".repeat(300));
  });
});
