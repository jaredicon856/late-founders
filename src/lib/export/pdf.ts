// RenderDoc -> branded, fillable PDF (Part 3 worksheet layout standard):
// black header band with the horizontal logo, grey letterspaced eyebrow,
// Montserrat Black title, mint-to-lime accent bar, teal purpose line, body
// with black table headers and 4% mint row fill, footer with latefounders.com
// and the page number. Every field and table cell is a real AcroForm field.

import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
  type RGB,
} from "pdf-lib";
import { BRAND } from "@/lib/brand";
import type { DocBlock, DocField, DocTable, RenderDoc } from "@/lib/docs/types";

const PAGE_W = 612; // US Letter
const PAGE_H = 792;
const MARGIN = 44;
const BAND_H = 68; // ~90px
const FOOTER_H = 34;
const CONTENT_W = PAGE_W - MARGIN * 2;

function hex(h: string): RGB {
  const n = parseInt(h.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
function mix(a: string, b: string, t: number): RGB {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = (s: number) => (((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t) / 255;
  return rgb(c(16), c(8), c(0));
}

const C = {
  black: hex(BRAND.black),
  ink: hex(BRAND.ink),
  grey: hex(BRAND.grey),
  offWhite: hex(BRAND.offWhite),
  teal: hex(BRAND.teal),
  white: rgb(1, 1, 1),
  rowFill: mix("#FFFFFF", BRAND.mint, 0.04),
  highlight: mix("#FFFFFF", BRAND.lime, 0.35),
  rule: hex("#D9DCDF"),
  noteFill: mix("#FFFFFF", BRAND.mint, 0.1),
  warnFill: hex("#FFF6DB"),
  warnRule: hex("#D9A300"),
  legalFill: hex("#F2F3F4"),
};

interface Fonts {
  regular: PDFFont;
  semibold: PDFFont;
  bold: PDFFont;
  black: PDFFont;
  standard: boolean; // fell back to Helvetica (fonts not installed)
}

async function loadFile(rel: string): Promise<Uint8Array | null> {
  try {
    return await readFile(path.join(process.cwd(), rel));
  } catch {
    return null;
  }
}

async function loadFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const files = await Promise.all(
    ["400Regular", "600SemiBold", "700Bold", "900Black"].map((w) => loadFile(`src/fonts/Montserrat-${w}.ttf`)),
  );
  if (files.every(Boolean)) {
    const [r, s, b, k] = files as Uint8Array[];
    return {
      // Regular is embedded whole so members can type any character into fields.
      regular: await doc.embedFont(r, { subset: false }),
      semibold: await doc.embedFont(s, { subset: true }),
      bold: await doc.embedFont(b, { subset: true }),
      black: await doc.embedFont(k, { subset: true }),
      standard: false,
    };
  }
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { regular: reg, semibold: bold, bold, black: bold, standard: true };
}

// Characters neither Montserrat nor WinAnsi Helvetica render reliably.
const REPLACE: Record<string, string> = {
  "≥": ">=", "≤": "<=", "→": "->", "←": "<-", "✓": "x", "✔": "x", "✗": "x", "×": "x",
  " ": " ", " ": " ", "​": "",
};
export function clean(s: string): string {
  return s.replace(/[≥≤→←✓✔✗×  ​]/g, (c) => REPLACE[c] ?? "").replace(/\t/g, "  ");
}

export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of clean(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= width) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      // Hard-break a single word longer than the line.
      let word = w;
      while (font.widthOfTextAtSize(word, size) > width && word.length > 1) {
        let i = word.length - 1;
        while (i > 1 && font.widthOfTextAtSize(word.slice(0, i), size) > width) i--;
        out.push(word.slice(0, i));
        word = word.slice(i);
      }
      line = word;
    }
    out.push(line);
  }
  return out;
}

