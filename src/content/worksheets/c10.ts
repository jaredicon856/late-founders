import type { ProfileData, SheetData, WorksheetDef } from "../types";

// Member-record fields written here:
//   objection_scripts: { ask; price_line; too_expensive; no_time; think_about_it; follow_up; opener }
// The Discovery Question Sheet is used once per prospect: each completion is a
// version labelled with the prospect, and the sheet is cleared for the next one.

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// ---------------------------------------------------------------------------
// 10.2 Discovery Question Sheet
// ---------------------------------------------------------------------------

export const DISCOVERY_QUESTIONS = [
  ["q1", "1 · Walk me through how you handle this now."],
  ["q2", "2 · What have you already tried?"],
  ["q3", "3 · What is this costing you, in time, money or stress?"],
  ["q4", "4 · If this were handled, what would that let you do that you can't do now?"],
  ["q5", "5 · What happens if this is not solved in your timeframe?"],
] as const;

export const discoverySheet: WorksheetDef = {
  assetId: "discovery-sheet",
  exports: ["pdf", "docx"],
  resetLabel: "Start a new prospect",
  versionLabel: (d) => [text(d.prospect), text(d.company)].filter(Boolean).join(", "),
  sections: [
    {
      title: "Prospect",
      blocks: [
        {
          kind: "callout",
          tone: "legal",
          title: "Recording the call? Ask first",
          text: "Ask permission at the start of every call, before you record: \"Is it OK if I record this, so I can listen properly instead of taking notes?\" Recording without everyone's consent is illegal in several US states, California and Washington among them.",
        },
        {
          kind: "fields",
          fields: [
            { key: "prospect", label: "Name", type: "text", width: "third" },
            { key: "company", label: "Company", type: "text", width: "third" },
            { key: "call_date", label: "Call date", type: "date", width: "third" },
          ],
        },
      ],
    },
    {
      title: "The five questions, in this order",
      intro: "Do not skip ahead and do not pitch in between. Note their words, not your summary of them.",
      blocks: [{ kind: "fields", fields: DISCOVERY_QUESTIONS.map(([key, label]) => ({ key, label, type: "textarea" as const, lines: 3 })) }],
    },
    {
      title: "Sort as they talk",
      intro: "Every statement goes in one column while you listen: how it is now, or how they want it. Sorting live forces you to listen instead of planning your answer.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "grid",
            minRows: 6,
            maxRows: 20,
            addable: true,
            columns: [
              { key: "now", label: "Now", type: "text", width: 1 },
              { key: "wanted", label: "Wanted", type: "text", width: 1 },
            ],
          },
        },
        {
          kind: "fields",
          fields: [
            {
              key: "gap",
              label: "The gap, in one line",
              type: "textarea",
              lines: 2,
              hint: "From Now to Wanted, in the prospect's vocabulary, not yours. No sales calls yet? Practice on your Course 03 interview notes. If they said \"the trucks leave wrong\", do not write \"fulfillment accuracy\".",
            },
          ],
        },
        {
          kind: "checklist",
          key: "ready",
          mode: "check",
          items: [
            { key: "exact", label: "They said it exactly", detail: "You can quote the problem in their words, not your summary." },
            { key: "failed", label: "I know what failed", detail: "What they already tried, and why it did not work." },
            { key: "cost", label: "They named the cost", detail: "In time, money or stress, in their own words." },
          ],
        },
        {
          kind: "computed",
          key: "ready_check",
          label: "Ready to pitch?",
          compute: (d) => {
            const c = d.ready && typeof d.ready === "object" ? (d.ready as Record<string, { done?: boolean }>) : {};
            const n = ["exact", "failed", "cost"].filter((k) => c[k]?.done).length;
            return n === 3 ? "Yes: all three are true. Pitch." : `Not yet: ${n} of 3. Keep asking before you pitch.`;
          },
        },
      ],
    },
  ],
  completeCheck: (d) => {
    if (!text(d.prospect)) return "Add the prospect's name, so this call is filed under them.";
    if (!text(d.gap)) return "Write the gap in one line, in the prospect's words.";
    return null;
  },
};

