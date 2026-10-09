import { asNumber, money } from "../profile";
import type { Computed, ProfileData, SheetData, TableRow, WorksheetDef } from "../types";

// Member-record shapes written here (agreed):
//   transferability_scores: { date: string; functions: {name: string; score: number}[]; function_total: number;
//     drivers: Record<DriverKey, number>; driver_total: number;
//     hygiene: { separation: boolean; consistency: boolean; history: boolean };
//     total: number; lowest_two: string[] }
//   - functions: only rows with a name AND a score; each score 0, 1 or 2 (function_total max 16).
//   - drivers: 1 to 5, 5 is strongest for a buyer (for owner_dependence, 5 = runs without you).
//     Unscored drivers are 0 in the record (driver_total max 35).
//   - total = function_total + driver_total + hygiene "yes" count. Maximum 54.
//   - lowest_two: the plain driver NAMES (e.g. "Owner-dependence"), lowest score first, ties by list order.
//   valuation_range: { low: number; high: number; most_sensitive: string; date: string }
// Read, maintained by the engine (not written here):
//   transferability_scores_history: transferability_scores[] (one dated snapshot per completion)

const rows = (d: SheetData, k: string): TableRow[] =>
  Array.isArray(d[k]) ? (d[k] as TableRow[]).filter((r) => r && typeof r === "object") : [];
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const today = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Sellability Scorecard
// ---------------------------------------------------------------------------

export const DRIVERS = [
  { key: "client_concentration", label: "Client concentration", anchor: "1: one client is over half of revenue. 5: no client is over 10%." },
  { key: "earnings_trend", label: "Earnings trend", anchor: "1: falling for two years or more. 5: rising steadily for three years." },
  { key: "owner_dependence", label: "Owner-dependence", anchor: "1: nothing happens without you. 5: the business runs for a month without you." },
  { key: "recurring_revenue", label: "Recurring revenue", anchor: "1: under 10% of revenue recurs. 5: over 60% is under contract or subscription." },
  { key: "documented_systems", label: "Documented systems", anchor: "1: it is all in your head. 5: every core process has a current SOP." },
  { key: "team_depth", label: "Team depth", anchor: "1: no one could step up. 5: every key role has a capable second." },
  { key: "contract_ip_hygiene", label: "Contract and IP hygiene", anchor: "1: handshake deals, IP unclear. 5: signed contracts, assignable, IP owned by the business." },
] as const;
export type DriverKey = (typeof DRIVERS)[number]["key"];

const FN_OPTIONS = [
  "0 · Only I can do this",
  "1 · Someone else could, with me coaching live",
  "2 · Someone else already does it, or could from documentation",
];
const DRIVER_OPTIONS = ["1", "2", "3", "4", "5"];

// Select values carry the score as their first character.
function leadingScore(v: unknown, min: number, max: number): number | null {
  const m = /^\s*(\d)/.exec(text(v));
  if (!m) return null;
  const n = Number(m[1]);
  return n >= min && n <= max ? n : null;
}

interface Scores {
  date: string;
  functions: { name: string; score: number }[];
  function_total: number;
  drivers: Record<DriverKey, number>;
  driver_total: number;
  hygiene: { separation: boolean; consistency: boolean; history: boolean };
  total: number;
  lowest_two: string[];
}

function driverScores(d: SheetData): (number | null)[] {
  const r = rows(d, "drivers");
  return DRIVERS.map((_, i) => leadingScore(r[i]?.score, 1, 5));
}

