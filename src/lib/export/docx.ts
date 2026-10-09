// RenderDoc -> editable DOCX on the worksheet layout standard. Word has no
// form fields worth relying on, so blank fields become underlined space the
// member types into.

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
} from "docx";
import { BRAND } from "@/lib/brand";
import type { DocBlock, DocTable, RenderDoc } from "@/lib/docs/types";

const FONT = "Montserrat";
const hx = (h: string) => h.replace("#", "").toUpperCase();
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const RULE = { style: BorderStyle.SINGLE, size: 4, color: "D9DCDF" };

async function img(rel: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(process.cwd(), rel));
  } catch {
    return null;
  }
}

function run(text: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean; caps?: boolean } = {}) {
  return new TextRun({
    text,
    font: FONT,
    bold: o.bold,
    italics: o.italics,
    allCaps: o.caps,
    size: (o.size ?? 10) * 2,
    color: o.color ? hx(o.color) : hx(BRAND.ink),
    characterSpacing: o.caps ? 40 : undefined,
  });
}

function p(children: TextRun[], spacingAfter = 120) {
  return new Paragraph({ children, spacing: { after: spacingAfter } });
}

function table(t: DocTable): Table {
  const n = t.headers.length;
  const rel = t.widths && t.widths.length === n ? t.widths : Array(n).fill(1);
  const sum = rel.reduce((a, b) => a + b, 0);
  const pct = rel.map((w) => Math.round((w / sum) * 100));
  const boxes = new Set(t.checkboxCols ?? []);
  const cell = (text: string, i: number, fill?: string, header = false) =>
    new TableCell({
      width: { size: pct[i], type: WidthType.PERCENTAGE },
      shading: fill ? { type: ShadingType.CLEAR, color: "auto", fill } : undefined,
      borders: { top: RULE, bottom: RULE, left: RULE, right: RULE },
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: text.split("\n").map((ln) =>
        new Paragraph({
          children: [
            header
              ? run(ln, { bold: true, size: 8, color: BRAND.offWhite, caps: true })
              : run(boxes.has(i) ? (ln === "true" ? "☒" : "☐") : ln, { size: 9 }),
          ],
        }),
      ),
    });
  const rows = [
    new TableRow({ tableHeader: true, children: t.headers.map((h, i) => cell(h, i, hx(BRAND.black), true)) }),
    ...t.rows.map(
      (row, r) =>
        new TableRow({
          children: row.map((v, i) =>
            cell(v, i, t.highlightFrom !== undefined && r >= t.highlightFrom ? "F9FFD6" : r % 2 ? "F9FFFD" : undefined),
          ),
        }),
    ),
  ];
  if (t.totalRow) rows.push(new TableRow({ children: t.totalRow.map((v, i) => cell(v, i, "E2FFF7")) }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

function blank(lines = 1): Paragraph[] {
  return Array.from({ length: lines }, () =>
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "9AA0A6" } }, spacing: { after: 160 }, children: [run(" ")] }),
  );
}

