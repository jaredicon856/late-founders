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
  ["q4", "4 · If this were handled, what would it free up?"],
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
              hint: "From Now to Wanted, in the prospect's vocabulary, not yours. If they said \"the trucks leave wrong\", do not write \"fulfillment accuracy\".",
            },
          ],
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
  ["price_line", "Your price, with its anchor", "Written to be said word for word. The anchor comes first."],
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
    ask: "Based on what you have told me, I suggest we start with [package] on [date]. Shall I send the agreement today?",
    price_line: price
      ? `Most firms spend [what the problem costs them] on this every year. The full engagement is ${price}.`
      : "Most firms spend [what the problem costs them] on this every year. The full engagement is [price].",
    too_expensive: "That is fair to raise. Compared with what, the cost of fixing it, or the cost of leaving it as it is?",
    no_time: "That makes sense. Is it that this is not a priority right now, or that you cannot see how to fit the work in?",
    think_about_it: "Of course. So I know what to send, what part do you want to think through?",
    follow_up: "Can you say more about that?",
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
