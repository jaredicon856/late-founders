import { asNumber } from "../profile";
import type { Computed, ProfileData, SheetData, TableRow, WorksheetDef } from "../types";

// Member-record shapes written here (agreed):
//   owners_audit_tasks: { date: string; task: string; minutes: number; done_before: string; role: string }[]
//   task_sort: { ten: number; hundred: number; thousand: number; targets: string[] }  (hours per column)

const rows = (d: SheetData, k: string): TableRow[] =>
  Array.isArray(d[k]) ? (d[k] as TableRow[]).filter((r) => r && typeof r === "object") : [];
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const hours = (minutes: number): string => (Math.round((minutes / 60) * 10) / 10).toString();
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------
// Owner's Audit Worksheet
// ---------------------------------------------------------------------------

// Whole-number percentages that always add up to 100 (largest remainder), so
// a table of shares never totals 101%.
export function wholeShares(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i] += 1;
    left -= 1;
  }
  return out;
}

function loggedTasks(d: SheetData) {
  return rows(d, "log")
    .map((r) => ({
      date: text(r.date),
      task: text(r.task),
      minutes: asNumber(r.minutes) ?? 0,
      done_before: text(r.done_before),
      role: text(r.role),
    }))
    .filter((r) => r.task);
}

export const ownersAudit: WorksheetDef = {
  assetId: "owners-audit",
  exports: ["pdf", "xlsx"],
  sections: [
    {
      title: "Five-day task log",
      blocks: [
        {
          kind: "callout",
          tone: "note",
          title: "Log at the moment you switch tasks",
          text: "Write the line the moment you switch tasks, not from memory at the end of the day. Memory drops the five-minute jobs, and those are the ones that add up.",
        },
        {
          kind: "prose",
          paragraphs: [
            "Write each task as a specific action, not a category. \"Replied to three client emails about invoice dates\" works. \"Admin\" does not. Done before? means: have you done this exact task before, in this business? Yes marks it as repeat work, which is what an SOP or a hire can take off you. No marks a one-off.",
          ],
        },
        {
          kind: "table",
          table: {
            key: "log",
            minRows: 25,
            addable: true,
            columns: [
              { key: "date", label: "Date", type: "date", width: 0.9 },
              { key: "task", label: "Task (a specific action)", type: "text", width: 3 },
              { key: "minutes", label: "Minutes", type: "number", width: 0.7 },
              { key: "done_before", label: "Done before?", type: "yesno", width: 0.8 },
              { key: "dread", label: "Dread it?", type: "yesno", width: 0.7 },
              { key: "role", label: "Role", type: "text", optionsFrom: { table: "roles", column: "role" }, width: 1.3 },
            ],
          },
        },
      ],
    },
    {
      title: "Group your tasks into roles",
      intro:
        "After the five days, name the roles hiding in your log: eight to twelve of them. Then pick the role each task belongs to in the Role column above: once you have named your headings, it offers them as choices.",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "prose",
          paragraphs: [
            "A role is a job someone could be hired for, such as Bookkeeper, Client Onboarding, Sales Calls, Scheduling or Quality Review. If a task fits no role, it may be a role you have not named yet.",
          ],
        },
        {
          kind: "table",
          label: "Your role headings",
          table: {
            key: "roles",
            minRows: 8,
            maxRows: 12,
            addable: true,
            columns: [
              { key: "role", label: "Role heading", type: "text", width: 1.4 },
              { key: "covers", label: "What it covers", type: "text", width: 3 },
            ],
          },
        },
        {
          kind: "computed",
          key: "time_by_role",
          label: "Time by role across the five days",
          compute: (d): Computed => {
            const tasks = loggedTasks(d);
            if (!tasks.length) return null;
            const totals = new Map<string, { label: string; minutes: number; count: number }>();
            for (const t of tasks) {
              const label = t.role || "No role yet";
              const k = norm(label);
              const cur = totals.get(k) ?? { label, minutes: 0, count: 0 };
              cur.minutes += t.minutes;
              cur.count += 1;
              totals.set(k, cur);
            }
            const all = tasks.reduce((s, t) => s + t.minutes, 0);
            const list = [...totals.values()].sort((a, b) => b.minutes - a.minutes);
            const shares = wholeShares(list.map((r) => r.minutes));
            return {
              headers: ["Role", "Tasks", "Minutes", "Hours", "Share of time"],
              rows: [
                ...list.map((r, i) => [
                  r.label,
                  String(r.count),
                  String(Math.round(r.minutes)),
                  hours(r.minutes),
                  all > 0 ? `${shares[i]}%` : "",
                ]),
                ["Total", String(tasks.length), String(Math.round(all)), hours(all), all > 0 ? "100%" : ""],
              ],
            };
          },
        },
      ],
    },
  ],
  writes: [
    { key: "owners_audit_tasks", from: (d) => loggedTasks(d) },
    { key: "audit_roles", from: (d) => { const r = [...new Set(rows(d, "roles").map((x) => text(x.role)).filter(Boolean))]; return r.length ? r : null; } },
  ],
};

