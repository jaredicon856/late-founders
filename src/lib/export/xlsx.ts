// RenderDoc -> XLSX. One "Summary" sheet with the header, fields and notes in
// reading order, plus one sheet per table so members can sort and extend rows.

import ExcelJS from "exceljs";
import { BRAND } from "@/lib/brand";
import type { DocBlock, DocTable, RenderDoc } from "@/lib/docs/types";

const argb = (h: string) => "FF" + h.replace("#", "").toUpperCase();
const FONT = "Montserrat";

function sheetName(base: string, used: Set<string>): string {
  let name = base.replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim() || "Sheet";
  let i = 2;
  while (used.has(name)) name = `${name.slice(0, 25)} ${i++}`;
  used.add(name);
  return name;
}

function cellValue(v: string, checkbox: boolean): string | number {
  if (checkbox) return v === "true" ? "Yes" : "";
  const n = v.replace(/[$,]/g, "");
  if (/^-?\d+(\.\d+)?$/.test(n) && n.length < 15) return Number(n);
  return v;
}

function writeTable(ws: ExcelJS.Worksheet, t: DocTable, startRow: number): number {
  const header = ws.getRow(startRow);
  t.headers.forEach((h, i) => {
    const c = header.getCell(i + 1);
    c.value = h;
    c.font = { name: FONT, bold: true, color: { argb: argb(BRAND.offWhite) }, size: 9 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(BRAND.black) } };
    c.alignment = { vertical: "middle", wrapText: true };
  });
  header.height = 22;
  const boxes = new Set(t.checkboxCols ?? []);
  t.rows.forEach((row, r) => {
    const xr = ws.getRow(startRow + 1 + r);
    row.forEach((v, i) => {
      const c = xr.getCell(i + 1);
      c.value = cellValue(v, boxes.has(i));
      c.font = { name: FONT, size: 9 };
      c.alignment = { vertical: "top", wrapText: true };
      const highlight = t.highlightFrom !== undefined && r >= t.highlightFrom;
      if (highlight || r % 2) {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: highlight ? "FFF9FFD6" : "FFF9FFFD" } };
      }
    });
  });
  let end = startRow + t.rows.length;
  if (t.totalRow) {
    end++;
    const tr = ws.getRow(end);
    t.totalRow.forEach((v, i) => {
      const c = tr.getCell(i + 1);
      c.value = cellValue(v, false);
      c.font = { name: FONT, bold: true, size: 9 };
    });
  }
  return end;
}

export async function renderXlsx(rd: RenderDoc): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Late Founders";
  const used = new Set<string>();
  const summary = wb.addWorksheet(sheetName("Summary", used), {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }, // Letter is the default paper size
  });
  summary.columns = [{ width: 34 }, { width: 60 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];

  let r = 1;
  const put = (a: string, b = "", style: Partial<ExcelJS.Font> = {}) => {
    const row = summary.getRow(r++);
    row.getCell(1).value = a;
    row.getCell(1).font = { name: FONT, size: 10, ...style };
    if (b) {
      row.getCell(2).value = b;
      row.getCell(2).font = { name: FONT, size: 10 };
      row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    }
  };

  const band = summary.getRow(r++);
  band.height = 30;
  for (let i = 1; i <= 6; i++) band.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(BRAND.black) } };
  band.getCell(1).value = "LATE FOUNDERS";
  band.getCell(1).font = { name: FONT, bold: true, size: 12, color: { argb: argb(BRAND.mint) } };
  put(rd.eyebrow, "", { size: 8, color: { argb: argb(BRAND.grey) }, bold: true });
  put(rd.title, "", { size: 18, bold: true });
  put(rd.purpose, "", { size: 10, color: { argb: argb(BRAND.teal) }, bold: true });
  r++;

  const tables: { title: string; table: DocTable }[] = [];
  let lastHeading = rd.title;

  const visit = (b: DocBlock) => {
    switch (b.type) {
      case "heading":
        lastHeading = b.text;
        r++;
        put(b.text, "", { bold: true, size: 12 });
        break;
      case "subheading":
        lastHeading = b.text;
        put(b.text, "", { bold: true });
        break;
      case "paragraph":
        put(b.text, "", { italic: b.tone === "muted", color: { argb: argb(b.tone === "muted" ? BRAND.grey : BRAND.ink) } });
        break;
      case "bullets":
        b.items.forEach((it, i) => put(b.style === "numbered" ? `${i + 1}. ${it}` : `• ${it}`));
        break;
      case "kv":
        b.items.forEach((it) => put(it.label, it.value, { bold: true }));
        break;
      case "fields":
        b.fields.forEach((f) =>
          put(f.label, f.kind === "checkbox" ? (f.value === "true" ? "Yes" : "No") : f.value, { bold: true }),
        );
        break;
      case "big":
        put(b.label, b.value, { bold: true });
        if (b.note) put(b.note, "", { italic: true, color: { argb: argb(BRAND.grey) } });
        break;
      case "callout":
        put(b.title ? `${b.title}: ${b.text}` : b.text, "", { italic: true });
        break;
      case "table":
        tables.push({ title: lastHeading, table: b.table });
        r = writeTable(summary, b.table, r) + 2;
        break;
      case "pageBreak":
        break;
    }
  };
  rd.blocks.forEach(visit);
  summary.getColumn(1).alignment = { wrapText: true, vertical: "top" };

  for (const { title, table } of tables) {
    const ws = wb.addWorksheet(sheetName(title, used));
    ws.columns = table.headers.map((h, i) => ({ width: Math.max(12, Math.min(48, (table.widths?.[i] ?? 1) * 18, h.length + 4)) }));
    writeTable(ws, table, 1);
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}
