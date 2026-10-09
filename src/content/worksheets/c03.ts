// Course 03 worksheets.
//
// interview_signal_tally (agreed shape, read by the Go/No-Go Scorecard):
//   { logged: number; completed: number; strong: number; weak: number;
//     prior_spend: number; target: 10; threshold: 7; quotes: string[] }
// logged = rows with anything entered; completed = calls marked completed;
// strong/weak = signal tags; prior_spend = rows where prior spend was mentioned;
// quotes = verbatim quotes, strong-signal quotes first.

import type { SheetData, TableRow, WorksheetDef } from "../types";

const TARGET = 10;
const THRESHOLD = 7;

function interviewRows(d: SheetData): TableRow[] {
  const rows = Array.isArray(d.interviews) ? (d.interviews as TableRow[]) : [];
  return rows.filter((r) =>
    ["name", "source", "date_contacted", "responded", "completed", "signal", "quote", "prior_spend"].some((k) => {
      const v = r[k];
      return v !== undefined && v !== null && String(v).trim() !== "";
    }),
  );
}

const isYes = (v: unknown) => v === "yes";
const sig = (v: unknown) => String(v ?? "").toLowerCase();

function tally(d: SheetData) {
  const rows = interviewRows(d);
  const strongRows = rows.filter((r) => sig(r.signal) === "strong");
  const quote = (r: TableRow) => String(r.quote ?? "").trim();
  return {
    logged: rows.length,
    completed: rows.filter((r) => isYes(r.completed)).length,
    strong: strongRows.length,
    weak: rows.filter((r) => sig(r.signal) === "weak").length,
    prior_spend: rows.filter((r) => isYes(r.prior_spend)).length,
    target: TARGET as 10,
    threshold: THRESHOLD as 7,
    quotes: [...strongRows, ...rows.filter((r) => sig(r.signal) !== "strong")].map(quote).filter(Boolean),
  };
}

export const interviewTracker: WorksheetDef = {
  assetId: "interview-tracker",
  exports: ["pdf", "xlsx"],
  sections: [
    {
      title: "Your strong signals",
      blocks: [
        {
          kind: "computed",
          key: "strong_count",
          label: "Strong signals against your target of 10",
          big: true,
          compute: (d) => `${tally(d).strong} / ${TARGET}`,
        },
        {
          kind: "callout",
          tone: "note",
          title: "Seven or more strong is the threshold to proceed",
          text: "A strong signal is a buyer who described the problem in their own words, has already tried to solve it, and has spent money or real time on it. Polite interest is a weak signal, however warm the call felt.",
        },
        {
          kind: "computed",
          key: "status",
          label: "Where you stand",
          compute: (d) => {
            const t = tally(d);
            if (!t.logged) return null;
            if (t.strong >= THRESHOLD) return `${t.strong} strong. You have cleared the threshold of ${THRESHOLD}. Take the tally into your Go/No-Go Scorecard.`;
            return `${t.strong} strong. ${THRESHOLD - t.strong} more to reach the threshold of ${THRESHOLD}.`;
          },
        },
        {
          kind: "computed",
          key: "summary",
          label: "Totals",
          compute: (d) => {
            const t = tally(d);
            if (!t.logged) return null;
            return {
              headers: ["Logged", "Calls completed", "Strong", "Weak", "Prior spend mentioned"],
              rows: [[String(t.logged), String(t.completed), String(t.strong), String(t.weak), String(t.prior_spend)]],
            };
          },
        },
      ],
    },
    {
      title: "Interview log",
      intro: "One row per buyer. Write the quote word for word, the way they said it. Add rows as you go past ten.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "interviews",
            minRows: 10,
            addable: true,
            columns: [
              { key: "name", label: "Name", type: "text", width: 1.1 },
              { key: "source", label: "Source", type: "select", options: ["Warm referral", "LinkedIn", "Community"], width: 1 },
              { key: "date_contacted", label: "Date contacted", type: "date", width: 0.9 },
              { key: "responded", label: "Responded", type: "yesno", width: 0.7 },
              { key: "completed", label: "Call completed", type: "yesno", width: 0.7 },
              { key: "signal", label: "Signal", type: "select", options: ["Strong", "Weak"], width: 0.7 },
              { key: "quote", label: "Verbatim quote", type: "text", width: 2.6 },
              { key: "prior_spend", label: "Prior spend mentioned", type: "yesno", width: 0.8 },
            ],
          },
        },
      ],
    },
  ],
  writes: [{ key: "interview_signal_tally", from: (d) => tally(d) }],
};

export const course03Worksheets = [interviewTracker];