// Table-cell form fields. Montserrat's line box is ~1.22em, and pdf-lib pads
// text by about 3pt inside a field, so a cell box must be at least
// font * 1.25 + 3 tall or typed text gets clipped (checked in tests).
export const FIELD = { font: 8.5, row: 18, denseFont: 7, denseRow: 14, inset: 1 } as const;

// Left half holds the first rows, right half the rest, side by side.
function twoUp(t: DocTable): DocTable {
  const cols = t.headers.length;
  const half = Math.ceil(t.rows.length / 2);
  const blank = Array<string>(cols).fill("");
  const shift = (xs?: number[]) => (xs ? [...xs, ...xs.map((i) => i + cols)] : undefined);
  return {
    ...t,
    twoUp: false,
    headers: [...t.headers, ...t.headers],
    widths: t.widths ? [...t.widths, ...t.widths] : undefined,
    checkboxCols: shift(t.checkboxCols),
    staticCols: shift(t.staticCols),
    rows: Array.from({ length: half }, (_, i) => [...t.rows[i], ...(t.rows[half + i] ?? blank)]),
    highlightFrom: undefined,
    totalRow: undefined,
  };
}

class Writer {
  page!: PDFPage;
  y = 0;
  pageNo = 0;
  private names = new Map<string, number>();

  constructor(
    public doc: PDFDocument,
    public f: Fonts,
    public logo: PDFImage | null,
    public rd: RenderDoc,
  ) {}

  get dense() {
    return !!this.rd.dense;
  }

  fieldName(base: string): string {
    const safe = base.replace(/[^A-Za-z0-9_-]/g, "_") || "field";
    const n = this.names.get(safe) ?? 0;
    this.names.set(safe, n + 1);
    return n ? `${safe}_${n}` : safe;
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pageNo++;
    const p = this.page;
    const neutral = this.rd.template === "neutral";
    if (neutral) {
      p.drawLine({ start: { x: MARGIN, y: PAGE_H - BAND_H + 10 }, end: { x: PAGE_W - MARGIN, y: PAGE_H - BAND_H + 10 }, thickness: 1, color: C.ink });
    } else {
      p.drawRectangle({ x: 0, y: PAGE_H - BAND_H, width: PAGE_W, height: BAND_H, color: C.black });
    }
    if (neutral) {
      // No Late Founders mark on a member-branded document.
    } else if (this.logo) {
      // The PNG carries transparent padding; scale by height and crop visually.
      const h = 46;
      const w = (this.logo.width / this.logo.height) * h;
      p.drawImage(this.logo, { x: MARGIN - w * 0.035, y: PAGE_H - BAND_H / 2 - h / 2, width: w, height: h });
    } else {
      p.drawText("LATE FOUNDERS", { x: MARGIN, y: PAGE_H - BAND_H / 2 - 5, size: 14, font: this.f.black, color: hex(BRAND.mint) });
    }
    if (!neutral) p.drawText("latefounders.com", { x: MARGIN, y: 20, size: 7.5, font: this.f.regular, color: C.grey });
    const pn = `Page ${this.pageNo}`;
    p.drawText(pn, {
      x: PAGE_W - MARGIN - this.f.regular.widthOfTextAtSize(pn, 7.5),
      y: 20,
      size: 7.5,
      font: this.f.regular,
      color: C.grey,
    });
    this.y = PAGE_H - BAND_H - (this.dense ? 20 : 26);
    if (this.pageNo > 1) {
      this.spaced(this.rd.eyebrow + "  ·  " + this.rd.title.toUpperCase(), MARGIN, this.y, 7, C.grey);
      this.y -= 18;
    }
  }

  ensure(h: number) {
    if (this.y - h < FOOTER_H + 12) this.newPage();
  }

  spaced(text: string, x: number, y: number, size: number, color: RGB, track = 1.4) {
    let cx = x;
    for (const ch of clean(text)) {
      this.page.drawText(ch, { x: cx, y, size, font: this.f.semibold, color });
      cx += this.f.semibold.widthOfTextAtSize(ch, size) + track;
    }
  }

