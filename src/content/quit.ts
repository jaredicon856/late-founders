// Course 06 arithmetic, shared by the Runway Calculator, the Risk Inventory
// and the AI Decision Engine. Pure functions so the numbers are tested and the
// Assistant never does the maths itself.

import { asNumber, money } from "./profile";
import type { ProfileData, SheetData, TableRow } from "./types";

const rows = (d: SheetData, k: string): TableRow[] =>
  Array.isArray(d[k]) ? (d[k] as TableRow[]).filter((r) => r && typeof r === "object") : [];
const num = (v: unknown) => asNumber(v) ?? 0;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const round = (n: number) => Math.round(n);

// --- Runway Calculator ------------------------------------------------------

export function monthlyBurn(d: SheetData): number | null {
  const fixed = rows(d, "fixed_costs").reduce((s, r) => s + num(r.monthly), 0);
  const variable = rows(d, "variable_costs").reduce((s, r) => {
    const months = [r.month1, r.month2, r.month3].map(asNumber).filter((n): n is number => n !== null);
    return s + (months.length ? months.reduce((a, b) => a + b, 0) / months.length : 0);
  }, 0);
  const annual = rows(d, "annual_costs").reduce((s, r) => s + num(r.yearly) / 12, 0);
  const total = fixed + variable + annual;
  return total > 0 ? round(total) : null;
}

// The simple personal gap: what the member's life costs beyond income they keep regardless.
export function personalGap(d: SheetData): number | null {
  const burn = monthlyBurn(d);
  return burn === null ? null : Math.max(0, burn - num(d.guaranteed_income));
}

// Minimum Viable Income: the pre-tax monthly business income needed to quit.
// The tax set-aside is grossed up (net / (1 - rate)) so that after setting the
// percentage aside, what is left still covers the gap, health cover and overhead.
// It is therefore always above the simple personal gap once any cost is entered.
export function mvi(d: SheetData): number | null {
  const gap = personalGap(d);
  if (gap === null) return null;
  const net = gap + num(d.health_premium) + num(d.overhead);
  const rate = Math.min(Math.max(num(d.se_tax_pct), 0), 90) / 100;
  return round(net / (1 - rate));
}

export type Coverage = { income: number; need: number; shortfall: number; months: number | null }; // months null = covered indefinitely

export function coverage(reserve: number, income: number, need: number): Coverage {
  const shortfall = need - income;
  return { income, need, shortfall: Math.max(0, shortfall), months: shortfall <= 0 ? null : Math.floor((reserve / shortfall) * 10) / 10 };
}

export function scenarios(d: SheetData) {
  const m = mvi(d);
  const burn = monthlyBurn(d);
  if (m === null || burn === null) return null;
  const reserve = num(d.reserve);
  return {
    cold_turkey: coverage(reserve, num(d.committed_revenue), m),
    phased_exit: coverage(reserve, num(d.reduced_w2) + num(d.business_income), m),
    stay_and_build: coverage(reserve, num(d.current_income) + num(d.side_income), burn),
  };
}

export const monthsText = (c: Coverage) => (c.months === null ? "Covered: income meets the need" : `${c.months} months`);

export function addMonths(iso: string, months: number): string {
  const t = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(t.getTime())) return "";
  t.setUTCMonth(t.getUTCMonth() + Math.floor(months));
  return t.toISOString().slice(0, 10);
}

// --- Risk Inventory ---------------------------------------------------------

const isClosed = (v: unknown) => text(v).toLowerCase() === "closed";

export function openRisks(d: SheetData): string[] {
  const out: string[] = [];
  for (const r of rows(d, "dependents")) {
    if (!text(r.name) || isClosed(r.status)) continue;
    out.push(`Dependent: ${text(r.name)}${text(r.needs) ? `, needs ${text(r.needs)}` : ""}${r.hard_deadline === "yes" ? " (hard deadline)" : ""}`);
  }
  if (!isClosed(d.health_status)) out.push(`Health coverage not settled${text(d.health_option) ? ` (leaning ${text(d.health_option)})` : ""}`);
  for (const r of rows(d, "debts")) {
    if (!text(r.creditor) || isClosed(r.status)) continue;
    const min = asNumber(r.minimum);
    out.push(`Debt: ${text(r.creditor)}${min !== null ? `, ${money(min)}/mo minimum` : ""}${text(r.liability) ? `, ${text(r.liability).toLowerCase()} liability` : ""}`);
  }
  return out;
}

