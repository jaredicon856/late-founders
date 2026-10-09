import { FOUNDER_TYPE_COPY, ROUTES, courseLabel } from "../catalog";
import { asNumber, money } from "../profile";
import type { ModeDef } from "../types";
import { SaveError, str, strArray, obj } from "./util";

export const founderDiagnostic: ModeDef = {
  assetId: "founder-diagnostic",
  reads: [],
  writes: ["founder_type", "freedom_number", "first_five_moves", "ninety_day_target", "diagnostic_summary"],
  systemPrompt: `You run the Late Founders Founder Diagnostic: a guided interview of 15 to 20 minutes that every member starts with.

Run five stages in order, one question at a time, adapting follow-ups to what the member said:
1. Situation: what is happening in their working life now, and what changed.
2. Money and runway: monthly living costs (ask for the actual figure), savings or severance, any income still coming in, and what monthly income would let them stop worrying.
3. Hours: realistic hours per week they can put into building, given everything else.
4. Blocks: what is stopping them right now, in their words.
5. Skills and network: what they are good at that people have paid for, and who they know.

This must feel like a conversation, not a form. Acknowledge briefly, then ask the next thing. Never ask more than one question per message. Tell the member which stage you are on when you move to a new one.

Classify founder type:
- "Fresh Start": something ended (layoff, exit, retirement, a role closed). They have runway and a decision to make.
- "First-Timer": still employed, building on the side for the first time.
- "Buried Founder": already runs a business and is buried in it: the business depends on them.

Freedom Number: a monthly dollar figure built ONLY from amounts the member stated: their monthly living costs plus the monthly margin they said they want on top (debt paydown, savings, the life they described). If they have not given a figure, ask for it. Do not estimate, round up, or add a cushion they did not ask for. You list the components; the system adds them.

First five moves: five specific, ordered actions that fit their type, hours and blocks. Each starts with a verb and could be done this month. Use the Command Center's tools where they fit (Hidden Assets Inventory, Buyer-Interview Script Generator, Owner's Audit and so on).

90-day target: one measurable outcome they would be able to say yes or no to on day 90.

When all five stages are covered, summarise what you heard in a few lines and ask the member to confirm or correct it. Only after they confirm, call save_output.`,
  opener: () =>
    "Welcome to Late Founders. This first conversation takes 15 to 20 minutes, and everything else in the Command Center builds on it, so you will only do it once.\n\nWe will go through five things: your situation, money and runway, the hours you have, what is in the way, and what you already bring. One question at a time.\n\nStage 1, your situation. What is going on in your working life right now, and what changed to bring you here?",
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: [
      "founder_type",
      "founder_type_reason",
      "freedom_components",
      "first_five_moves",
      "ninety_day_target",
      "hours_per_week",
      "summary",
    ],
    properties: {
      founder_type: { type: "string", enum: ["Fresh Start", "First-Timer", "Buried Founder"] },
      founder_type_reason: { type: "string", description: "Two sentences, in plain words, on why this type fits." },
      freedom_components: {
        type: "array",
        description: "Each monthly amount the member stated that makes up the Freedom Number. Only member-stated figures.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "monthly_amount", "member_words"],
          properties: {
            label: { type: "string" },
            monthly_amount: { type: "number" },
            member_words: { type: "string", description: "What the member said that gives this figure." },
          },
        },
      },
      first_five_moves: { type: "array", items: { type: "string" }, description: "Exactly five, in order." },
      ninety_day_target: { type: "string" },
      hours_per_week: { type: "number" },
      summary: { type: "string", description: "Three to five sentences on where the member stands." },
    },
  },
  onSave: (o) => {
    const type = str(o.founder_type);
    if (!ROUTES[type]) throw new SaveError("founder_type must be Fresh Start, First-Timer or Buried Founder.");
    const comps = (Array.isArray(o.freedom_components) ? o.freedom_components : []).map(obj);
    if (!comps.length) throw new SaveError("No Freedom Number components. Ask the member for their monthly living costs before saving.");
    const freedom = comps.reduce((s, c) => s + (asNumber(c.monthly_amount) ?? 0), 0);
    if (!(freedom > 0)) throw new SaveError("Freedom Number components add up to zero. Ask the member for the figures.");
    const moves = strArray(o.first_five_moves);
    if (moves.length !== 5) throw new SaveError(`first_five_moves must have exactly five items; got ${moves.length}.`);
    const target = str(o.ninety_day_target);
    if (!target) throw new SaveError("ninety_day_target is empty.");

    const route = ROUTES[type];
    return {
      profile: {
        founder_type: type,
        freedom_number: Math.round(freedom),
        first_five_moves: moves,
        first_five_done: [false, false, false, false, false],
        ninety_day_target: target,
        diagnostic_summary: {
          reason: str(o.founder_type_reason),
          summary: str(o.summary),
          hours_per_week: asNumber(o.hours_per_week),
          freedom_components: comps,
        },
      },
      summary: `${type} · Freedom Number ${money(freedom)}/mo`,
      doc: {
        title: "Founder Diagnostic Results",
        eyebrow: "COURSE 01 · START HERE: THE FOUNDER DIAGNOSTIC",
        purpose: "Your founder type, Freedom Number, first five moves and 90-day target.",
        blocks: [
          { type: "big", label: "Founder type", value: type, note: FOUNDER_TYPE_COPY[type] },
          { type: "paragraph", text: str(o.founder_type_reason) },
          { type: "big", label: "Freedom Number", value: `${money(freedom)}/mo`, note: "The destination. Not the point at which you quit." },
          {
            type: "table",
            table: {
              headers: ["Component", "Monthly", "What you said"],
              widths: [1.2, 0.7, 2.4],
              rows: comps.map((c) => [str(c.label), money(asNumber(c.monthly_amount)), str(c.member_words)]),
              totalRow: ["Freedom Number", money(freedom), ""],
            },
          },
          { type: "heading", text: "Your first five moves" },
          { type: "bullets", items: moves, style: "checkbox" },
          { type: "heading", text: "90-day target" },
          { type: "paragraph", text: target, tone: "accent" },
          { type: "heading", text: "Where you stand" },
          { type: "paragraph", text: str(o.summary) },
          // One line, so the results sheet stays on a single page.
          { type: "kv", items: [{ label: "Your route", value: route.map((n) => courseLabel(n).replace("Course ", "")).join(" → ") }] },
        ],
      },
    };
  },
};

export const course01Modes = [founderDiagnostic];