// ---------------------------------------------------------------------------
// 10.3 Objection-Handling Script Library
// ---------------------------------------------------------------------------

export const SCRIPT_SLOTS = [
  ["ask", "Your ask", "Stated as a proposal, not a suggestion."],
  ["price_line", "Your price, with its anchor", "The anchor is the cost they named in discovery. Say it, say the number, then stop talking."],
  ["too_expensive", "\"It's too expensive.\"", "Word for word."],
  ["no_time", "\"I don't have time right now.\"", "Word for word."],
  ["think_about_it", "\"Let me think about it.\"", "Word for word."],
  ["follow_up", "Your standing follow-up question", "Asked after every objection, before you answer it."],
  ["opener", "Your pitch opener", "Built from the three phrases above, in their words."],
] as const;

type Offer = { price_sentence?: string; package?: { price?: string; timeline?: string; scope?: string } };

export function starterScripts(p: ProfileData): SheetData {
  const offer = (p.offer_record && typeof p.offer_record === "object" ? p.offer_record : {}) as Offer;
  const price = text(offer.package?.price);
  return {
    ask: "Based on what you have told me, I'd do [package] for [price], starting [date]. Shall I send the agreement today?",
    price_line: price
      ? `You said this is costing you [the cost they named]. The full engagement is ${price}.`
      : "You said this is costing you [the cost they named]. The full engagement is [price].",
    too_expensive: "That's fair. Against [the cost they named] of leaving it as it is, is it the amount, or is the budget genuinely not there right now?",
    no_time: "Understood. Is it the time to do the work, or the time to make the decision? The work takes about [hours] a week from you.",
    think_about_it: "Of course. So I know what to send, what part do you want to think through?",
    follow_up: "Is that the whole thing, or is there something else going on?",
    phrase1: "",
    phrase2: "",
    phrase3: "",
    opener: "",
  };
}

const scripts = (d: SheetData) => Object.fromEntries(SCRIPT_SLOTS.map(([k]) => [k, text(d[k])]));

export const objectionLibrary: WorksheetDef = {
  assetId: "objection-library",
  exports: ["pdf", "docx"],
  reads: ["offer_record"],
  initial: (p) => starterScripts(p),
  sections: [
    {
      title: "Read before every call",
      blocks: [
        {
          kind: "computed",
          key: "card",
          label: "Your lines",
          compute: (d) => {
            const rows = SCRIPT_SLOTS.map(([k, label]) => [label, text(d[k]) || "Not written yet"]);
            return { headers: ["When", "Say"], rows };
          },
        },
      ],
    },
    {
      title: "Rewrite each line until it sounds like you",
      intro: "Each slot starts with a draft. Rewrite every one in your own words: if a line is not yours, you will not say it under pressure.",
      blocks: [
        {
          kind: "fields",
          fields: SCRIPT_SLOTS.filter(([k]) => k !== "opener").map(([key, label, hint]) => ({ key, label, hint, type: "textarea" as const, lines: 2 })),
        },
      ],
    },
    {
      title: "Your pitch opener",
      intro: "Three phrases prospects actually said on calls, word for word. Then build your opener from them.",
      blocks: [
        {
          kind: "fields",
          fields: [
            { key: "phrase1", label: "Phrase 1", type: "text", width: "third" },
            { key: "phrase2", label: "Phrase 2", type: "text", width: "third" },
            { key: "phrase3", label: "Phrase 3", type: "text", width: "third" },
            { key: "opener", label: "Your opener", type: "textarea", lines: 3, hint: "Use their phrases, not your category language." },
          ],
        },
      ],
    },
  ],
  writes: [{ key: "objection_scripts", from: (d) => scripts(d) }],
};

export const course10Worksheets = [discoverySheet, objectionLibrary];
