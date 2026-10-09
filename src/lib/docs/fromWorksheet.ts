import type { AssetDef, Block, Computed, FieldDef, ProfileData, SheetData, TableRow, WorksheetDef } from "@/content/types";
import { eyebrowFor } from "@/content/catalog";
import type { DocBlock, DocField, RenderDoc } from "./types";

export function fieldText(type: FieldDef["type"], v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  switch (type) {
    case "money": {
      const n = Number(v);
      return Number.isFinite(n) ? "$" + n.toLocaleString("en-US") : String(v);
    }
    case "percent":
      return `${v}%`;
    case "checkbox":
      return v === true || v === "true" ? "true" : "false";
    case "yesno":
      return v === "yes" ? "Yes" : v === "no" ? "No" : "";
    case "passfail":
      return v === "pass" ? "Pass" : v === "fail" ? "Fail" : "";
    default:
      return String(v);
  }
}

function docKind(f: FieldDef): DocField["kind"] {
  if (f.type === "checkbox") return "checkbox";
  if (f.type === "signature") return "signature";
  if (f.type === "textarea") return "multiline";
  return "text";
}

export function tableRows(data: SheetData, key: string, minRows: number): TableRow[] {
  const rows = Array.isArray(data[key]) ? (data[key] as TableRow[]) : [];
  const out = rows.slice();
  while (out.length < minRows) out.push({});
  return out;
}

function computedBlocks(label: string, value: Computed, big?: boolean): DocBlock[] {
  if (value === null || value === "") return [{ type: "kv", items: [{ label, value: "Not enough information yet" }] }];
  if (typeof value === "object") {
    return [{ type: "subheading", text: label }, { type: "table", table: { headers: value.headers, rows: value.rows } }];
  }
  if (big) return [{ type: "big", label, value: String(value) }];
  return [{ type: "kv", items: [{ label, value: String(value) }] }];
}

export function blockToDoc(block: Block, data: SheetData, profile: ProfileData): DocBlock[] {
  switch (block.kind) {
    case "fields":
      return [
        {
          type: "fields",
          fields: block.fields.map((f) => ({
            name: f.key,
            label: f.label,
            value: fieldText(f.type, data[f.key]),
            kind: docKind(f),
            lines: f.lines,
            hint: f.hint,
            width: f.width,
          })),
        },
      ];
    case "table": {
      const t = block.table;
      const rows = tableRows(data, t.key, t.minRows);
      const headers = t.rowLabels ? ["", ...t.columns.map((c) => c.label)] : t.columns.map((c) => c.label);
      const offset = t.rowLabels ? 1 : 0;
      const out: DocBlock[] = [];
      if (block.label) out.push({ type: "subheading", text: block.label });
      out.push({
        type: "table",
        table: {
          name: t.key,
          fillable: true,
          headers,
          widths: t.rowLabels ? [1.4, ...t.columns.map((c) => c.width ?? 1)] : t.columns.map((c) => c.width ?? 1),
          checkboxCols: t.columns.flatMap((c, i) => (c.type === "checkbox" ? [i + offset] : [])),
          staticCols: t.rowLabels ? [0] : [],
          highlightFrom: t.highlightFrom,
          rows: rows.map((r, i) => [
            ...(t.rowLabels ? [t.rowLabels[i] ?? ""] : []),
            ...t.columns.map((c) => fieldText(c.type, r[c.key])),
          ]),
        },
      });
      return out;
    }
    case "checklist": {
      const state = (data[block.key] as Record<string, Record<string, unknown>>) ?? {};
      const headers = block.mode === "passfail" ? ["Item", "Pass / Fail"] : ["", "Item"];
      if (block.notes) headers.push("Notes");
      return [
        {
          type: "table",
          table: {
            name: block.key,
            fillable: true,
            headers,
            widths: block.mode === "passfail" ? (block.notes ? [3, 1, 2] : [4, 1]) : block.notes ? [0.35, 4, 2] : [0.35, 5],
            checkboxCols: block.mode === "check" ? [0] : [],
            staticCols: [block.mode === "check" ? 1 : 0],
            rows: block.items.map((it) => {
              const s = state[it.key] ?? {};
              const label = it.detail ? `${it.label}\n${it.detail}` : it.label;
              const row =
                block.mode === "passfail"
                  ? [label, fieldText("passfail", s.result)]
                  : [s.done === true ? "true" : "false", label];
              if (block.notes) row.push(String(s.notes ?? ""));
              return row;
            }),
          },
        },
      ];
    }
    case "prose": {
      const out: DocBlock[] = [];
      if (block.heading) out.push({ type: "subheading", text: block.heading });
      for (const p of block.paragraphs ?? []) out.push({ type: "paragraph", text: p });
      if (block.bullets?.length) out.push({ type: "bullets", items: block.bullets });
      if (block.numbered?.length) out.push({ type: "bullets", items: block.numbered, style: "numbered" });
      return out;
    }
    case "callout":
      return [{ type: "callout", tone: block.tone, title: block.title, text: block.text }];
    case "computed":
      return computedBlocks(block.label, safeCompute(block, data, profile), block.big);
  }
}

export function safeCompute(
  block: Extract<Block, { kind: "computed" }>,
  data: SheetData,
  profile: ProfileData,
): Computed {
  try {
    return block.compute(data, profile);
  } catch {
    return null;
  }
}

export function worksheetToDoc(
  asset: AssetDef,
  def: WorksheetDef,
  data: SheetData,
  profile: ProfileData,
): RenderDoc {
  const blocks: DocBlock[] = [];
  for (const section of def.sections) {
    if (section.pageBreakBefore) blocks.push({ type: "pageBreak" });
    blocks.push({ type: "heading", text: section.title });
    if (section.intro) blocks.push({ type: "paragraph", text: section.intro, tone: "muted" });
    for (const b of section.blocks) blocks.push(...blockToDoc(b, data, profile));
  }
  return {
    title: asset.title,
    eyebrow: eyebrowFor(asset),
    purpose: asset.summary,
    blocks,
    dense: def.dense,
  };
}
