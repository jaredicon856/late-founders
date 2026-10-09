import type { SheetData, WorksheetDef } from "../types";
import { asNumber } from "../profile";

const rows = (d: SheetData, k: string) => (Array.isArray(d[k]) ? (d[k] as Record<string, unknown>[]) : []);

export const hiddenAssetsInventory: WorksheetDef = {
  assetId: "hidden-assets-inventory",
  exports: ["pdf", "xlsx"],
  dense: true, // spec: must print to a single page
  sections: [
    {
      title: "1 · Experience",
      intro: "Five skills, each with an outcome you can put a number or a result on.",
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
      intro: "Twenty names and where you know them from. The last five rows are your top five, each with one specific ask.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "network",
            minRows: 20,
            maxRows: 20,
            columns: [
              { key: "name", label: "Name", type: "text", width: 1.2 },
              { key: "source", label: "Where you know them from", type: "text", width: 1.6 },
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
            { key: "runway_months", label: "Runway in months", type: "number", width: "half" },
            { key: "financial_standing", label: "Available financial standing ($)", type: "money", width: "half" },
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
        judgment: d.judgment ?? "",
      }),
    },
  ],
};

export const ninetyDayCommitment: WorksheetDef = {
  assetId: "ninety-day-commitment",
  exports: ["pdf", "docx"],
  reads: ["origin_story", "journal_entries"],
  initial: (p) => ({ origin_story: typeof p.origin_story === "string" ? p.origin_story : "" }),
  sections: [
    {
      title: "The commitment",
      blocks: [
        {
          kind: "fields",
          fields: [
            { key: "start_date", label: "Start date", type: "date", width: "half" },
            { key: "end_date", label: "End date", type: "date", width: "half" },
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
