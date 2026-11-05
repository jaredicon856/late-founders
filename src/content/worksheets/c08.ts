import { asNumber } from "../profile";
import type { SheetData, TableRow, WorksheetDef } from "../types";

// Member-record fields written here:
//   icp_paragraph: string   one-paragraph ideal customer, read by the Message-Sequence Generator
//   campaign_metrics: { week; rates: Record<MetricKey, number | null>; weakest: MetricKey | null }

const rows = (d: SheetData, k: string): TableRow[] =>
  Array.isArray(d[k]) ? (d[k] as TableRow[]).filter((r) => r && typeof r === "object") : [];
const text = (v: unknown) => (typeof v === "string" ? v.trim().replace(/[.\s]+$/, "") : "");

// ---------------------------------------------------------------------------
// 08.1 ICP Worksheet
// ---------------------------------------------------------------------------

export function icpParagraph(d: SheetData): string {
  const role = text(d.role);
  const company = text(d.company);
  const trigger = text(d.trigger);
  const pain = text(d.pain);
  if (!role || !company || !trigger || !pain) return "";
  const article = /^[aeiou]/i.test(role) ? "an" : "a";
  return `My buyer is ${article} ${role} at ${company}. Right now, ${trigger}. In their words: "${pain}."`;
}

export const icpWorksheet: WorksheetDef = {
  assetId: "icp-worksheet",
  exports: ["pdf", "docx"],
  sections: [
    {
      title: "One real buyer, four facts",
      intro: "Describe one buyer you could picture by name, not a market. Every list you build after this gets filtered through it.",
      blocks: [
        {
          kind: "fields",
          fields: [
            { key: "role", label: "1 · Role or title", type: "text", hint: "Example: \"operations director\"." },
            {
              key: "company",
              label: "2 · Company profile",
              type: "text",
              hint: "Headcount, industry and revenue band. Example: \"a 40 to 120 person food distributor doing $10M to $40M\".",
            },
            {
              key: "trigger",
              label: "3 · Trigger condition: what is true right now",
              type: "textarea",
              lines: 2,
              hint: "What is happening at this company now that makes your offer relevant today? Example: \"they just opened a second warehouse\". This is the field everyone skips, and the one that makes a first line land. It is required.",
            },
            {
              key: "pain",
              label: "4 · The specific pain, in the buyer's own words",
              type: "textarea",
              lines: 2,
              hint: "How they would say it to a peer, not your category language. \"We keep shipping the wrong pallets\" beats \"fulfilment inefficiency\".",
            },
          ],
        },
      ],
    },
    {
      title: "Read it back",
      blocks: [
        { kind: "computed", key: "paragraph", label: "Your ICP paragraph", big: true, compute: (d) => icpParagraph(d) || null },
        {
          kind: "callout",
          tone: "note",
          title: "Gut check",
          text: "Can you picture a specific human reading this and nodding? If you cannot name two real people who fit it, it is still a market, not a buyer. Narrow it.",
        },
      ],
    },
  ],
  completeCheck: (d) => {
    if (!text(d.trigger)) return "The trigger condition is required: what is true about this company right now that makes your offer relevant today?";
    if (!icpParagraph(d)) return "Fill in all four facts: role, company profile, trigger condition and the pain in the buyer's words.";
    return null;
  },
  writes: [{ key: "icp_paragraph", from: (d) => icpParagraph(d) || null }],
};

// ---------------------------------------------------------------------------
// 08.5 Campaign Metrics Tracker
// ---------------------------------------------------------------------------

// Starting benchmarks for a conservative LinkedIn campaign. They only rank the
// member's own numbers against each other, so the weakest step is found; they
// are not targets to hit.
export const METRICS = [
  { key: "acceptance", label: "Connection acceptance", benchmark: 30, fix: "Low acceptance points at the list or the connection request. Re-check the list against your ICP, and make the request reference their trigger condition with no pitch." },
  { key: "reply_opener", label: "Reply to the opener", benchmark: 10, fix: "Low replies to the opener mean it is not specific enough. It should prove you looked at their profile: one observation only they would recognise." },
  { key: "reply_value", label: "Reply to the value message", benchmark: 8, fix: "Low replies to the value message mean it fails the still-worth-receiving test. Would it be useful if they never replied? If not, it is a teaser. Replace it with something genuinely useful." },
  { key: "reply_cta", label: "Reply to the soft CTA", benchmark: 8, fix: "Low replies to the soft CTA: make it a question, not an instruction, tie it to the value message, and give an explicit easy out." },
  { key: "booking", label: "Calls booked from replies", benchmark: 25, fix: "Low booking with healthy replies means the leak is in how you handle replies, not the sequence. Answer fast, ask one question back, and suggest a time rather than sending a link." },
  { key: "show", label: "Calls held from bookings", benchmark: 75, fix: "Low show rate: confirm the day before, keep the gap between booking and call under a week, and say what they will get from the call." },
] as const;
export type MetricKey = (typeof METRICS)[number]["key"];

const pct = (a: number | null, b: number | null) => (a === null || !b ? null : Math.round((a / b) * 1000) / 10);

export function weekRates(r: TableRow): Record<MetricKey, number | null> {
  const n = (k: string) => asNumber(r[k]);
  const accepted = n("accepted");
  const replies = [n("replies_opener"), n("replies_value"), n("replies_cta")];
  const totalReplies = replies.some((x) => x !== null) ? replies.reduce<number>((s, x) => s + (x ?? 0), 0) : null;
  return {
    acceptance: pct(accepted, n("sent")),
    reply_opener: pct(replies[0], accepted),
    reply_value: pct(replies[1], accepted),
    reply_cta: pct(replies[2], accepted),
    booking: pct(n("booked"), totalReplies),
    show: pct(n("held"), n("booked")),
  };
}

