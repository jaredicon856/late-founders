import { asNumber, money } from "../profile";
import { BANDS, decide, decisionInputs } from "../quit";
import type { ModeDef, ProfileData } from "../types";
import { SaveError, obj, objArray, str } from "./util";

type DocBlock = ReturnType<ModeDef["onSave"]>["doc"]["blocks"][number];

// Member record written here:
//   quit_decision: { date, band, coverage_months, committed_pct, gaps: {gap, how_to_close}[],
//                    triggers: {condition, target_month}[], inputs: DecisionInputs }

const DISCLAIMER =
  "General guidance only, not financial, tax or legal advice. The recommendation comes from the numbers in your Runway Calculator and Risk Inventory; it is only as accurate as they are.";

function previous(p: ProfileData) {
  const d = obj(p.quit_decision);
  return str(d.band) ? d : null;
}

// The member's offer from Course 05, so gaps on signed revenue can be closed
// in terms of their real package. A price counts as monthly only when it says so.
export function offerSummary(p: ProfileData): { name: string; price: string; monthly: number | null; clientsToMvi: number | null } | null {
  const o = obj(p.offer_record);
  const pkg = obj(o.package);
  const name = str(pkg.name) || str(o.headline);
  const price = str(pkg.price);
  if (!name && !price) return null;
  const n = Number(price.replace(/[^0-9.]/g, ""));
  const monthly = /\/\s*mo|month/i.test(price) && n > 0 ? n : null;
  const mvi = asNumber(p.mvi);
  const committed = asNumber(p.committed_revenue) ?? 0;
  const clientsToMvi = monthly && mvi ? Math.max(0, Math.ceil((mvi - committed) / monthly)) : null;
  return { name, price, monthly, clientsToMvi };
}

function offerLine(p: ProfileData): string {
  const o = offerSummary(p);
  if (!o) return "I do not see an offer from Course 05 yet, so I will talk about signed revenue in general terms. The Offer-Builder Agent sets one.";
  const what = [o.name, o.price && `at ${o.price}`].filter(Boolean).join(" ");
  if (o.clientsToMvi !== null)
    return `Your offer: ${what}. At that monthly price, ${o.clientsToMvi === 0 ? "your signed revenue already covers your MVI" : `${o.clientsToMvi} more signed client${o.clientsToMvi === 1 ? "" : "s"} would close the gap to your MVI`}.`;
  return `Your offer: ${what}.`;
}

function inputsLine(p: ProfileData): string {
  const { inputs } = decisionInputs(p);
  if (!inputs) return "";
  return [
    `MVI ${money(inputs.mvi)}/mo`,
    `burn ${money(inputs.monthly_burn)}/mo`,
    `signed revenue ${money(inputs.committed_revenue)}/mo`,
    `reserve ${money(inputs.reserve)}`,
    `${inputs.open_risk_count} open risk${inputs.open_risk_count === 1 ? "" : "s"}`,
  ].join(", ");
}

