// Calendar files (.ics) for tools whose output is a set of dates: the Decision
// Engine's trigger months and the Campaign Metrics Tracker's review rhythm.
// All-day events, so they land on the right day in any time zone.

import { nextChangeDate } from "@/content/worksheets/c08";
import type { ProfileData, SheetData } from "@/content/types";

export type CalEvent = { uid: string; date: string; title: string; description: string; rrule?: string };

const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const ymd = (iso: string) => iso.replace(/-/g, "");
function nextDay(iso: string): string {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

export function toIcs(name: string, events: CalEvent[], stamp = new Date()): string {
  const now = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Late Founders//Portal//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(name)}`];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@latefounders`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${ymd(e.date)}`,
      `DTEND;VALUE=DATE:${ymd(nextDay(e.date))}`,
      `SUMMARY:${esc(e.title)}`,
      `DESCRIPTION:${esc(e.description)}`,
      ...(e.rrule ? [`RRULE:${e.rrule}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// One event on the first of each trigger's target month, plus a monthly
// reminder to update the Runway Calculator.
export function decisionEvents(p: ProfileData, today: string): CalEvent[] {
  const q = obj(p.quit_decision);
  const triggers = Array.isArray(q.triggers) ? (q.triggers as unknown[]).map(obj) : [];
  const out: CalEvent[] = triggers
    .filter((t) => /^\d{4}-\d{2}$/.test(str(t.target_month)))
    .map((t, i) => ({
      uid: `lf-trigger-${i}-${str(t.target_month)}`,
      date: `${str(t.target_month)}-01`,
      title: `Quit-or-stay check: ${str(t.condition)}`,
      description: `Your trigger from the AI Decision Engine: "${str(t.condition)}". Is it true yet? Update your Runway Calculator and Risk Inventory, then run the Decision Engine again.`,
    }));
  const first = new Date(`${today}T00:00:00Z`);
  first.setUTCMonth(first.getUTCMonth() + 1, 1);
  out.push({
    uid: "lf-runway-monthly",
    date: first.toISOString().slice(0, 10),
    title: "Update your Runway Calculator",
    description: "Monthly: new statements, signed revenue and savings into the Runway Calculator, so the Decision Engine reads today's numbers.",
    rrule: "FREQ=MONTHLY;COUNT=12",
  });
  return out;
}

// Weekly logging from next Monday, and the date the next change is allowed.
export function campaignEvents(d: SheetData, today: string): CalEvent[] {
  const t = new Date(`${today}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + (((8 - t.getUTCDay()) % 7) || 7));
  const out: CalEvent[] = [
    {
      uid: "lf-campaign-weekly",
      date: t.toISOString().slice(0, 10),
      title: "Log this week's LinkedIn campaign numbers",
      description: "Requests sent, accepted, replies per message, calls booked and held, in the Campaign Metrics Tracker.",
      rrule: "FREQ=WEEKLY;COUNT=12",
    },
  ];
  const next = nextChangeDate(d);
  if (next && next >= today)
    out.push({
      uid: `lf-campaign-change-${next}`,
      date: next,
      title: "Next campaign change allowed",
      description: "Two weeks since your last change. Check the weakest step in the Campaign Metrics Tracker, then change one thing.",
    });
  return out;
}
