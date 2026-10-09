import { describe, expect, it } from "vitest";
import { ASSETS, COURSES, ROUTES } from "@/content/catalog";
import { PROFILE_FIELDS } from "@/content/profile";
import { getMode, getWorksheet, missingImplementations } from "@/content/registry";
import { worksheetToDoc } from "@/lib/docs/fromWorksheet";

// Strict tool use requires every object to close its properties and require all of them.
function strictProblems(schema: unknown, path = "$"): string[] {
  if (!schema || typeof schema !== "object") return [];
  const s = schema as Record<string, unknown>;
  const out: string[] = [];
  if (s.type === "object" || (Array.isArray(s.type) && s.type.includes("object"))) {
    const props = Object.keys((s.properties as object) ?? {});
    if (s.additionalProperties !== false) out.push(`${path}: additionalProperties must be false`);
    const req = new Set((s.required as string[]) ?? []);
    for (const p of props) if (!req.has(p)) out.push(`${path}.${p}: not in required`);
  }
  for (const k of ["minItems", "maxItems", "minLength", "maxLength", "pattern", "format", "minimum", "maximum"]) {
    if (k in s && !(k === "minItems" && (s[k] === 0 || s[k] === 1))) out.push(`${path}: unsupported keyword ${k}`);
  }
  for (const [k, v] of Object.entries((s.properties as Record<string, unknown>) ?? {})) out.push(...strictProblems(v, `${path}.${k}`));
  if (s.items) out.push(...strictProblems(s.items, `${path}[]`));
  for (const k of ["anyOf", "oneOf", "allOf"]) for (const [i, v] of ((s[k] as unknown[]) ?? []).entries()) out.push(...strictProblems(v, `${path}.${k}[${i}]`));
  return out;
}

describe("catalog", () => {
  it("has an implementation for every asset", () => {
    expect(missingImplementations()).toEqual([]);
  });

  it("lists every asset in exactly one course", () => {
    const listed = COURSES.flatMap((c) => c.assets);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(ASSETS.map((a) => a.id).sort());
    for (const a of ASSETS) expect(COURSES.find((c) => c.assets.includes(a.id))?.number).toBe(a.course);
  });

  it("routes cover every in-scope course", () => {
    for (const route of Object.values(ROUTES)) expect([...route].sort((a, b) => a - b)).toEqual(COURSES.map((c) => c.number).sort((a, b) => a - b));
  });

  it("covers the in-scope courses only: 01-05 and 12-14", () => {
    expect(COURSES.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 12, 13, 14]);
  });
});

describe("AI modes", () => {
  const modes = ASSETS.filter((a) => a.kind === "ai").map((a) => getMode(a.id)!);

  it.each(modes.map((m) => [m.assetId, m] as const))("%s has a strict-compatible output schema", (_id, m) => {
    expect(strictProblems(m.outputSchema)).toEqual([]);
  });

  it.each(modes.map((m) => [m.assetId, m] as const))("%s only reads and writes known record fields", (_id, m) => {
    for (const k of [...m.reads, ...m.writes]) expect(PROFILE_FIELDS).toHaveProperty(k);
  });

  it.each(modes.map((m) => [m.assetId, m] as const))("%s opens without a record and with an empty one", (_id, m) => {
    expect(m.opener({}).length).toBeGreaterThan(20);
  });

  it.each(modes.map((m) => [m.assetId, m] as const))("%s rejects an empty save instead of saving junk", (_id, m) => {
    expect(() => m.onSave({}, {})).toThrow();
  });
});

describe("worksheets", () => {
  const sheets = ASSETS.filter((a) => getWorksheet(a.id)).map((a) => [a.id, a, getWorksheet(a.id)!] as const);

  it.each(sheets)("%s renders to a document blank and never throws", (_id, asset, def) => {
    const data = def.initial?.({}) ?? {};
    const doc = worksheetToDoc(asset, def, { ...data, ...(def.live?.({}) ?? {}) }, {});
    expect(doc.title).toBe(asset.title);
    expect(doc.blocks.length).toBeGreaterThan(0);
  });

  it.each(sheets)("%s writes only known record fields", (_id, _a, def) => {
    for (const w of def.writes ?? []) expect(PROFILE_FIELDS).toHaveProperty(w.key);
    for (const k of def.reads ?? []) expect(PROFILE_FIELDS).toHaveProperty(k);
  });

  it.each(sheets)("%s has unique keys", (_id, _a, def) => {
    const keys = def.sections.flatMap((s) =>
      s.blocks.flatMap((b) =>
        b.kind === "fields" ? b.fields.map((f) => f.key) : b.kind === "table" ? [b.table.key] : b.kind === "checklist" ? [b.key] : [],
      ),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