function lowestTwo(scores: (number | null)[]): string[] {
  if (scores.some((s) => s === null)) return [];
  return DRIVERS.map((dr, i) => ({ label: dr.label, s: scores[i] as number, i }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .slice(0, 2)
    .map((x) => x.label);
}

export function scorecard(d: SheetData): Scores {
  const functions = rows(d, "functions")
    .map((r) => ({ name: text(r.name), score: leadingScore(r.score, 0, 2) }))
    .filter((f): f is { name: string; score: number } => !!f.name && f.score !== null);
  const ds = driverScores(d);
  const drivers = Object.fromEntries(DRIVERS.map((dr, i) => [dr.key, ds[i] ?? 0])) as Record<DriverKey, number>;
  const hygiene = { separation: d.separation === "yes", consistency: d.consistency === "yes", history: d.history === "yes" };
  const function_total = functions.reduce((s, f) => s + f.score, 0);
  const driver_total = Object.values(drivers).reduce((s, n) => s + n, 0);
  const hygieneCount = Object.values(hygiene).filter(Boolean).length;
  return {
    date: text(d.scored_on) || today(),
    functions,
    function_total,
    drivers,
    driver_total,
    hygiene,
    total: function_total + driver_total + hygieneCount,
    lowest_two: lowestTwo(ds),
  };
}

function previousScores(current: string, p: ProfileData): Scores | null {
  const hist = Array.isArray(p.transferability_scores_history) ? (p.transferability_scores_history as unknown[]) : [];
  const earlier = hist
    .filter((h): h is Scores => !!h && typeof h === "object" && typeof (h as Scores).date === "string")
    .filter((h) => h.date.slice(0, 10) < current)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return earlier[0] ?? null;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export const sellabilityScorecard: WorksheetDef = {
  assetId: "sellability-scorecard",
  exports: ["pdf", "xlsx"],
  reads: ["transferability_scores_history"],
  initial: () => ({ scored_on: today() }),
  sections: [
    {
      title: "Scored on",
      blocks: [
        {
          kind: "fields",
          fields: [
            {
              key: "scored_on",
              label: "Date scored",
              type: "date",
              width: "half",
              hint: "Score once a year. The change from last year is the signal, not the score itself.",
            },
          ],
        },
      ],
    },
    {
      title: "1 · Revenue-critical functions",
      intro:
        "List the eight functions that bring in or protect revenue, such as sales calls, pricing, delivery, quality review or key client relationships. Score each one.",
      blocks: [
        {
          kind: "prose",
          bullets: [
            "0: only I can do this.",
            "1: someone else could, with me coaching live.",
            "2: someone else already does it, or could from documentation.",
          ],
        },
        {
          kind: "table",
          table: {
            key: "functions",
            minRows: 8,
            maxRows: 8,
            columns: [
              { key: "name", label: "Function", type: "text", width: 2.4 },
              { key: "score", label: "Score", type: "select", options: FN_OPTIONS, width: 2 },
            ],
          },
        },
      ],
    },
    {
      title: "2 · Value drivers",
      intro: "Score each driver from 1 to 5, where 5 is what a buyer most wants to see.",
      blocks: [
        { kind: "prose", bullets: DRIVERS.map((dr) => `${dr.label}. ${dr.anchor}`) },
        {
          kind: "table",
          table: {
            key: "drivers",
            minRows: 7,
            maxRows: 7,
            rowLabels: DRIVERS.map((dr) => dr.label),
            columns: [
              { key: "score", label: "Score (1 to 5)", type: "select", options: DRIVER_OPTIONS, width: 0.8 },
              { key: "evidence", label: "Why this score", type: "text", width: 2.6 },
            ],
          },
        },
      ],
    },
    {
      title: "3 · Financial hygiene",
      blocks: [
        {
          kind: "fields",
          fields: [
            { key: "separation", label: "Are business and personal finances fully separate?", type: "yesno" },
            { key: "consistency", label: "Are your books kept the same way every month, by the same method?", type: "yesno" },
            { key: "history", label: "Do you have three full years of clean financial history?", type: "yesno" },
          ],
        },
      ],
    },
    {
      title: "Your result",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "computed",
          key: "total",
          label: "Transferability total (out of 54)",
          big: true,
          compute: (d): Computed => {
            const s = scorecard(d);
            if (!s.functions.length && !s.driver_total) return null;
            return `${s.total} / 54`;
          },
        },
        {
          kind: "computed",
          key: "breakdown",
          label: "How the total is made",
          compute: (d): Computed => {
            const s = scorecard(d);
            if (!s.functions.length && !s.driver_total) return null;
            const hy = Object.values(s.hygiene).filter(Boolean).length;
            return {
              headers: ["Part", "Score", "Out of"],
              rows: [
                ["Revenue-critical functions", String(s.function_total), "16"],
                ["Value drivers", String(s.driver_total), "35"],
                ["Financial hygiene (yes answers)", String(hy), "3"],
                ["Transferability total", String(s.total), "54"],
              ],
            };
          },
        },
        {
          kind: "computed",
          key: "priorities",
          label: "Your next two quarters: the two lowest value drivers",
          compute: (d): Computed => {
            const ds = driverScores(d);
            const two = lowestTwo(ds);
            if (!two.length) return null;
            return {
              headers: ["Quarter", "Priority driver", "Score now"],
              rows: two.map((label, i) => {
                const idx = DRIVERS.findIndex((dr) => dr.label === label);
                return [i === 0 ? "Next quarter" : "The quarter after", `◯ ${label}`, `${ds[idx]} / 5`];
              }),
            };
          },
        },
        {
          kind: "computed",
          key: "year_over_year",
          label: "Last time compared with this time",
          compute: (d, p): Computed => {
            const now = scorecard(d);
            const prev = previousScores(now.date, p);
            if (!prev || !prev.drivers) return null;
            const line = (label: string, a: unknown, b: number) => {
              const before = asNumber(a);
              return [label, before === null ? "" : String(before), String(b), before === null ? "" : signed(b - before)];
            };
            return {
              headers: ["", `Last (${prev.date.slice(0, 10)})`, `This (${now.date})`, "Change"],
              rows: [
                ...DRIVERS.map((dr) => line(dr.label, (prev.drivers as Record<string, unknown>)[dr.key], now.drivers[dr.key])),
                line("Functions total", prev.function_total, now.function_total),
                line("Value drivers total", prev.driver_total, now.driver_total),
                line("Transferability total", prev.total, now.total),
              ],
            };
          },
        },
        {
          kind: "callout",
          tone: "note",
          text: "Every time you complete this scorecard, a dated copy is kept. Next year, your scores appear beside this year's so you can see the trend.",
        },
      ],
    },
  ],
  writes: [{ key: "transferability_scores", from: (d) => scorecard(d) }],
};

// ---------------------------------------------------------------------------
// Valuation Estimator (no AI)
// ---------------------------------------------------------------------------
//
// HOW THE MODEL WORKS (keep in step with the "How this model works" prose block)
//
// Base multiple range on the chosen earnings figure, typical of small owner-run
// service businesses:
//   SDE    (seller's discretionary earnings): 2.0x to 3.0x
//   EBITDA:                                  3.0x to 5.0x
//
// Both ends of the range are multiplied by one confidence factor, the product of:
//   Contract revenue:  0.85 at 0% under contract, rising in a straight line to 1.20 at 100%.
//   Owner-dependence:  0.70 at a score of 1, plus 0.10 per point, to 1.10 at a score of 5.
//   Concentration:     1.05 when the largest client is 10% of revenue or less, falling 0.0075
//                      per point above 10%, with a floor of 0.70 (reached at about 57%).
// The combined factor is clamped to 0.40 to 1.50.
//
//   low  = earnings x base low  x factor     high = earnings x base high x factor
// Both are rounded to two significant figures. A precise figure is never shown.
//
// Sensitivity: each input improves by one realistic step on its own, the rest held:
//   earnings +10%; contract revenue +15 points (max 100); owner-dependence +1 (max 5);
//   largest client -10 points (min 0). The table shows how far the midpoint of the range
//   moves, largest first; the top row is the input that moves this member's range most.

export type EarningsBasis = "SDE" | "EBITDA";

export interface ValuationInputs {
  basis: EarningsBasis;
  earnings: number;
  contractPct: number; // 0-100
  ownerDependence: number; // 1-5, 5 = runs without the owner
  concentrationPct: number; // 0-100, largest client's share of revenue
}

export interface ValuationResult {
  low: number;
  high: number;
  mid: number; // unrounded midpoint, for sensitivity
  multipleLow: number;
  multipleHigh: number;
  factor: number;
}

export const BASE_MULTIPLES: Record<EarningsBasis, [number, number]> = { SDE: [2.0, 3.0], EBITDA: [3.0, 5.0] };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function roundSig(n: number, sig = 2): number {
  if (!Number.isFinite(n) || n === 0) return 0;
  return Number(n.toPrecision(sig));
}

export function confidenceFactor(i: ValuationInputs): number {
  const contract = 0.85 + 0.35 * (clamp(i.contractPct, 0, 100) / 100);
  const owner = 0.7 + 0.1 * (clamp(i.ownerDependence, 1, 5) - 1);
  const conc = clamp(1.05 - (clamp(i.concentrationPct, 0, 100) - 10) * 0.0075, 0.7, 1.05);
  return clamp(contract * owner * conc, 0.4, 1.5);
}

export function valuationRange(i: ValuationInputs): ValuationResult | null {
  if (!(i.earnings > 0) || !BASE_MULTIPLES[i.basis]) return null;
  if (![i.contractPct, i.ownerDependence, i.concentrationPct].every(Number.isFinite)) return null;
  const [bl, bh] = BASE_MULTIPLES[i.basis];
  const factor = confidenceFactor(i);
  const rawLow = i.earnings * bl * factor;
  const rawHigh = i.earnings * bh * factor;
  return {
    low: roundSig(rawLow),
    high: roundSig(rawHigh),
    mid: (rawLow + rawHigh) / 2,
    multipleLow: Math.round(bl * factor * 10) / 10,
    multipleHigh: Math.round(bh * factor * 10) / 10,
    factor,
  };
}

export interface SensitivityRow {
  input: string;
  step: string;
  midpointChange: number; // rounded to two significant figures
  rawChange: number;
}

export function sensitivity(i: ValuationInputs): SensitivityRow[] {
  const base = valuationRange(i);
  if (!base) return [];
  const steps: { input: string; step: string; next: ValuationInputs; possible: boolean }[] = [
    { input: "Earnings", step: "10% higher", next: { ...i, earnings: i.earnings * 1.1 }, possible: true },
    {
      input: "Revenue under contract",
      step: "15 points more",
      next: { ...i, contractPct: Math.min(100, i.contractPct + 15) },
      possible: i.contractPct < 100,
    },
    {
      input: "Owner-dependence score",
      step: "1 point better",
      next: { ...i, ownerDependence: Math.min(5, i.ownerDependence + 1) },
      possible: i.ownerDependence < 5,
    },
    {
      input: "Largest-client concentration",
      step: "10 points lower",
      next: { ...i, concentrationPct: Math.max(0, i.concentrationPct - 10) },
      possible: i.concentrationPct > 0,
    },
  ];
  return steps
    .map((s) => {
      const r = s.possible ? valuationRange(s.next) : null;
      const raw = r ? r.mid - base.mid : 0;
      return { input: s.input, step: s.possible ? s.step : "Already at the best value", midpointChange: roundSig(raw), rawChange: raw };
    })
    .sort((a, b) => b.rawChange - a.rawChange);
}

function inputsFrom(d: SheetData): ValuationInputs | null {
  const basis = d.basis === "EBITDA" ? "EBITDA" : d.basis === "SDE" ? "SDE" : null;
  const earnings = asNumber(d.earnings);
  const contractPct = asNumber(d.contract_pct);
  const owner = asNumber(d.owner_dependence);
  const conc = asNumber(d.concentration_pct);
  if (!basis || earnings === null || contractPct === null || owner === null || conc === null) return null;
  if (contractPct < 0 || contractPct > 100 || conc < 0 || conc > 100) return null;
  if (!Number.isInteger(owner) || owner < 1 || owner > 5) return null;
  return { basis, earnings, contractPct, ownerDependence: owner, concentrationPct: conc };
}

function mostSensitive(i: ValuationInputs): string {
  const top = sensitivity(i)[0];
  return top && top.rawChange > 0 ? top.input : "";
}

const LEGAL_TEXT =
  "This is a directional model, not a valuation. It shows how buyers tend to think, not what your business is worth. A real number requires an M&A advisor who has seen your financials. General guidance only, not financial, tax or legal advice.";

export const valuationEstimator: WorksheetDef = {
  assetId: "valuation-estimator",
  exports: ["pdf", "xlsx"],
  reads: ["transferability_scores"],
  initial: (p) => {
    const ts = p.transferability_scores as { drivers?: Record<string, unknown> } | undefined;
    const od = asNumber(ts?.drivers?.owner_dependence);
    return { basis: "SDE", owner_dependence: od !== null && od >= 1 && od <= 5 ? od : "" };
  },
  sections: [
    {
      title: "Your inputs",
      blocks: [
        { kind: "callout", tone: "legal", title: "Directional model, not a valuation", text: LEGAL_TEXT },
        {
          kind: "fields",
          fields: [
            {
              key: "basis",
              label: "Earnings measure",
              type: "select",
              options: ["SDE", "EBITDA"],
              width: "half",
              hint: "SDE adds your own pay back into profit. Most businesses under about $1M of profit are priced on SDE.",
            },
            { key: "earnings", label: "Current annual earnings", type: "money", width: "half" },
            {
              key: "contract_pct",
              label: "Revenue under contract or subscription",
              type: "percent",
              width: "half",
              hint: "The rest is one-off or project work.",
            },
            {
              key: "concentration_pct",
              label: "Largest client's share of revenue",
              type: "percent",
              width: "half",
            },
            {
              key: "owner_dependence",
              label: "Owner-dependence score (1 to 5)",
              type: "number",
              width: "half",
              hint: "From your Sellability Scorecard. 5 means the business runs without you.",
            },
          ],
        },
      ],
    },
    {
      title: "What moves your range most",
      blocks: [
        {
          kind: "computed",
          key: "most_sensitive",
          label: "The input that moves your range most",
          big: true,
          compute: (d): Computed => {
            const i = inputsFrom(d);
            if (!i) return null;
            return mostSensitive(i) || "Every input is already at its best value";
          },
        },
        {
          kind: "computed",
          key: "sensitivity",
          label: "How far the middle of your range moves when one input improves",
          compute: (d): Computed => {
            const i = inputsFrom(d);
            if (!i) return null;
            const rows = sensitivity(i);
            if (!rows.length) return null;
            return {
              headers: ["Input", "Realistic improvement", "Midpoint moves by about"],
              rows: rows.map((r) => [r.input, r.step, r.rawChange > 0 ? `+${money(r.midpointChange)}` : "No change"]),
            };
          },
        },
        {
          kind: "computed",
          key: "range",
          label: "Directional value range",
          big: true,
          compute: (d): Computed => {
            const i = inputsFrom(d);
            const r = i ? valuationRange(i) : null;
            return r ? `${money(r.low)} to ${money(r.high)}` : null;
          },
        },
        {
          kind: "computed",
          key: "multiple",
          label: "Adjusted multiple range",
          compute: (d): Computed => {
            const i = inputsFrom(d);
            const r = i ? valuationRange(i) : null;
            return r ? `${r.multipleLow.toFixed(1)}x to ${r.multipleHigh.toFixed(1)}x ${i?.basis}` : null;
          },
        },
        { kind: "callout", tone: "legal", title: "Directional model, not a valuation", text: LEGAL_TEXT },
      ],
    },
    {
      title: "How this model works",
      blocks: [
        {
          kind: "prose",
          paragraphs: [
            "The model starts from a typical multiple range for small owner-run businesses: 2.0x to 3.0x SDE, or 3.0x to 5.0x EBITDA. It then scales both ends of the range by how confident a buyer would be in your earnings.",
          ],
          bullets: [
            "Revenue under contract: from 0.85 at none under contract up to 1.20 at all of it.",
            "Owner-dependence: from 0.70 at a score of 1 up to 1.10 at a score of 5.",
            "Largest client: 1.05 when no client is over 10% of revenue, falling as one client grows, down to 0.70.",
            "The range is rounded to two significant figures, because the inputs are not precise enough for more.",
            "The sensitivity table improves one input at a time by a realistic step: earnings up 10%, contract revenue up 15 points, owner-dependence up one point, largest client down 10 points.",
          ],
        },
        {
          kind: "callout",
          tone: "note",
          text: "Use the range to decide what to work on, not to price your business. The top row of the sensitivity table is usually where your next year of effort pays most.",
        },
      ],
    },
  ],
  writes: [
    {
      key: "valuation_range",
      from: (d) => {
        const i = inputsFrom(d);
        const r = i ? valuationRange(i) : null;
        if (!i || !r) return null;
        return { low: r.low, high: r.high, most_sensitive: mostSensitive(i), date: today() };
      },
    },
  ],
};

export const course13Worksheets = [sellabilityScorecard, valuationEstimator];