export function latestWeek(d: SheetData): TableRow | null {
  const r = rows(d, "weeks").filter((x) => asNumber(x.sent) !== null);
  return r.length ? r[r.length - 1] : null;
}

export function weakest(rates: Record<MetricKey, number | null>) {
  let worst: (typeof METRICS)[number] | null = null;
  let worstRatio = Infinity;
  for (const m of METRICS) {
    const v = rates[m.key];
    if (v === null) continue;
    const ratio = v / m.benchmark;
    if (ratio < worstRatio) {
      worst = m;
      worstRatio = ratio;
    }
  }
  return worst;
}

const DAY = 86_400_000;
export function changeProblems(d: SheetData): string[] {
  const dated = rows(d, "changes")
    .filter((r) => typeof r.date === "string" && r.date && text(r.change))
    .map((r) => ({ date: r.date as string, change: text(r.change) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const out: string[] = [];
  for (let i = 1; i < dated.length; i++) {
    const gap = (Date.parse(dated[i].date) - Date.parse(dated[i - 1].date)) / DAY;
    if (gap < 14) out.push(`"${dated[i].change}" came ${Math.round(gap)} days after "${dated[i - 1].change}". Give each change two weeks, or you cannot tell which one worked.`);
  }
  return out;
}

export function nextChangeDate(d: SheetData): string {
  const dates = rows(d, "changes").map((r) => r.date).filter((x): x is string => typeof x === "string" && !!x).sort();
  if (!dates.length) return "";
  return new Date(Date.parse(dates[dates.length - 1]) + 14 * DAY).toISOString().slice(0, 10);
}

export const campaignMetrics: WorksheetDef = {
  assetId: "campaign-metrics",
  exports: ["xlsx", "pdf"],
  sections: [
    {
      title: "Log every week",
      intro: "Count replies per message, not in total. A total tells you something is wrong; per message tells you where.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "weeks",
            minRows: 4,
            maxRows: 52,
            addable: true,
            columns: [
              { key: "week", label: "Week of", type: "date", width: 1 },
              { key: "sent", label: "Requests sent", type: "number", width: 0.8 },
              { key: "accepted", label: "Accepted", type: "number", width: 0.8 },
              { key: "replies_opener", label: "Replies: opener", type: "number", width: 0.8 },
              { key: "replies_value", label: "Replies: value msg", type: "number", width: 0.8 },
              { key: "replies_cta", label: "Replies: soft CTA", type: "number", width: 0.8 },
              { key: "booked", label: "Calls booked", type: "number", width: 0.8 },
              { key: "held", label: "Calls held", type: "number", width: 0.8 },
            ],
          },
        },
        {
          kind: "computed",
          key: "rates",
          label: "Rates by week",
          compute: (d) => {
            const r = rows(d, "weeks").filter((x) => asNumber(x.sent) !== null);
            if (!r.length) return null;
            const f = (v: number | null) => (v === null ? "-" : `${v}%`);
            return {
              headers: ["Week", "Accept", "Opener", "Value", "CTA", "Booking", "Show"],
              rows: r.map((x) => {
                const k = weekRates(x);
                return [String(x.week ?? ""), f(k.acceptance), f(k.reply_opener), f(k.reply_value), f(k.reply_cta), f(k.booking), f(k.show)];
              }),
            };
          },
        },
        {
          kind: "computed",
          key: "weakest",
          label: "Your weakest step this week",
          big: true,
          compute: (d) => {
            const w = latestWeek(d);
            const m = w ? weakest(weekRates(w)) : null;
            return m ? m.label : null;
          },
        },
        {
          kind: "computed",
          key: "fix",
          label: "What it points to",
          compute: (d) => {
            const w = latestWeek(d);
            const m = w ? weakest(weekRates(w)) : null;
            return m ? m.fix : null;
          },
        },
      ],
    },
    {
      title: "One change at a time",
      intro: "Change one thing, then leave it for two weeks before changing anything else. Two changes at once and you cannot tell which one moved the number.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "changes",
            minRows: 3,
            maxRows: 30,
            addable: true,
            columns: [
              { key: "date", label: "Date", type: "date", width: 1 },
              { key: "change", label: "The one thing you changed", type: "text", width: 3 },
            ],
          },
        },
        {
          kind: "computed",
          key: "next_change",
          label: "Next change allowed from",
          compute: (d) => nextChangeDate(d) || null,
        },
        {
          kind: "computed",
          key: "change_problems",
          label: "Changes made too close together",
          compute: (d) => {
            const p = changeProblems(d);
            return p.length ? { headers: ["Problem"], rows: p.map((x) => [x]) } : null;
          },
        },
      ],
    },
  ],
  completeCheck: (d) => (latestWeek(d) ? null : "Log at least one week (requests sent and accepted) first."),
  writes: [
    {
      key: "campaign_metrics",
      from: (d) => {
        const w = latestWeek(d);
        if (!w) return null;
        const rates = weekRates(w);
        return { week: String(w.week ?? ""), rates, weakest: weakest(rates)?.key ?? null };
      },
    },
  ],
};

export const course08Worksheets = [icpWorksheet, campaignMetrics];
