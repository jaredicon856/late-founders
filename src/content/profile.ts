// The member record: every field any asset reads or writes, with the plain
// label a member sees. Assets must use these keys; nothing else is shared.

export const PROFILE_FIELDS: Record<string, string> = {
  founder_type: "Founder type",
  freedom_number: "Freedom Number",
  first_five_moves: "First five moves",
  first_five_done: "First five moves completed",
  ninety_day_target: "90-day target",
  diagnostic_summary: "Diagnostic notes",

  hidden_assets: "Hidden Assets Inventory",
  journal_entries: "Reframing Journal entries",
  origin_story: "Your one-line origin story",
  commitment: "90-day commitment",

  problem_statement: "Problem statement",
  audience: "Audience",
  script_versions: "Interview script versions",
  interview_signal_tally: "Interview signal tally",
  smoke_test_metrics: "Smoke-test numbers",
  gonogo_score: "Go/No-Go score",
  gonogo_band: "Go/No-Go result",

  name_candidates: "Name candidates",
  business_name: "Business name",
  sweep_results: "Availability sweep results",
  entity_recommendation: "Entity recommendation",
  brand_sheet: "Brand sheet",

  offer_record: "Your offer",
  objection_list: "Objection list",

  owners_audit_tasks: "Owner's Audit tasks",
  task_sort: "Task sort",
  sop_roles: "SOP role folders",
  transferability_scores: "Sellability scores",
  transferability_scores_history: "Previous Sellability scores",
  valuation_range: "Valuation range",
  roadmap: "10-year roadmap",
  role_scorecards: "Role scorecards",
};

export type ProfileKey = keyof typeof PROFILE_FIELDS;

export function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return JSON.stringify(v);
}

export function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/[$,%\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return "$" + Math.round(n).toLocaleString("en-US");
}