export const decisionEngine: ModeDef = {
  assetId: "decision-engine",
  reads: ["founder_type", "freedom_number", "monthly_burn", "mvi", "committed_revenue", "reserve_balance", "open_risk_count", "risk_items", "quit_scenarios", "offer_record", "quit_decision"],
  writes: ["quit_decision"],
  disclaimer: DISCLAIMER,
  systemPrompt: `You run the AI Decision Engine for Course 06, Quit or Stay. You do not ask the member to enter numbers: everything comes from their record (Runway Calculator, Risk Inventory, Founder Diagnostic, and their offer from the Course 05 Offer-Builder Agent).

The system has already computed the recommendation band from the record and shown it in your first message: "Quit now", "Quit in three to six months" or "Stay and build". You never change the band. If the member argues with it or offers different numbers in chat, do not recalculate. Tell them: circumstances change the answer, not inputs. If something real has changed (a contract signed, a debt paid off, a health plan chosen), they update the Runway Calculator or Risk Inventory and come back, and the engine re-reads the record.

The band is not the product. The named gaps are. Your job:
1. Explain the band in two or three plain sentences, using the member's founder type: for a Fresh Start founder "quit" means committing full time instead of taking bridge work; for a First-Timer it means leaving the job; for a Buried Founder it means stepping back from what pays them now.
2. Walk through each named gap shown in your first message, one at a time. For each, work out with the member one concrete way to close it (for example "sign the second retainer with the client already asking", "choose the marketplace plan and close that row"). For a signed-revenue gap, frame it in terms of their actual offer from the record: its package, its price, and how many signed clients at that price close the gap (the system gives that count when the price is monthly; if the price is per project, ask how often a client buys). Use their words. Do not invent clients, figures or plans.
3. Ask for their trigger conditions: the specific, checkable things that must be true before they move ("two signed retainers", "six months of reserve", "health plan in place"). For each, agree a target month with them (YYYY-MM, not in the past). Build only from what they say.
4. Summarise the band, the gaps with how to close each, and the dated triggers, and ask them to confirm. Then call save_output with the band exactly as shown.`,
  opener: (p) => {
    const { inputs, missing } = decisionInputs(p);
    if (!inputs) {
      return [
        "The Decision Engine reads your numbers rather than asking for them, and some are not in yet.",
        `Finish these first: ${missing.join(" and ")}. Then come back here and I will give you a recommendation from your real figures.`,
      ].join("\n\n");
    }
    const d = decide(inputs);
    const lines = [`I read your record: ${inputsLine(p)}.`, offerLine(p)];
    const prev = previous(p);
    if (prev) lines.push(`Last time (${str(prev.date)}) the recommendation was **${str(prev.band)}**. This run uses your record as it is today.`);
    lines.push(`Recommendation: **${d.band}**.`);
    if (d.gaps.length) lines.push(["What stands between you and the next band:", ...d.gaps.map((g) => `- ${g}`)].join("\n"));
    else lines.push("Nothing on your record stands in the way of this band.");
    lines.push(
      d.gaps.length
        ? "Let's take the gaps one at a time and find a concrete way to close each. Starting with the first: what is already in motion that could close it?"
        : "Let's turn this into dates. What has to be true before you make the move, and when?",
    );
    return lines.join("\n\n");
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["band", "explanation", "gaps", "triggers"],
    properties: {
      band: { type: "string", enum: [...BANDS], description: "Exactly the band shown in your first message." },
      explanation: { type: "string", description: "Two or three plain sentences on why this band, for this founder type." },
      gaps: {
        type: "array",
        description: "One entry per named gap shown in your first message, in the same order.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["gap", "how_to_close"],
          properties: {
            gap: { type: "string" },
            how_to_close: { type: "string", description: "The concrete step agreed with the member, in their words." },
          },
        },
      },
      triggers: {
        type: "array",
        description: "The member's own trigger conditions, each with a target month.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["condition", "target_month"],
          properties: {
            condition: { type: "string" },
            target_month: { type: "string", description: "YYYY-MM" },
          },
        },
      },
    },
  },
  onSave: (o, profile) => {
    const { inputs, missing } = decisionInputs(profile);
    if (!inputs) throw new SaveError(`The record is missing: ${missing.join(", ")}. The member must finish those first; do not save.`);
    const d = decide(inputs);
    const band = str(o.band);
    if (band !== d.band) throw new SaveError(`The band from the record is "${d.band}". Save exactly that band; it is not negotiable in chat.`);
    const gaps = objArray(o.gaps).map((g) => ({ gap: str(g.gap), how_to_close: str(g.how_to_close) }));
    if (gaps.length < d.gaps.length) throw new SaveError(`There are ${d.gaps.length} named gaps. Give each one a concrete way to close it.`);
    if (gaps.some((g) => !g.how_to_close)) throw new SaveError("Every gap needs a concrete way to close it, agreed with the member.");
    const thisMonth = new Date().toISOString().slice(0, 7);
    const triggers = objArray(o.triggers).map((t) => ({ condition: str(t.condition), target_month: str(t.target_month) }));
    if (!triggers.length) throw new SaveError("Ask the member for at least one trigger condition with a target month.");
    for (const t of triggers) {
      if (!t.condition) throw new SaveError("A trigger condition is empty.");
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(t.target_month)) throw new SaveError(`"${t.target_month}" is not a month in YYYY-MM form.`);
      if (t.target_month < thisMonth) throw new SaveError(`${t.target_month} is in the past. Agree a future month with the member.`);
    }
    triggers.sort((a, b) => (a.target_month < b.target_month ? -1 : 1));
    const date = new Date().toISOString().slice(0, 10);
    const freedom = asNumber(profile.freedom_number);
    const blocks: DocBlock[] = [
      { type: "big", label: "Recommendation", value: band, note: DISCLAIMER },
      { type: "paragraph", text: str(o.explanation) },
      {
        type: "kv",
        items: [
          { label: "Minimum Viable Income (the gate)", value: `${money(inputs.mvi)}/mo` },
          { label: "Freedom Number (the destination)", value: freedom === null ? "Not set" : `${money(freedom)}/mo` },
          { label: "Signed revenue", value: `${money(inputs.committed_revenue)}/mo (${d.committed_pct}% of MVI)` },
          { label: "Reserve coverage", value: d.coverage_months === null ? "Signed revenue meets your MVI" : `${d.coverage_months} months` },
          { label: "Open risks", value: String(inputs.open_risk_count) },
          { label: "Your offer", value: (() => { const o = offerSummary(profile); return o ? [o.name, o.price].filter(Boolean).join(", ") : "Not set (Course 05)"; })() },
        ],
      },
    ];
    if (gaps.length)
      blocks.push(
        { type: "heading", text: "The gaps, and how you will close them" },
        { type: "table", table: { headers: ["Gap", "How you will close it"], widths: [1.2, 1], rows: gaps.map((g) => [g.gap, g.how_to_close]) } },
      );
    blocks.push(
      { type: "heading", text: "Your timeline" },
      { type: "table", table: { headers: ["Target month", "Trigger condition"], widths: [0.5, 2], rows: triggers.map((t) => [t.target_month, t.condition]) } },
    );

    return {
      profile: {
        quit_decision: { date, band, coverage_months: d.coverage_months, committed_pct: d.committed_pct, gaps, triggers, inputs },
      },
      summary: `${band} · ${gaps.length} gap${gaps.length === 1 ? "" : "s"} · ${triggers.length} trigger${triggers.length === 1 ? "" : "s"}`,
      doc: {
        title: "Quit or Stay Decision",
        eyebrow: "COURSE 06 · QUIT OR STAY",
        purpose: "Your recommendation, the gaps that stand between you and the next band, and the dates you set to close them.",
        blocks,
      },
    };
  },
};

export const course06Modes = [decisionEngine];
