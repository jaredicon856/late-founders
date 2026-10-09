// RenderDoc: the one intermediate format every download is built from.
// Worksheets compile to it, AI outputs compile to it, and the PDF, DOCX and
// XLSX exporters each read only this shape. That keeps all assets on the
// worksheet layout standard without each one styling itself.

export type FieldKind = "text" | "multiline" | "checkbox" | "signature";

export interface DocField {
  name: string; // unique form-field name inside the PDF
  label: string;
  value: string; // "true"/"false" for checkboxes
  kind: FieldKind;
  lines?: number;
  hint?: string;
  width?: "full" | "half" | "third";
}

export interface DocTable {
  name?: string; // when set and fillable, each cell becomes a PDF form field
  headers: string[];
  widths?: number[]; // relative
  rows: string[][];
  checkboxCols?: number[]; // column indexes rendered as checkboxes
  staticCols?: number[]; // printed labels, never form fields
  highlightFrom?: number;
  fillable?: boolean;
  totalRow?: string[];
}

export type DocBlock =
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string; tone?: "muted" | "accent" }
  | { type: "bullets"; items: string[]; style?: "bullet" | "numbered" | "checkbox" }
  | { type: "kv"; items: { label: string; value: string }[] }
  | { type: "fields"; fields: DocField[] } // laid out side by side when short
  | { type: "table"; table: DocTable }
  | { type: "callout"; tone: "note" | "warning" | "legal"; title?: string; text: string }
  | { type: "big"; label: string; value: string; note?: string }
  | { type: "pageBreak" };

export interface RenderDoc {
  title: string;
  eyebrow: string; // COURSE 02 · THE LATE ADVANTAGE
  purpose: string; // one line: what the member walks away with
  blocks: DocBlock[];
  dense?: boolean; // tighter rows, for sheets that must fit one page
  // "neutral" drops Late Founders branding: used for documents that carry the
  // member's own brand (the Brand-Sheet Generator's output).
  template?: "lf" | "neutral";
  // Extra tabular sheets for XLSX; defaults to the doc's tables.
  meta?: { member?: string; completedAt?: string; version?: number };
}
