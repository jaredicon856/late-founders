import { asNumber } from "../profile";
import type { ModeDef, ProfileData } from "../types";
import { SaveError, str, strArray, obj, objArray } from "./util";

// 10-Year Roadmap Builder. Member-record shape written here:
//   roadmap: {
//     target_outcome: "Full sale" | "Partial sale" | "Step-back";
//     target_year: number;
//     created_at: string;            // YYYY-MM-DD, first save
//     updated_at: string;            // YYYY-MM-DD, this save
//     first_review: string;          // YYYY-MM-DD, 12 months after the first save (kept on later saves)
//     next_review: string;           // YYYY-MM-DD, 12 months after this save
//     scorecard_gaps: string[];      // lowest_two from transferability_scores at save time
//     baseline: { recurring_revenue_pct: number|null; owner_dependence: number|null;
//                 data_room_completeness: number|null; earnings_trend: string };
//     checkpoints: { year: number; years_from_now: number; label: string; phase: string;
//                    must_be_true: string[]; gaps_addressed: string[];
//                    metrics: { recurring_revenue_pct: number; owner_dependence: number;
//                               data_room_completeness: number; earnings_trend: string } }[];
//                    // ordered from the target year back to this year
//     decision_checkpoint: { year: number; status: "open"; question: string; inputs_to_review: string[] };
//   }

type DocBlock = ReturnType<ModeDef["onSave"]>["doc"]["blocks"][number];

const OUTCOMES = ["Full sale", "Partial sale", "Step-back"] as const;
const TRENDS = ["Declining", "Flat", "Growing", "Growing steadily"] as const;
const DRIVER_LABELS: Record<string, string> = {
  client_concentration: "Client concentration",
  earnings_trend: "Earnings trend",
  owner_dependence: "Owner-dependence",
  recurring_revenue: "Recurring revenue",
  documented_systems: "Documented systems",
  team_depth: "Team depth",
  contract_ip_hygiene: "Contract and IP hygiene",
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
function plusMonths(base: Date, months: number): string {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, base.getUTCDate()));
  // Clamp month overflow (e.g. 31 Jan + 1 month).
  if (d.getUTCDate() !== base.getUTCDate()) d.setUTCDate(0);
  return iso(d);
}

// Checkpoints counted back from the target: the target year, then years 8, 6, 4 and 2, then this year.
// Only the offsets that fall before the target year are used.
export function checkpointOffsets(horizon: number): number[] {
  return [horizon, ...[8, 6, 4, 2].filter((o) => o < horizon), 0];
}

// Curriculum phase for a checkpoint, by how far through the horizon it sits.
export function phaseFor(offset: number, horizon: number): string {
  if (offset === horizon) return "Target year: decision point";
  const f = offset / horizon;
  if (f < 0.34) return "Early: transferability baseline and first documentation";
  if (f < 0.67) return "Middle: recurring revenue conversion and systems maturity";
  return "Late: full data room review and practised absences";
}

function labelFor(offset: number, horizon: number): string {
  if (offset === 0) return "This year";
  if (offset === horizon) return "Target year";
  return `Year ${offset}`;
}

function scorecardSummary(p: ProfileData) {
  const ts = obj(p.transferability_scores);
  const drivers = obj(ts.drivers);
  return {
    present: Object.keys(ts).length > 0,
    date: str(ts.date),
    total: asNumber(ts.total),
    lowest: strArray(ts.lowest_two),
    owner: asNumber(drivers.owner_dependence),
    drivers: Object.entries(DRIVER_LABELS)
      .map(([k, label]) => ({ label, score: asNumber(drivers[k]) }))
      .filter((d) => d.score !== null && d.score > 0),
  };
}

const metricSchema = {
  type: "object",
  additionalProperties: false,
  required: ["recurring_revenue_pct", "owner_dependence", "data_room_completeness", "earnings_trend"],
  properties: {
    recurring_revenue_pct: { type: "number", description: "Target % of revenue that recurs, 0-100." },
    owner_dependence: { type: "number", description: "Target owner-dependence score, 1-5 (5 = runs without the owner)." },
    data_room_completeness: { type: "number", description: "Target % of the data room filled, 0-100." },
    earnings_trend: { type: "string", enum: [...TRENDS] },
  },
};

