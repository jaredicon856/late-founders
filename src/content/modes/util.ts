// Helpers for ModeDef.onSave. Throw SaveError when the model's output breaks a
// rule; the Assistant returns the message to the model as a tool error and it
// corrects itself (usually by asking the member) before saving again.

export class SaveError extends Error {}

export function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v);
}

export function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : [];
}

export function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function objArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.map(obj) : [];
}

// Scores the model gives must be integers inside the stated range.
export function score(v: unknown, min: number, max: number, field: string): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new SaveError(`${field} must be a whole number from ${min} to ${max}.`);
  return n;
}

export const GENERAL_GUIDANCE =
  "General guidance only. This is not legal, tax, accounting or financial advice for your situation.";