// ---------------------------------------------------------------------------
// Task-Sort Worksheet
// ---------------------------------------------------------------------------

const RATE_TEN = "$10 an hour";
const RATE_HUNDRED = "$100 an hour";
const RATE_THOUSAND = "$1,000 an hour";
const RATES = [RATE_TEN, RATE_HUNDRED, RATE_THOUSAND];

// One row per distinct task: the same task logged on several days is summed.
function tasksFromAudit(p: ProfileData): TableRow[] {
  const src = Array.isArray(p.owners_audit_tasks) ? (p.owners_audit_tasks as Record<string, unknown>[]) : [];
  const byTask = new Map<string, { task: string; minutes: number; times: number; role: string }>();
  for (const r of src) {
    if (!r || typeof r !== "object") continue;
    const task = text(r.task);
    if (!task) continue;
    const k = norm(task);
    const cur = byTask.get(k) ?? { task, minutes: 0, times: 0, role: text(r.role) };
    cur.minutes += asNumber(r.minutes) ?? 0;
    cur.times += 1;
    if (!cur.role) cur.role = text(r.role);
    byTask.set(k, cur);
  }
  return [...byTask.values()].map((t) => ({ task: t.task, role: t.role, times: t.times, minutes: t.minutes, rate: "" }));
}

const BRANCHES = ["Keep", "Delete", "Automate", "Delegate"];

export function rankedBottlenecks(d: SheetData) {
  return rows(d, "bottlenecks")
    .map((r) => ({ task: text(r.task), waiting: text(r.waiting), per_week: asNumber(r.per_week) ?? 0 }))
    .filter((r) => r.task)
    .sort((a, b) => b.per_week - a.per_week);
}

function sortedTasks(d: SheetData) {
  return rows(d, "tasks")
    .map((r) => ({ task: text(r.task), minutes: asNumber(r.minutes) ?? 0, rate: text(r.rate) }))
    .filter((r) => r.task);
}

function columnHours(d: SheetData) {
  const tasks = sortedTasks(d);
  const sum = (rate: string) => tasks.filter((t) => t.rate === rate).reduce((s, t) => s + t.minutes, 0) / 60;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return { ten: r1(sum(RATE_TEN)), hundred: r1(sum(RATE_HUNDRED)), thousand: r1(sum(RATE_THOUSAND)), sorted: tasks.filter((t) => RATES.includes(t.rate)).length, total: tasks.length };
}

function delegationTargets(d: SheetData) {
  return sortedTasks(d)
    .filter((t) => t.rate === RATE_TEN && t.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 3);
}

