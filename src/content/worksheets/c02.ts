import type { SheetData, WorksheetDef } from "../types";
import { asNumber } from "../profile";

const addDays = (iso: string, days: number) => {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
};

const rows = (d: SheetData, k: string) => (Array.isArray(d[k]) ? (d[k] as Record<string, unknown>[]) : []);

export const hiddenAssetsInventory: WorksheetDef = {
  assetId: "hidden-assets-inventory",
  exports: ["pdf", "xlsx"],
  dense: true, // spec: must print to a single page
  sections: [
    {
      title: "1 · Experience",
      intro: "Five skills, each with an outcome you can put a number or a result on.",
      screenNote: "Example: \"Supplier negotiation: cut costs 18% in year one.\" If a skill has no number yet, name the result someone saw. The judgment underneath each skill goes in section 4.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "experience",
            minRows: 5,
            maxRows: 5,
            columns: [
              { key: "skill", label: "Skill", type: "text", width: 1 },
              { key: "outcome", label: "Concrete outcome (a number or a result)", type: "text", width: 2 },
            ],
          },
        },
      ],
    },
    {
      title: "2 · Network",
      intro: "Twenty names and where you know them from. Then pick your top five below, each with one specific ask.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "network",
            minRows: 20,
            maxRows: 20,
            twoUp: true,
            columns: [
              { key: "name", label: "Name", type: "text", width: 1.2 },
              { key: "source", label: "Where you know them from", type: "text", width: 1.6 },
              { key: "could", label: "How they help", type: "select", options: ["Refer", "Buy", "Advise", "Introduce", "Vouch"], width: 0.9 },
            ],
          },
        },
        {
          kind: "table",
          label: "Top five",
          table: {
            key: "top_five",
            minRows: 5,
            maxRows: 5,
            highlightFrom: 0,
            columns: [
              { key: "name", label: "Name", type: "text", width: 1 },
              { key: "ask", label: "One specific ask", type: "text", width: 2.4 },
            ],
          },
        },
      ],
    },
    {
      title: "3 · Capital",
      blocks: [
        {
          kind: "fields",
          fields: [
            {
              key: "runway_months", label: "Runway in months", type: "number", width: "third",
              screenHint: "How many months you could cover your living costs with no new income.",
            },
            {
              key: "financial_standing", label: "Available financial standing ($)", type: "money", width: "third",
              screenHint: "Money you could put into the business without risking the essentials.",
            },
            {
              key: "launch_minimum", label: "Smallest amount to launch ($)", type: "money", width: "third",
              screenHint: "The least you need to run a first real test. Often much less than you think.",
            },
            {
              key: "capital_kinds", label: "Kinds of capital you could use", type: "text",
              placeholder: "Savings, severance, a partner, customer pre-sales, a small loan…",
            },
          ],
        },
      ],
    },
    {
      title: "4 · Judgment",
      blocks: [
        {
          kind: "fields",
          fields: [
            {
              key: "judgment",
              label: "Your pattern recognition, in your own words",
              type: "textarea",
              lines: 3,
              placeholder: "What do you see coming before other people in your field do?",
              screenHint: "What you can judge that others can't. For example: \"I can tell a realistic plan from a wishful one.\"",
            },
          ],
        },
      ],
    },
  ],
  writes: [
    {
      key: "hidden_assets",
      from: (d) => ({
        experience: rows(d, "experience").filter((r) => r.skill || r.outcome),
        network: rows(d, "network").filter((r) => r.name),
        top_five: rows(d, "top_five").filter((r) => r.name),
        runway_months: asNumber(d.runway_months),
        financial_standing: asNumber(d.financial_standing),
        launch_minimum: asNumber(d.launch_minimum),
        capital_kinds: d.capital_kinds ?? "",
        judgment: d.judgment ?? "",
      }),
    },
  ],
};

export const ninetyDayCommitment: WorksheetDef = {
  assetId: "ninety-day-commitment",
  exports: ["pdf", "docx"],
  reads: ["origin_story", "journal_entries", "ninety_day_target"],
  initial: (p) => ({ origin_story: typeof p.origin_story === "string" ? p.origin_story : "" }),
  // The end date follows the start date by 90 days, and can never sit before it.
  derive: (changed, d) => {
    const start = typeof d.start_date === "string" ? d.start_date : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return {};
    const end = typeof d.end_date === "string" ? d.end_date : "";
    if (changed === "start_date" || (changed === "end_date" && end && end < start)) return { end_date: addDays(start, 90) };
    return {};
  },
  sections: [
    {
      title: "The commitment",
      blocks: [
        {
          kind: "computed",
          key: "target",
          label: "Your 90-day target, from the Founder Diagnostic",
          compute: (_d, p) => (typeof p.ninety_day_target === "string" && p.ninety_day_target.trim() ? p.ninety_day_target : "Not set yet. Your Founder Diagnostic sets it."),
        },
        {
          kind: "callout",
          tone: "note",
          text: "This worksheet is how you reach that target: the daily action is what you do every day, and the enough number is the result on day 90 that tells you it worked.",
        },
        {
          kind: "fields",
          fields: [
            { key: "start_date", label: "Start date", type: "date", width: "half" },
            { key: "end_date", label: "End date", type: "date", width: "half", screenHint: "Fills in as 90 days after your start date." },
            {
              key: "daily_action",
              label: "Minimum daily founder action",
              type: "text",
              hint: "Small enough to do on your worst day. Thirty minutes of outreach counts; \"work on the business\" does not.",
            },
            {
              key: "enough_number",
              label: "Enough number",
              type: "text",
              hint: "The result at day 90 that tells you this worked.",
            },
            {
              key: "origin_story",
              label: "Your origin story in one line",
              type: "textarea",
              lines: 2,
              hint: "Pulled from your Reframing Journal when you have one.",
            },
          ],
        },
      ],
    },
    {
      title: "Sign it",
      blocks: [
        {
          kind: "callout",
          tone: "note",
          text: "A bounded commitment fails visibly. An open intention fades. Sign this, date it, and have someone witness it.",
        },
        {
          kind: "fields",
          fields: [
            { key: "signature", label: "Signature", type: "signature", width: "half" },
            { key: "signed_date", label: "Date", type: "date", width: "half" },
            { key: "witness", label: "Witness name", type: "text", width: "half" },
          ],
        },
      ],
    },
  ],
  writes: [
    {
      key: "commitment",
      from: (d) => ({
        start_date: d.start_date ?? "",
        end_date: d.end_date ?? "",
        daily_action: d.daily_action ?? "",
        enough_number: d.enough_number ?? "",
      }),
    },
  ],
};

export const course02Worksheets = [hiddenAssetsInventory, ninetyDayCommitment];