export const roadmapBuilder: ModeDef = {
  assetId: "roadmap-builder",
  persistent: true,
  reads: ["transferability_scores", "valuation_range", "roadmap"],
  writes: ["roadmap"],
  systemPrompt: `You are the 10-Year Roadmap Builder: a long-horizon planner that works backward from the member's exit to what must be true this year. This workspace is kept across sessions and years; when a roadmap already exists, you are running its annual review, so start from it and update it rather than starting again.

Steps, one question at a time:
1. Target outcome: full sale, partial sale, or step-back (the member keeps ownership but stops running it). Explain the three briefly if they are unsure.
2. Target year: a calendar year in the future. Ten years out is typical; accept what they choose.
3. Baseline for the four annual metrics: recurring revenue % today, owner-dependence score (take it from the Sellability Scorecard when present, do not ask again), data room completeness % today (how much of the Financial, Legal, Operational, IP and HR folders is filled), and the earnings trend over the last three years. If the member does not know a figure, record it as unknown (null); never estimate it.
4. Work backward. Checkpoints run from the target year, then year 8, 6, 4 and 2, then this year (skip any that fall on or after the target year). For each, write what must be true by then: two to four concrete, checkable statements. Map the curriculum phases onto them:
   - Early years: transferability baseline and first documentation (Owner's Audit, task sort, first SOPs, dashboard, Sellability Scorecard).
   - Middle years: recurring revenue conversion and systems maturity (retainers and contracts, full SOP Library, a team that runs the dashboard, delegation).
   - Late years: full data room review and practised absences (the One-Week-Away Test stretched to a month, a clean data room, clean financial history).
5. Pull in the scorecard gaps. The member's two lowest value drivers must be addressed in this year's checkpoint and named in its gaps_addressed, and any other driver scored 1 or 2 should appear in an early checkpoint. Use the driver names exactly as listed in the record. If there is no scorecard yet, say so and suggest completing the Sellability Scorecard first; you may continue without it.
6. Give each checkpoint a target for the four metrics: recurring revenue %, owner-dependence score (1 to 5), data room completeness %, and earnings trend. Targets should improve steadily toward the target year.
7. The target year carries a decision checkpoint: sell or step back. It is open. Do not ask the member to decide it now and do not recommend one. Write the question as it will be asked then, and the inputs they will review.

Do not promise a sale price, a buyer or a result. The system schedules the first annual review twelve months from today; tell the member that date only after saving.

Before saving, show the roadmap from this year forward in a few lines and ask the member to confirm or change it.`,
  opener: (p) => {
    const sc = scorecardSummary(p);
    const existing = obj(p.roadmap);
    const lines: string[] = [];
    if (existing.target_year) {
      lines.push(
        `Welcome back. Your roadmap targets a ${str(existing.target_outcome).toLowerCase() || "exit"} in ${str(existing.target_year)}${existing.next_review ? `, with an annual review due ${str(existing.next_review)}` : ""}.`,
      );
    } else {
      lines.push("This is your 10-year roadmap. We start at the end, the year you sell or step back, and work back to what has to be true this year.");
    }
    if (sc.present) {
      const bits = [`I have your Sellability Scorecard${sc.date ? ` from ${sc.date}` : ""}`];
      if (sc.total !== null) bits.push(`total ${sc.total} out of 54`);
      if (sc.lowest.length) bits.push(`your two lowest drivers are ${sc.lowest.join(" and ")}`);
      if (sc.owner !== null) bits.push(`owner-dependence is ${sc.owner} out of 5`);
      lines.push(bits.join(", ") + ". Your early checkpoints will be built around those gaps.");
    } else {
      lines.push(
        "I don't have a Sellability Scorecard for you yet. The roadmap is much sharper with one, because your lowest scores set this year's work. You can complete the scorecard first, or we can start now and add it later.",
      );
    }
    lines.push(
      existing.target_year
        ? "Has anything changed this year that should move the target outcome or the target year?"
        : "First question: what outcome are you building toward: a full sale, a partial sale, or stepping back while you keep ownership?",
    );
    return lines.join("\n\n");
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["target_outcome", "target_year", "baseline", "checkpoints", "decision_question", "decision_inputs"],
    properties: {
      target_outcome: { type: "string", enum: [...OUTCOMES] },
      target_year: { type: "number", description: "Calendar year, in the future." },
      baseline: {
        type: "object",
        additionalProperties: false,
        required: ["recurring_revenue_pct", "owner_dependence", "data_room_completeness", "earnings_trend"],
        properties: {
          recurring_revenue_pct: { type: ["number", "null"], description: "Today, as the member stated. Null if unknown." },
          owner_dependence: { type: ["number", "null"], description: "From the scorecard, 1-5. Null if unknown." },
          data_room_completeness: { type: ["number", "null"], description: "Today, 0-100. Null if unknown." },
          earnings_trend: { type: "string", enum: [...TRENDS, "Unknown"] },
        },
      },
      checkpoints: {
        type: "array",
        description: "One per checkpoint: target year, years 8, 6, 4, 2 (those before the target year), and this year (0).",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["years_from_now", "must_be_true", "gaps_addressed", "metrics"],
          properties: {
            years_from_now: { type: "number", description: "0 for this year; the target year's offset for the final checkpoint." },
            must_be_true: { type: "array", items: { type: "string" } },
            gaps_addressed: { type: "array", items: { type: "string" }, description: "Scorecard value-driver names this checkpoint closes." },
            metrics: metricSchema,
          },
        },
      },
      decision_question: { type: "string", description: "The open sell-or-step-back question, as it will be asked in the target year." },
      decision_inputs: { type: "array", items: { type: "string" }, description: "What the member will review to decide then." },
    },
  },
  onSave: (o, p) => {
    const now = new Date();
    const thisYear = now.getUTCFullYear();
    const today = iso(now);

    const outcome = str(o.target_outcome);
    if (!(OUTCOMES as readonly string[]).includes(outcome)) throw new SaveError("target_outcome must be Full sale, Partial sale or Step-back.");
    const targetYear = asNumber(o.target_year);
    if (targetYear === null || !Number.isInteger(targetYear)) throw new SaveError("target_year must be a whole calendar year, e.g. 2036.");
    if (targetYear <= thisYear) throw new SaveError(`target_year must be after ${thisYear}. Ask the member for a year in the future.`);
    if (targetYear > thisYear + 30) throw new SaveError("target_year is more than 30 years out. Confirm the year with the member.");
    const horizon = targetYear - thisYear;
    const expected = checkpointOffsets(horizon);

    const raw = objArray(o.checkpoints);
    const byOffset = new Map<number, Record<string, unknown>>();
    for (const c of raw) {
      const off = asNumber(c.years_from_now);
      if (off === null || !expected.includes(off)) {
        throw new SaveError(`Checkpoint years_from_now ${str(c.years_from_now)} is not expected. Use exactly: ${expected.join(", ")}.`);
      }
      if (byOffset.has(off)) throw new SaveError(`Two checkpoints for years_from_now ${off}. Merge them.`);
      byOffset.set(off, c);
    }
    const missing = expected.filter((e) => !byOffset.has(e));
    if (missing.length) throw new SaveError(`Missing checkpoints for years_from_now: ${missing.join(", ")}. Write what must be true for each.`);

    const sc = scorecardSummary(p);
    const checkpoints = expected.map((off) => {
      const c = byOffset.get(off) as Record<string, unknown>;
      const mbt = strArray(c.must_be_true);
      if (!mbt.length) throw new SaveError(`The ${labelFor(off, horizon).toLowerCase()} checkpoint has nothing in must_be_true.`);
      const m = obj(c.metrics);
      const rr = asNumber(m.recurring_revenue_pct);
      const od = asNumber(m.owner_dependence);
      const dr = asNumber(m.data_room_completeness);
      const label = labelFor(off, horizon);
      if (rr === null || rr < 0 || rr > 100) throw new SaveError(`${label}: recurring_revenue_pct must be 0 to 100.`);
      if (od === null || od < 1 || od > 5) throw new SaveError(`${label}: owner_dependence must be 1 to 5.`);
      if (dr === null || dr < 0 || dr > 100) throw new SaveError(`${label}: data_room_completeness must be 0 to 100.`);
      const trend = str(m.earnings_trend);
      if (!(TRENDS as readonly string[]).includes(trend)) throw new SaveError(`${label}: earnings_trend must be one of ${TRENDS.join(", ")}.`);
      return {
        year: thisYear + off,
        years_from_now: off,
        label,
        phase: phaseFor(off, horizon),
        must_be_true: mbt,
        gaps_addressed: strArray(c.gaps_addressed),
        metrics: { recurring_revenue_pct: Math.round(rr), owner_dependence: Math.round(od * 10) / 10, data_room_completeness: Math.round(dr), earnings_trend: trend },
      };
    });

    // This year's checkpoint must address the scorecard's two lowest drivers.
    if (sc.lowest.length) {
      const first = checkpoints[checkpoints.length - 1];
      const addressed = first.gaps_addressed.map((g) => g.toLowerCase());
      const notAddressed = sc.lowest.filter((g) => !addressed.includes(g.toLowerCase()));
      if (notAddressed.length) {
        throw new SaveError(
          `This year's checkpoint must address the member's two lowest scorecard drivers. Add ${notAddressed.join(" and ")} to its gaps_addressed with a matching must_be_true statement.`,
        );
      }
    }

    const decisionQuestion = str(o.decision_question);
    if (!decisionQuestion) throw new SaveError("decision_question is empty. Write the open sell-or-step-back question for the target year.");
    const decisionInputs = strArray(o.decision_inputs);

    const b = obj(o.baseline);
    const bnum = (v: unknown, lo: number, hi: number) => {
      const n = asNumber(v);
      return n !== null && n >= lo && n <= hi ? n : null;
    };
    const baseline = {
      recurring_revenue_pct: bnum(b.recurring_revenue_pct, 0, 100),
      owner_dependence: sc.owner ?? bnum(b.owner_dependence, 1, 5),
      data_room_completeness: bnum(b.data_room_completeness, 0, 100),
      earnings_trend: str(b.earnings_trend) || "Unknown",
    };

    const prev = obj(p.roadmap);
    const createdAt = str(prev.created_at) || today;
    const firstReview = str(prev.first_review) || plusMonths(now, 12);
    const nextReview = plusMonths(now, 12);

    const roadmap = {
      target_outcome: outcome,
      target_year: targetYear,
      created_at: createdAt,
      updated_at: today,
      first_review: firstReview,
      next_review: nextReview,
      scorecard_gaps: sc.lowest,
      baseline,
      checkpoints,
      decision_checkpoint: {
        year: targetYear,
        status: "open" as const,
        question: decisionQuestion,
        inputs_to_review: decisionInputs,
      },
    };

    const showNum = (n: number | null, suffix = "") => (n === null ? "Unknown" : `${n}${suffix}`);
    const blocks: DocBlock[] = [
      {
        type: "kv",
        items: [
          { label: "Target outcome", value: outcome },
          { label: "Target year", value: String(targetYear) },
          { label: "First annual review", value: firstReview },
          { label: "Next annual review", value: nextReview },
        ],
      },
    ];
    if (sc.lowest.length) {
      blocks.push({
        type: "callout",
        tone: "note",
        title: "Built around your scorecard gaps",
        text: `Your two lowest value drivers, ${sc.lowest.join(" and ")}, are this year's work.`,
      });
    }
    blocks.push(
      { type: "heading", text: "The four numbers you review every year" },
      {
        type: "table",
        table: {
          headers: ["Checkpoint", "Year", "Recurring revenue", "Owner-dependence", "Data room", "Earnings trend"],
          widths: [1.1, 0.6, 1, 1, 0.9, 1.1],
          rows: [
            [
              "Today",
              String(thisYear),
              showNum(baseline.recurring_revenue_pct, "%"),
              showNum(baseline.owner_dependence, " / 5"),
              showNum(baseline.data_room_completeness, "%"),
              baseline.earnings_trend,
            ],
            ...[...checkpoints].reverse().map((c) => [
              c.label,
              String(c.year),
              `${c.metrics.recurring_revenue_pct}%`,
              `${c.metrics.owner_dependence} / 5`,
              `${c.metrics.data_room_completeness}%`,
              c.metrics.earnings_trend,
            ]),
          ],
        },
      },
      { type: "heading", text: "Working back from the target year" },
    );
    for (const c of checkpoints) {
      blocks.push({ type: "subheading", text: `${c.label} · ${c.year}` });
      blocks.push({ type: "paragraph", text: c.phase, tone: "muted" });
      blocks.push({ type: "bullets", items: c.must_be_true, style: "checkbox" });
      if (c.gaps_addressed.length) blocks.push({ type: "paragraph", text: `Closes: ${c.gaps_addressed.join(", ")}` });
    }
    blocks.push(
      { type: "heading", text: `Decision checkpoint · ${targetYear}` },
      {
        type: "callout",
        tone: "note",
        title: "Sell or step back: open",
        text: "You do not decide this now. You decide it in the target year, with the numbers in front of you.",
      },
      { type: "paragraph", text: decisionQuestion, tone: "accent" },
    );
    if (decisionInputs.length) blocks.push({ type: "bullets", items: decisionInputs });

    return {
      profile: { roadmap },
      summary: `${outcome} in ${targetYear} · first review ${firstReview}`,
      doc: {
        title: "10-Year Roadmap",
        eyebrow: "COURSE 13 · THE 10-YEAR BUILD-TO-SELL PLAN",
        purpose: `What must be true each checkpoint between now and a ${outcome.toLowerCase()} in ${targetYear}.`,
        blocks,
      },
    };
  },
};

export const course13Modes = [roadmapBuilder];