export const taskSort: WorksheetDef = {
  assetId: "task-sort",
  exports: ["pdf", "xlsx"],
  reads: ["owners_audit_tasks"],
  initial: (p) => ({ tasks: tasksFromAudit(p) }),
  sections: [
    {
      title: "The three columns",
      blocks: [
        {
          kind: "prose",
          bullets: [
            "$10 an hour: work you could hand to an assistant, a tool or a checklist tomorrow. Nobody pays a premium for it.",
            "$100 an hour: skilled work that needs training or experience, but someone else could do it well with an SOP.",
            "$1,000 an hour: work only you can do right now that moves the business: key relationships, pricing, strategy, big decisions.",
          ],
        },
        {
          kind: "callout",
          tone: "note",
          text: "Sort by what the work is worth, not by who does it today or how much you enjoy it. If you are unsure between two columns, pick the lower one.",
        },
      ],
    },
    {
      title: "Sort your tasks",
      intro:
        "Your tasks come in from your Owner's Audit, with repeats across the five days added together. Choose a column for each one. Add any task the audit missed. Then, for every task you will not keep, pick its branch in Module 3's order: delete it first if you can, automate it if you cannot delete it, and delegate only what is left. Note why. Who to delegate to and how to hire is Course 14.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "tasks",
            minRows: 15,
            addable: true,
            columns: [
              { key: "task", label: "Task", type: "text", width: 3 },
              { key: "role", label: "Role", type: "text", width: 1.2 },
              { key: "times", label: "Times logged", type: "number", width: 0.7 },
              { key: "minutes", label: "Total minutes", type: "number", width: 0.8 },
              { key: "rate", label: "Column", type: "select", options: RATES, width: 1.2 },
              { key: "branch", label: "Branch", type: "select", options: BRANCHES, width: 0.9 },
              { key: "why", label: "Why", type: "text", width: 1.6 },
            ],
          },
        },
      ],
    },
    {
      title: "What the sort shows",
      blocks: [
        {
          kind: "computed",
          key: "hours_per_column",
          label: "Hours per column over the five days",
          compute: (d): Computed => {
            const h = columnHours(d);
            if (!h.sorted) return null;
            const all = h.ten + h.hundred + h.thousand;
            const pct = (n: number) => (all > 0 ? `${Math.round((n / all) * 100)}%` : "");
            return {
              headers: ["Column", "Hours", "Share"],
              rows: [
                [RATE_TEN, String(h.ten), pct(h.ten)],
                [RATE_HUNDRED, String(h.hundred), pct(h.hundred)],
                [RATE_THOUSAND, String(h.thousand), pct(h.thousand)],
                ["Total sorted", String(Math.round(all * 10) / 10), all > 0 ? "100%" : ""],
              ],
            };
          },
        },
        {
          kind: "computed",
          key: "ratio",
          label: "Your ratio ($10 : $100 : $1,000)",
          big: true,
          compute: (d): Computed => {
            const h = columnHours(d);
            const all = h.ten + h.hundred + h.thousand;
            if (!h.sorted || all <= 0) return null;
            const pct = (n: number) => Math.round((n / all) * 100);
            return `${pct(h.ten)} : ${pct(h.hundred)} : ${pct(h.thousand)}`;
          },
        },
        {
          kind: "computed",
          key: "unsorted",
          label: "Tasks still to sort",
          compute: (d): Computed => {
            const h = columnHours(d);
            return h.total ? h.total - h.sorted : null;
          },
        },
        {
          kind: "computed",
          key: "targets",
          label: "Your first targets: the three biggest $10 tasks to delete, automate or delegate",
          compute: (d): Computed => {
            const t = delegationTargets(d);
            if (!t.length) return null;
            return {
              headers: ["#", "Task", "Hours over five days"],
              rows: t.map((x, i) => [String(i + 1), x.task, hours(x.minutes)]),
            };
          },
        },
        {
          kind: "callout",
          tone: "note",
          text: "Start with your number one bottleneck from the map below if you have one; otherwise start with these three. Each is a good first recording for the SOP Generator: do the task once while narrating (your phone's voice memo app, or a free screen recorder such as Loom's free plan), and the SOP writes itself.",
        },
      ],
    },
    {
      title: "Bottleneck map",
      intro: "Where work stops and waits for you. List each place, who or what is waiting, and how often it happens in a normal week. The one at the top is your number one bottleneck, and the first task to take off your plate.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "bottlenecks",
            minRows: 5,
            maxRows: 20,
            addable: true,
            columns: [
              { key: "task", label: "Where work waits for you", type: "text", width: 2.4 },
              { key: "waiting", label: "Who or what is waiting", type: "text", width: 1.8 },
              { key: "per_week", label: "Times a week", type: "number", width: 0.8 },
            ],
          },
        },
        {
          kind: "computed",
          key: "bottleneck_rank",
          label: "Your bottlenecks, worst first",
          compute: (d): Computed => {
            const list = rankedBottlenecks(d);
            return list.length ? { headers: ["#", "Bottleneck", "Waiting", "Times a week"], rows: list.map((b, i) => [String(i + 1), b.task, b.waiting, String(b.per_week)]) } : null;
          },
        },
      ],
    },
  ],
  writes: [
    {
      key: "task_sort",
      from: (d) => {
        const h = columnHours(d);
        return {
          ten: h.ten,
          hundred: h.hundred,
          thousand: h.thousand,
          targets: delegationTargets(d).map((t) => t.task),
          bottleneck: rankedBottlenecks(d)[0]?.task ?? "",
          branches: rows(d, "tasks").filter((r) => text(r.task) && text(r.branch)).map((r) => ({ task: text(r.task), branch: text(r.branch), why: text(r.why) })),
        };
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Business Dashboard
// ---------------------------------------------------------------------------

function metricStatus(r: TableRow): string {
  const low = asNumber(r.low);
  const high = asNumber(r.high);
  const cur = asNumber(r.current);
  if (low === null || high === null) return "Set a range";
  if (cur === null) return "No current value";
  const lo = Math.min(low, high);
  const hi = Math.max(low, high);
  if (cur < lo) return "Outside range (below)";
  if (cur > hi) return "Outside range (above)";
  return "Inside range";
}

export function metricTrends(d: SheetData): string[][] {
  const by = new Map<string, { label: string; points: { week: string; value: number }[] }>();
  for (const r of rows(d, "history")) {
    const m = text(r.metric);
    const v = asNumber(r.value);
    if (!m || v === null) continue;
    const k = norm(m);
    const cur = by.get(k) ?? { label: m, points: [] };
    cur.points.push({ week: text(r.week), value: v });
    by.set(k, cur);
  }
  return [...by.values()].map(({ label, points }) => {
    const p = points.sort((a, b) => (a.week < b.week ? -1 : 1));
    const last = p.slice(-3).map((x) => String(x.value));
    const a = p.length >= 2 ? p[p.length - 2].value : null;
    const b = p[p.length - 1].value;
    const dir = a === null ? "Log another week" : b > a ? "Up" : b < a ? "Down" : "Flat";
    return [label, String(p.length), last.join(" → "), dir];
  });
}

export const businessDashboard: WorksheetDef = {
  assetId: "business-dashboard",
  exports: ["xlsx", "pdf"],
  sections: [
    {
      title: "Your dashboard",
      blocks: [
        {
          kind: "callout",
          tone: "note",
          title: "Mix leading and lagging indicators",
          text: "Lagging indicators tell you what already happened, for example monthly revenue and client churn. Leading indicators tell you what is about to happen, for example sales calls booked this week and proposals sent. A dashboard of only lagging numbers tells you about a problem after it is too late to act. Include both.",
        },
        {
          kind: "prose",
          paragraphs: [
            "Five to seven metrics, no more. Give each a target range, not a single number: inside the range, your team acts without you. Outside it, or when the trigger happens, it comes to you.",
          ],
        },
        {
          kind: "table",
          table: {
            key: "metrics",
            minRows: 5,
            maxRows: 7,
            addable: true,
            columns: [
              { key: "metric", label: "Metric", type: "text", width: 1.5 },
              { key: "kind", label: "Leading or lagging", type: "select", options: ["Leading", "Lagging"], width: 0.9 },
              { key: "low", label: "Target range: low", type: "number", width: 0.8 },
              { key: "high", label: "Target range: high", type: "number", width: 0.8 },
              { key: "current", label: "Current value", type: "number", width: 0.8 },
              { key: "authority", label: "Who can act while inside the range", type: "text", width: 1.4 },
              { key: "trigger", label: "Trigger that needs the owner", type: "text", width: 1.6 },
            ],
          },
        },
        {
          kind: "fields",
          fields: [
            { key: "cadence", label: "Review cadence", type: "select", options: ["Weekly", "Every two weeks", "Monthly"], width: "third" },
            { key: "review_day", label: "Review day", type: "select", options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], width: "third" },
            { key: "who_reviews", label: "Who runs the review", type: "text", width: "third" },
            {
              key: "emergency",
              label: "What counts as an emergency",
              type: "textarea",
              lines: 2,
              hint: "Narrow and written down: the few things that justify reaching you at once. Everything else waits for the review. The One-Week-Away Test Plan uses the same definition.",
            },
            { key: "emergency_channel", label: "The one emergency channel", type: "text", hint: "For example: a phone call to your mobile. Not email, not chat." },
          ],
        },
      ],
    },
    {
      title: "Weekly history",
      intro: "At each review, log the week's value for every metric. The trend is what the review is for: one number tells you where you are, three tell you where you are heading.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "history",
            minRows: 5,
            maxRows: 400,
            addable: true,
            columns: [
              { key: "week", label: "Week of", type: "date", width: 1 },
              { key: "metric", label: "Metric", type: "text", optionsFrom: { table: "metrics", column: "metric" }, width: 1.6 },
              { key: "value", label: "Value", type: "number", width: 0.8 },
            ],
          },
        },
        {
          kind: "computed",
          key: "trend",
          label: "Trend by metric",
          compute: (d): Computed => {
            const t = metricTrends(d);
            return t.length ? { headers: ["Metric", "Weeks logged", "Last three", "Direction"], rows: t } : null;
          },
        },
      ],
    },
    {
      title: "Status",
      blocks: [
        {
          kind: "computed",
          key: "status",
          label: "Status by metric",
          compute: (d): Computed => {
            const list = rows(d, "metrics").filter((r) => text(r.metric));
            if (!list.length) return null;
            return {
              headers: ["Metric", "Range", "Current", "Status", "Who acts"],
              rows: list.map((r) => {
                const low = asNumber(r.low);
                const high = asNumber(r.high);
                const cur = asNumber(r.current);
                const status = metricStatus(r);
                return [
                  text(r.metric),
                  low !== null && high !== null ? `${Math.min(low, high)} to ${Math.max(low, high)}` : "",
                  cur !== null ? String(cur) : "",
                  status,
                  status === "Inside range" ? text(r.authority) || "Name someone" : status.startsWith("Outside") ? "You" : "",
                ];
              }),
            };
          },
        },
        {
          kind: "computed",
          key: "outside_count",
          label: "Metrics outside range",
          big: true,
          compute: (d): Computed => {
            const list = rows(d, "metrics").filter((r) => text(r.metric));
            if (!list.length) return null;
            return list.filter((r) => metricStatus(r).startsWith("Outside")).length;
          },
        },
        {
          kind: "computed",
          key: "mix_check",
          label: "Mix check",
          compute: (d): Computed => {
            const list = rows(d, "metrics").filter((r) => text(r.metric));
            if (!list.length) return null;
            const leading = list.filter((r) => r.kind === "Leading").length;
            const lagging = list.filter((r) => r.kind === "Lagging").length;
            const notes: string[] = [`${leading} leading, ${lagging} lagging.`];
            if (list.length < 5) notes.push(`Add ${5 - list.length} more metric${5 - list.length === 1 ? "" : "s"}: the dashboard needs five to seven.`);
            if (leading === 0) notes.push("Add at least one leading indicator.");
            if (lagging === 0) notes.push("Add at least one lagging indicator.");
            return notes.join(" ");
          },
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// One-Week-Away Test Plan
// ---------------------------------------------------------------------------

export const oneWeekAway: WorksheetDef = {
  assetId: "one-week-away",
  exports: ["pdf", "docx"],
  sections: [
    {
      title: "Before: plan the week",
      blocks: [
        {
          kind: "fields",
          fields: [
            { key: "week_start", label: "Week away starts", type: "date", width: "half" },
            { key: "week_end", label: "Week away ends", type: "date", width: "half" },
          ],
        },
        {
          kind: "table",
          label: "Every likely decision, who owns it, and the SOP that covers it",
          table: {
            key: "decisions",
            minRows: 8,
            addable: true,
            columns: [
              { key: "decision", label: "Decision type", type: "text", width: 2 },
              { key: "owner", label: "Who owns it", type: "text", width: 1.2 },
              { key: "sop", label: "SOP that covers it", type: "text", optionsProfile: "sop_titles", width: 1.6 },
            ],
          },
        },
        {
          kind: "fields",
          fields: [
            {
              key: "emergency_channel",
              label: "The single emergency channel",
              type: "text",
              hint: "One channel only, for example a phone call to your mobile. Everything else waits.",
            },
            {
              key: "emergency_definition",
              label: "What counts as an emergency",
              type: "textarea",
              lines: 3,
              hint: "Keep it narrow, for example: a client threatens to leave, money is at risk over a set amount, or someone is hurt.",
            },
            {
              key: "predictions",
              label: "What you predict will break",
              type: "textarea",
              lines: 5,
              hint: "Write it down now, so you can compare it with what actually happened.",
            },
          ],
        },
      ],
    },
    {
      title: "During: log every urge to check in",
      intro: "Each time you want to check in, write it down, whether or not you act on it.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "urges",
            minRows: 10,
            addable: true,
            columns: [
              { key: "date", label: "Day", type: "date", width: 0.9 },
              { key: "trigger", label: "What triggered it", type: "text", width: 2.6 },
              { key: "strength", label: "Strength (1 to 5)", type: "select", options: ["1", "2", "3", "4", "5"], width: 0.8 },
              { key: "acted", label: "Did you act?", type: "yesno", width: 0.8 },
            ],
          },
        },
      ],
    },
    {
      title: "After: gather the issues and route each fix",
      intro:
        "Collect issues from three places: the emergency channel, the dashboard and the team debrief. Find the root cause of each, then route the fix to an SOP, an authority clarification or a dashboard change.",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            key: "issues",
            minRows: 8,
            addable: true,
            columns: [
              { key: "issue", label: "Issue", type: "text", width: 1.8 },
              { key: "source", label: "Where it came from", type: "select", options: ["Emergency channel", "Dashboard", "Team debrief"], width: 1.1 },
              { key: "root_cause", label: "Root cause", type: "text", width: 1.8 },
              { key: "route", label: "Fix goes to", type: "select", options: ["SOP", "Authority clarification", "Dashboard change"], width: 1.1 },
              { key: "fix", label: "The fix", type: "text", width: 1.8 },
            ],
          },
        },
        {
          kind: "computed",
          key: "urge_summary",
          label: "Urges logged and acted on",
          compute: (d): Computed => {
            const u = rows(d, "urges").filter((r) => text(r.trigger));
            if (!u.length) return null;
            const acted = u.filter((r) => r.acted === "yes").length;
            return `${u.length} urge${u.length === 1 ? "" : "s"} logged, ${acted} acted on.`;
          },
        },
        {
          kind: "computed",
          key: "routing_summary",
          label: "Fixes by route",
          compute: (d): Computed => {
            const list = rows(d, "issues").filter((r) => text(r.issue));
            if (!list.length) return null;
            const routes = ["SOP", "Authority clarification", "Dashboard change"];
            return {
              headers: ["Fix goes to", "Issues"],
              rows: [
                ...routes.map((r) => [r, String(list.filter((i) => i.route === r).length)]),
                ["Not routed yet", String(list.filter((i) => !routes.includes(text(i.route))).length)],
              ],
            };
          },
        },
        {
          kind: "fields",
          fields: [{ key: "next_test_date", label: "Next test date", type: "date", width: "half" }],
        },
      ],
    },
  ],
};

export const course12Worksheets = [ownersAudit, taskSort, businessDashboard, oneWeekAway];