function blockToDocx(b: DocBlock): (Paragraph | Table)[] {
  switch (b.type) {
    case "heading":
      return [new Paragraph({ spacing: { before: 240, after: 120 }, children: [run(b.text, { bold: true, size: 13 })] })];
    case "subheading":
      return [new Paragraph({ spacing: { before: 120, after: 80 }, children: [run(b.text, { bold: true, size: 10.5 })] })];
    case "paragraph":
      return [p([run(b.text, { size: 10, color: b.tone === "muted" ? BRAND.grey : b.tone === "accent" ? BRAND.teal : BRAND.ink, bold: b.tone === "accent" })])];
    case "bullets":
      return b.items.map((it, i) =>
        p([run(b.style === "numbered" ? `${i + 1}.  ` : b.style === "checkbox" ? "☐  " : "•  ", { bold: true, color: BRAND.teal }), run(it)], 80),
      );
    case "kv":
      return b.items.map((it) => p([run(it.label.toUpperCase() + "   ", { size: 8, bold: true, color: BRAND.grey }), run(it.value || "—")], 80));
    case "fields":
      return b.fields.flatMap((f) => {
        if (f.kind === "checkbox") return [p([run(f.value === "true" ? "☒  " : "☐  "), run(f.label)], 80)];
        const label = p([run(f.label, { size: 8, bold: true, color: BRAND.grey, caps: true })], 40);
        if (f.value) return [label, p([run(f.value)], 160)];
        return [label, ...blank(f.kind === "multiline" ? Math.max(2, f.lines ?? 3) : f.kind === "signature" ? 2 : 1)];
      });
    case "table":
      return [table(b.table), new Paragraph({ children: [] })];
    case "callout": {
      const fill = b.tone === "warning" ? "FFF6DB" : b.tone === "legal" ? "F2F3F4" : "E9FFF9";
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  shading: { type: ShadingType.CLEAR, color: "auto", fill },
                  borders: { top: NONE, bottom: NONE, right: NONE, left: { style: BorderStyle.SINGLE, size: 18, color: b.tone === "warning" ? "D9A300" : b.tone === "legal" ? "1A1A1A" : hx(BRAND.mint) } },
                  margins: { top: 120, bottom: 120, left: 200, right: 200 },
                  children: [
                    ...(b.title ? [p([run(b.title, { bold: true })], 60)] : []),
                    new Paragraph({ children: [run(b.text, { size: 9.5 })] }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new Paragraph({ children: [] }),
      ];
    }
    case "big":
      return [
        p([run(b.label, { size: 8, bold: true, color: BRAND.grey, caps: true })], 40),
        p([run(b.value, { size: 26, bold: true, color: BRAND.teal })], 60),
        ...(b.note ? [p([run(b.note, { size: 9, color: BRAND.grey })])] : []),
      ];
    case "pageBreak":
      return [new Paragraph({ pageBreakBefore: true, children: [] })];
  }
}

export async function renderDocx(rd: RenderDoc): Promise<Uint8Array> {
  const logo = await img("public/brand/lf_horizontal_bright_transparent.png");
  const bar = await img("public/brand/accent_bar.png");

  const header = new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            height: { value: 1100, rule: "atLeast" },
            children: [
              new TableCell({
                shading: { type: ShadingType.CLEAR, color: "auto", fill: hx(BRAND.black) },
                borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
                margins: { top: 120, bottom: 120, left: 200, right: 200 },
                children: [
                  new Paragraph({
                    children: logo
                      ? [new ImageRun({ type: "png", data: logo, transformation: { width: 175, height: 50 } })]
                      : [run("LATE FOUNDERS", { bold: true, color: BRAND.mint, size: 14 })],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: 9600 }],
        children: [
          run("latefounders.com", { size: 8, color: BRAND.grey }),
          new TextRun({ children: ["\tPage ", PageNumber.CURRENT], font: FONT, size: 16, color: hx(BRAND.grey) }),
        ],
      }),
    ],
  });

  const neutral = rd.template === "neutral";
  const children: (Paragraph | Table)[] = [
    p([run(rd.eyebrow, { size: 8, bold: true, color: BRAND.grey, caps: true })], 80),
    new Paragraph({ spacing: { after: 100 }, children: [run(rd.title, { size: 24, bold: true })] }),
    new Paragraph({
      spacing: { after: 160 },
      alignment: AlignmentType.LEFT,
      children: bar && !neutral ? [new ImageRun({ type: "png", data: bar, transformation: { width: 165, height: 8 } })] : [],
    }),
    p([run(rd.purpose, { bold: true, color: BRAND.teal })], 200),
    ...rd.blocks.flatMap(blockToDocx),
  ];

  const doc = new Document({
    creator: "Late Founders",
    title: rd.title,
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1500, bottom: 900, left: 880, right: 880, header: 0 } } },
        headers: neutral ? undefined : { default: header },
        footers: neutral ? undefined : { default: footer },
        children,
      },
    ],
  });
  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}
