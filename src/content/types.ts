// Shared types for every asset definition. Worksheets, guides, checklists,
// templates and calculators are all WorksheetDefs rendered by one engine; AI
// apps are ModeDefs run by the one Assistant. Content files only describe
// structure and copy; the engine handles saving, versioning and export.

import type { RenderDoc } from "@/lib/docs/types";

export type ProfileData = Record<string, unknown>;
export type SheetData = Record<string, unknown>;
export type TableRow = Record<string, unknown>;

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "money" // dollars, stored as number
  | "percent" // stored as number, 0-100
  | "date" // ISO yyyy-mm-dd
  | "select"
  | "yesno" // "yes" | "no" | ""
  | "checkbox" // boolean
  | "passfail" // "pass" | "fail" | ""
  | "signature"; // blank line on paper; typed name on screen

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
  placeholder?: string;
  options?: string[]; // for select
  lines?: number; // textarea height, also paper height
  width?: "full" | "half" | "third";
  readOnly?: boolean; // shown but filled from the member record
}

export interface ColumnDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  width?: number; // relative width, default 1
}

export interface TableDef {
  key: string;
  columns: ColumnDef[];
  minRows: number;
  maxRows?: number;
  addable?: boolean;
  rowLabels?: string[]; // fixed first-cell labels, e.g. value-driver names
  highlightFrom?: number; // rows from this index get highlighted (e.g. top five)
  twoUp?: boolean; // print as two side-by-side halves to save paper height
}

export type Computed = string | number | { headers: string[]; rows: string[][] } | null;

export type Block =
  | { kind: "fields"; fields: FieldDef[] }
  | { kind: "table"; label?: string; table: TableDef }
  | {
      kind: "checklist";
      key: string;
      mode: "check" | "passfail";
      notes?: boolean;
      items: { key: string; label: string; detail?: string }[];
    }
  | { kind: "prose"; heading?: string; paragraphs?: string[]; bullets?: string[]; numbered?: string[] }
  | { kind: "callout"; tone: "note" | "warning" | "legal"; title?: string; text: string }
  | {
      kind: "computed";
      key: string;
      label: string;
      big?: boolean;
      // Pure function: worksheet data + member record -> display value.
      compute: (data: SheetData, profile: ProfileData) => Computed;
    };

export interface Section {
  title: string;
  intro?: string;
  blocks: Block[];
  pageBreakBefore?: boolean;
}

export interface WorksheetDef {
  assetId: string;
  sections: Section[];
  // Member record fields this sheet reads (prefill, computed values).
  reads?: string[];
  // Initial data from the member record the first time the sheet opens.
  initial?: (profile: ProfileData) => SheetData;
  // Data recomputed from the member record on every load, overriding saved
  // values (generated documents like the Personal Roadmap).
  live?: (profile: ProfileData) => SheetData;
  // Member record fields written when the member saves/completes.
  writes?: { key: string; from: (data: SheetData, profile: ProfileData) => unknown }[];
  exports: ("pdf" | "xlsx" | "docx" | "zip")[];
  // Tighter print layout for sheets the spec says must fit one page.
  dense?: boolean;
  // Guides have nothing to fill; the member marks them read.
  readOnly?: boolean;
  // Line printed above the signature or at the top, in the purpose style.
  pageLimitNote?: string;
}

export interface ModeDef {
  assetId: string;
  // What the Assistant is in this mode. Prepended to the shared base prompt.
  systemPrompt: string;
  reads: string[];
  writes: string[];
  // First message shown when the member opens the tool. Built from the record
  // without an API call, so it can say what is already loaded.
  opener: (profile: ProfileData) => string;
  // JSON Schema for the save_output tool input. Must be strict-compatible:
  // every object sets additionalProperties:false and lists all keys in required.
  outputSchema: Record<string, unknown>;
  // Turn validated output into member record writes and a downloadable doc.
  // Runs on the server; do derived arithmetic here, never trust model math.
  onSave: (
    output: Record<string, unknown>,
    profile: ProfileData,
  ) => { profile: Record<string, unknown>; doc: RenderDoc; summary: string };
  // Fields the member types straight into their record on the tool page
  // (e.g. smoke-test numbers), shown above the chat.
  memberEntry?: { key: string; label: string; fields: FieldDef[] };
  // Regulated output: shown beside the result, never as fine print.
  disclaimer?: string;
  // Persistent workspaces keep one long thread; others can start fresh runs.
  persistent?: boolean;
}

export type AssetKind =
  | "ai"
  | "worksheet"
  | "guide"
  | "checklist"
  | "template"
  | "calculator"
  | "generated"
  | "library"
  | "tool";

export interface AssetDef {
  id: string; // url slug, never shown to members
  code: string; // "02.1", internal only
  course: number;
  title: string;
  kind: AssetKind;
  summary: string; // one plain line for shelves and cards
  lesson?: string; // "Lesson 2.2" when the course points at it
}

export interface CourseDef {
  number: number;
  title: string;
  pillar: string;
  assets: string[]; // asset ids in curriculum order
}
