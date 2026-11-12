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

  monthly_burn: "Monthly burn",
  mvi: "Minimum Viable Income",
  committed_revenue: "Signed monthly revenue",
  reserve_balance: "Reserve",
  health_premium: "Replacement health premium",
  health_cost: "Health cover cost (Risk Inventory)",
  quit_scenarios: "Quit scenarios",
  open_risk_count: "Open risks",
  risk_items: "Open risk items",
  quit_decision: "Quit or Stay decision",

  angle_statement: "Angle statement",
  content_pillars: "Content pillars",
  linkedin_audit: "LinkedIn profile audit",
  icp_paragraph: "ICP paragraph",
  message_sequence: "Message sequence",
  campaign_metrics: "Campaign metrics",
  objection_scripts: "Objection-handling scripts",
  audit_top_three: "Top three automation targets",
  repurposed_pieces: "Repurposed content",
  hours_saved: "Hours saved",
  daily_action_log: "Daily action check-ins",

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

// Today's date (YYYY-MM-DD) in the member's own time zone. On the server the
// request sets the zone (src/lib/tz.ts); in the browser it is the device's.
// Never toISOString(): that is UTC, so an evening save showed tomorrow.
export function today(): string {
  const hook = (globalThis as { __lfToday?: () => string }).__lfToday;
  if (hook) return hook();
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