// --- Decision Engine --------------------------------------------------------

export const BANDS = ["Quit now", "Quit in three to six months", "Stay and build"] as const;
export type Band = (typeof BANDS)[number];

export type DecisionInputs = {
  founder_type: string;
  freedom_number: number | null;
  monthly_burn: number;
  mvi: number;
  committed_revenue: number;
  reserve: number;
  open_risk_count: number;
};

export function decisionInputs(p: ProfileData): { inputs: DecisionInputs | null; missing: string[] } {
  const missing: string[] = [];
  const burn = asNumber(p.monthly_burn);
  const m = asNumber(p.mvi);
  const risks = asNumber(p.open_risk_count);
  if (burn === null || m === null) missing.push("Runway Calculator (your burn and MVI)");
  if (risks === null) missing.push("Risk Inventory Worksheet (your open risks)");
  if (missing.length) return { inputs: null, missing };
  return {
    missing,
    inputs: {
      founder_type: typeof p.founder_type === "string" ? p.founder_type : "",
      freedom_number: asNumber(p.freedom_number),
      monthly_burn: burn as number,
      mvi: m as number,
      committed_revenue: asNumber(p.committed_revenue) ?? 0,
      reserve: asNumber(p.reserve_balance) ?? 0,
      open_risk_count: risks as number,
    },
  };
}

// Thresholds per band. A First-Timer gives up a paycheck that is still coming
// in, so they need three more months of cover than other founder types.
function thresholds(type: string) {
  const extra = type === "First-Timer" ? 3 : 0;
  return {
    now: { months: 12 + extra, committedPct: 0.5, risks: 0 },
    soon: { months: 6 + extra, committedPct: 0.25, risks: 2 },
  };
}

export type Decision = { band: Band; coverage_months: number | null; committed_pct: number; gaps: string[] };

export function decide(i: DecisionInputs): Decision {
  const c = coverage(i.reserve, i.committed_revenue, i.mvi);
  const pct = i.mvi > 0 ? i.committed_revenue / i.mvi : 1;
  const t = thresholds(i.founder_type);
  const meets = (b: { months: number; committedPct: number; risks: number }) =>
    i.open_risk_count <= b.risks && (pct >= 1 || ((c.months ?? Infinity) >= b.months && pct >= b.committedPct));
  const band: Band = meets(t.now) ? "Quit now" : meets(t.soon) ? "Quit in three to six months" : "Stay and build";

  // Named gaps: what stands between the member and the next band up.
  const gaps: string[] = [];
  const target = band === "Stay and build" ? t.soon : band === "Quit in three to six months" ? t.now : null;
  if (target && pct < 1) {
    const months = c.months ?? Infinity;
    if (months < target.months)
      gaps.push(
        `Reserve covers ${c.months} months of the ${money(c.shortfall)}/mo shortfall against your MVI; the next band needs ${target.months}. That is about ${money(Math.ceil((target.months - months) * c.shortfall))} more in reserve, or less shortfall.`,
      );
    if (pct < target.committedPct)
      gaps.push(
        `Signed revenue is ${money(i.committed_revenue)}/mo, ${Math.round(pct * 100)}% of your ${money(i.mvi)} MVI; the next band needs ${Math.round(target.committedPct * 100)}% (${money(Math.ceil(i.mvi * target.committedPct))}/mo).`,
      );
  }
  if (target && i.open_risk_count > target.risks)
    gaps.push(`${i.open_risk_count} open risk${i.open_risk_count === 1 ? "" : "s"} on your Risk Inventory; the next band allows ${target.risks}.`);
  return { band, coverage_months: c.months, committed_pct: Math.round(pct * 100), gaps };
}