  lines(text: string, opts: { size: number; font?: PDFFont; color?: RGB; x?: number; width?: number; leading?: number }) {
    const font = opts.font ?? this.f.regular;
    const x = opts.x ?? MARGIN;
    const width = opts.width ?? CONTENT_W;
    const lead = opts.leading ?? opts.size * 1.4;
    for (const ln of wrap(text, font, opts.size, width)) {
      this.ensure(lead);
      this.page.drawText(ln, { x, y: this.y - opts.size, size: opts.size, font, color: opts.color ?? C.ink });
      this.y -= lead;
    }
  }

  accentBar(x: number, y: number) {
    const w = 165; // 220px
    const h = 7.5; // 10px
    const r = h / 2;
    const steps = 60;
    const inner = w - h;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      this.page.drawRectangle({
        x: x + r + (inner * i) / steps,
        y,
        width: inner / steps + 0.6,
        height: h,
        color: mix(BRAND.mint, BRAND.lime, t),
      });
    }
    this.page.drawCircle({ x: x + r, y: y + r, size: r, color: hex(BRAND.mint) });
    this.page.drawCircle({ x: x + w - r, y: y + r, size: r, color: hex(BRAND.lime) });
  }

  titleBlock() {
    this.spaced(this.rd.eyebrow, MARGIN, this.y - 8, 7.5, C.grey);
    this.y -= 22;
    const size = this.dense ? 20 : this.rd.title.length > 34 ? 20 : 24;
    for (const ln of wrap(this.rd.title, this.f.black, size, CONTENT_W)) {
      this.page.drawText(ln, { x: MARGIN, y: this.y - size, size, font: this.f.black, color: C.ink });
      this.y -= size * 1.15;
    }
    this.y -= 6;
    if (this.rd.template !== "neutral") {
      this.accentBar(MARGIN, this.y - 7.5);
      this.y -= 7.5 + 12;
    } else this.y -= 6;
    this.lines(this.rd.purpose, { size: 10, font: this.f.semibold, color: C.teal });
    if (this.rd.meta?.member || this.rd.meta?.completedAt) {
      const bits = [this.rd.meta.member, this.rd.meta.completedAt && `Completed ${this.rd.meta.completedAt}`,
        this.rd.meta.version && `Version ${this.rd.meta.version}`].filter(Boolean);
      this.lines(bits.join("  ·  "), { size: 7.5, color: C.grey });
    }
    this.y -= this.dense ? 4 : 8;
  }

  label(text: string, x: number, y: number) {
    this.spaced(text.toUpperCase(), x, y, 6.5, C.grey, 0.8);
  }

  textField(name: string, value: string, x: number, y: number, w: number, h: number, multiline: boolean) {
    const form = this.doc.getForm();
    const tf = form.createTextField(this.fieldName(name));
    if (multiline) tf.enableMultiline();
    // addToPage writes the field's default appearance (font); size and text
    // can only be set after it exists.
    tf.addToPage(this.page, {
      x, y, width: w, height: h,
      font: this.f.regular,
      textColor: C.ink,
      backgroundColor: C.white,
      borderColor: C.rule,
      borderWidth: 0.6,
    });
    tf.setFontSize(this.dense ? FIELD.denseFont : FIELD.font);
    if (value) tf.setText(clean(value));
  }

  checkBox(name: string, checked: boolean, x: number, y: number, s: number) {
    const cb = this.doc.getForm().createCheckBox(this.fieldName(name));
    cb.addToPage(this.page, { x, y, width: s, height: s, borderColor: C.ink, borderWidth: 0.8, backgroundColor: C.white });
    if (checked) cb.check();
  }

  // ---- blocks ----

  heading(text: string) {
    this.ensure(40);
    const size = this.dense ? 10.5 : 12;
    this.y -= this.dense ? 4 : 10;
    for (const ln of wrap(text, this.f.bold, size, CONTENT_W)) {
      this.page.drawText(ln, { x: MARGIN, y: this.y - size, size, font: this.f.bold, color: C.ink });
      this.y -= size + 2.5;
    }
    this.y -= this.dense ? 1 : 4;
  }

  subheading(text: string) {
    this.ensure(30);
    this.y -= 4;
    this.lines(text, { size: 9.5, font: this.f.bold });
    this.y -= 2;
  }

  fields(fields: DocField[]) {
    const gap = 10;
    const unit = (w?: DocField["width"]) => (w === "half" ? 0.5 : w === "third" ? 1 / 3 : 1);
    let row: DocField[] = [];
    let used = 0;
    const flush = () => {
      if (!row.length) return;
      const lineH = this.dense ? 11 : 13;
      const heights = row.map((f) =>
        f.kind === "signature" ? 34 : f.kind === "checkbox" ? 12 : f.kind === "multiline" ? Math.max(2, f.lines ?? 3) * lineH + 4 : this.dense ? 15 : 18,
      );
      const h = Math.max(...heights);
      this.ensure(h + 18);
      let x = MARGIN;
      const total = row.reduce((s, f) => s + unit(f.width), 0);
      const widths = row.map((f) => ((CONTENT_W - gap * (row.length - 1)) * unit(f.width)) / Math.max(total, 1));
      row.forEach((f, i) => {
        const w = widths[i];
        if (f.kind === "checkbox") {
          this.checkBox(f.name, f.value === "true", x, this.y - 11, 9);
          this.page.drawText(clean(f.label), { x: x + 14, y: this.y - 10, size: 8.5, font: this.f.regular, color: C.ink });
        } else {
          this.label(f.label, x, this.y - 7);
          const top = this.y - 11;
          if (f.kind === "signature") {
            this.page.drawLine({ start: { x, y: top - 30 }, end: { x: x + w, y: top - 30 }, thickness: 0.8, color: C.ink });
            if (f.value) this.page.drawText(clean(f.value), { x, y: top - 42, size: 7, font: this.f.regular, color: C.grey });
          } else {
            this.textField(f.name, f.value, x, top - heights[i], w, heights[i], f.kind === "multiline");
          }
        }
        x += w + gap;
      });
      this.y -= h + (row.some((f) => f.kind !== "checkbox") ? 11 : 0) + (this.dense ? 5 : 8);
      for (const f of row) if (f.hint) this.lines(f.hint, { size: 7, color: C.grey, leading: 9 });
      row = [];
      used = 0;
    };
    for (const f of fields) {
      const u = unit(f.width);
      if (used + u > 1.001) flush();
      row.push(f);
      used += u;
    }
    flush();
  }

  table(input: DocTable) {
    const t = input.twoUp ? twoUp(input) : input;
    const n = t.headers.length;
    const rel = t.widths && t.widths.length === n ? t.widths : Array(n).fill(1);
    const sum = rel.reduce((a, b) => a + b, 0);
    const widths = rel.map((w) => (w / sum) * CONTENT_W);
    const size = this.dense ? 7 : 8;
    const pad = 3;
    const minRow = this.dense ? FIELD.denseRow : FIELD.row;
    const staticCols = new Set(t.staticCols ?? []);
    const boxCols = new Set(t.checkboxCols ?? []);

    const drawHeader = () => {
      const hl = t.headers.map((h, i) => wrap(h.toUpperCase(), this.f.semibold, 6.5, widths[i] - pad * 2));
      const hh = Math.max(this.dense ? 12 : 14, Math.max(...hl.map((l) => l.length)) * 8 + (this.dense ? 4 : 6));
      this.ensure(hh + minRow);
      this.page.drawRectangle({ x: MARGIN, y: this.y - hh, width: CONTENT_W, height: hh, color: C.black });
      let x = MARGIN;
      hl.forEach((lines, i) => {
        lines.forEach((ln, j) =>
          this.page.drawText(ln, { x: x + pad, y: this.y - 9 - j * 8, size: 6.5, font: this.f.semibold, color: C.offWhite }),
        );
        x += widths[i];
      });
      this.y -= hh;
    };

    drawHeader();
    t.rows.forEach((row, r) => {
      const wrapped = row.map((cell, i) =>
        staticCols.has(i) || !t.fillable ? wrap(cell, this.f.regular, size, widths[i] - pad * 2) : [cell],
      );
      const lineCount = (i: number) =>
        staticCols.has(i) || !t.fillable
          ? wrapped[i].length
          : this.dense
            ? 1 // one-page sheets: cells never grow; the full text stays in the field
            : Math.min(4, Math.ceil(this.f.regular.widthOfTextAtSize(clean(row[i] || ""), size) / (widths[i] - 6)) || 1);
      const h = Math.max(minRow, ...row.map((_, i) => lineCount(i) * (size + 2.5) + 5));
      if (this.y - h < FOOTER_H + 12) {
        this.newPage();
        drawHeader();
      }
      const fill = t.highlightFrom !== undefined && r >= t.highlightFrom ? C.highlight : r % 2 ? C.rowFill : C.white;
      this.page.drawRectangle({ x: MARGIN, y: this.y - h, width: CONTENT_W, height: h, color: fill });
      this.page.drawLine({ start: { x: MARGIN, y: this.y - h }, end: { x: MARGIN + CONTENT_W, y: this.y - h }, thickness: 0.4, color: C.rule });
      let x = MARGIN;
      row.forEach((cell, i) => {
        const w = widths[i];
        if (boxCols.has(i)) {
          const s = 8;
          this.checkBox(`${t.name ?? "t"}_${r}_${i}`, cell === "true", x + (w - s) / 2, this.y - h / 2 - s / 2, s);
        } else if (t.fillable && t.name && !staticCols.has(i)) {
          const inset = FIELD.inset;
          this.textField(`${t.name}_${r}_${i}`, cell, x + inset, this.y - h + inset, w - inset * 2, h - inset * 2, h > minRow);
        } else {
          wrapped[i].forEach((ln, j) =>
            this.page.drawText(ln, { x: x + pad, y: this.y - size - 3 - j * (size + 2.5), size, font: this.f.regular, color: C.ink }),
          );
        }
        x += w;
      });
      this.y -= h;
    });
    if (t.totalRow) {
      const h = minRow;
      this.ensure(h);
      this.page.drawRectangle({ x: MARGIN, y: this.y - h, width: CONTENT_W, height: h, color: mix("#FFFFFF", BRAND.mint, 0.18) });
      let x = MARGIN;
      t.totalRow.forEach((cell, i) => {
        if (cell) this.page.drawText(clean(cell), { x: x + pad, y: this.y - size - 4, size, font: this.f.bold, color: C.ink });
        x += widths[i];
      });
      this.y -= h;
    }
    this.y -= this.dense ? 6 : 10;
  }

  bullets(items: string[], style: "bullet" | "numbered" | "checkbox" = "bullet") {
    items.forEach((item, i) => {
      const indent = 16;
      const lines = wrap(item, this.f.regular, 9, CONTENT_W - indent);
      this.ensure(lines.length * 13 + 2);
      const top = this.y;
      if (style === "checkbox") {
        this.checkBox(`check_${i}`, false, MARGIN, top - 10, 8);
      } else {
        const mark = style === "numbered" ? `${i + 1}.` : "•";
        this.page.drawText(mark, { x: MARGIN + 2, y: top - 9, size: 9, font: this.f.bold, color: C.teal });
      }
      lines.forEach((ln, j) => this.page.drawText(ln, { x: MARGIN + indent, y: top - 9 - j * 13, size: 9, font: this.f.regular, color: C.ink }));
      this.y -= lines.length * 13 + 3;
    });
    this.y -= 4;
  }

  kv(items: { label: string; value: string }[]) {
    for (const it of items) {
      const lines = wrap(it.value || "—", this.f.regular, 9.5, CONTENT_W - 150);
      this.ensure(lines.length * 13 + 4);
      this.label(it.label, MARGIN, this.y - 8);
      lines.forEach((ln, j) => this.page.drawText(ln, { x: MARGIN + 150, y: this.y - 9 - j * 13, size: 9.5, font: this.f.regular, color: C.ink }));
      this.y -= lines.length * 13 + 5;
    }
    this.y -= 4;
  }

  callout(tone: "note" | "warning" | "legal", title: string | undefined, text: string) {
    const inner = CONTENT_W - 24;
    const lines = wrap(text, this.f.regular, 8.5, inner);
    const h = lines.length * 12 + (title ? 16 : 0) + 14;
    this.ensure(h + 6);
    const fill = tone === "warning" ? C.warnFill : tone === "legal" ? C.legalFill : C.noteFill;
    const bar = tone === "warning" ? C.warnRule : tone === "legal" ? C.ink : hex(BRAND.mint);
    this.page.drawRectangle({ x: MARGIN, y: this.y - h, width: CONTENT_W, height: h, color: fill });
    this.page.drawRectangle({ x: MARGIN, y: this.y - h, width: 3, height: h, color: bar });
    let y = this.y - 8;
    if (title) {
      this.page.drawText(clean(title), { x: MARGIN + 14, y: y - 9, size: 9, font: this.f.bold, color: C.ink });
      y -= 16;
    }
    lines.forEach((ln, j) => this.page.drawText(ln, { x: MARGIN + 14, y: y - 9 - j * 12, size: 8.5, font: this.f.regular, color: C.ink }));
    this.y -= h + 10;
  }

  big(label: string, value: string, note?: string) {
    this.ensure(64);
    this.label(label, MARGIN, this.y - 8);
    this.page.drawText(clean(value), { x: MARGIN, y: this.y - 40, size: 28, font: this.f.black, color: C.teal });
    this.y -= 48;
    if (note) this.lines(note, { size: 8.5, color: C.grey });
    this.y -= 6;
  }

  paragraph(text: string, tone?: "muted" | "accent") {
    this.lines(text, {
      size: this.dense ? 8.5 : 9,
      color: tone === "muted" ? C.grey : tone === "accent" ? C.teal : C.ink,
      font: tone === "accent" ? this.f.semibold : this.f.regular,
      leading: this.dense ? 11 : 13,
    });
    this.y -= this.dense ? 3 : 5;
  }

  block(b: DocBlock) {
    switch (b.type) {
      case "heading": return this.heading(b.text);
      case "subheading": return this.subheading(b.text);
      case "paragraph": return this.paragraph(b.text, b.tone);
      case "bullets": return this.bullets(b.items, b.style);
      case "kv": return this.kv(b.items);
      case "fields": return this.fields(b.fields);
      case "table": return this.table(b.table);
      case "callout": return this.callout(b.tone, b.title, b.text);
      case "big": return this.big(b.label, b.value, b.note);
      case "pageBreak": return this.newPage();
    }
  }
}

export async function renderPdf(rd: RenderDoc): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${rd.title} · Late Founders`);
  doc.setAuthor("Late Founders");
  doc.setCreator("Late Founders Command Center");
  const fonts = await loadFonts(doc);
  const logoBytes = await loadFile("public/brand/lf_horizontal_bright_transparent.png");
  const logo = logoBytes ? await doc.embedPng(logoBytes) : null;

  const w = new Writer(doc, fonts, logo, rd);
  w.newPage();
  w.titleBlock();
  for (const b of rd.blocks) w.block(b);

  const form = doc.getForm();
  if (form.getFields().length) form.updateFieldAppearances(fonts.regular);
  return doc.save();
}
