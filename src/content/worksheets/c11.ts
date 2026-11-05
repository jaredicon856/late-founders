import { asNumber } from "../profile";
import type { LibraryEntry, ProfileData, SheetData, TableRow, WorksheetDef } from "../types";

// Member-record fields written here:
//   audit_top_three: { task: string; hours_per_month: number; workflow: string }[]  (AI Audit Tracker)
//   hours_saved: { date; weekly_hours; running: number; excluded: number; destination: string }  (Hours-Saved Tracker)

const rows = (d: SheetData, k: string): TableRow[] =>
  Array.isArray(d[k]) ? (d[k] as TableRow[]).filter((r) => r && typeof r === "object") : [];
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const WEEKS_PER_MONTH = 4.33;

export const WORKFLOW_TYPES = [
  "Content repurposing",
  "Inbox triage and replies",
  "Calendar and pre-call briefs",
  "SOP capture",
  "Support replies",
];
const BUCKETS = ["Recurring and repetitive", "Recurring and judgment-based", "One-off"];

// ---------------------------------------------------------------------------
// 11.1 AI Audit Tracker
// ---------------------------------------------------------------------------

export type Target = { task: string; hours_per_month: number; workflow: string; times_per_month: number; minutes: number };

// Ranks the repetitive bucket by hours per month: average minutes per run times
// runs per month. Runs per month is what the member entered, or, if blank, how
// often the task shows up in the five-day log scaled to a month.
export function rankTargets(d: SheetData): Target[] {
  const groups = new Map<string, TableRow[]>();
  for (const r of rows(d, "log")) {
    if (!text(r.task) || r.bucket !== BUCKETS[0]) continue;
    const k = text(r.task).toLowerCase();
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const out: Target[] = [];
  for (const g of groups.values()) {
    const mins = g.map((r) => asNumber(r.minutes)).filter((n): n is number => n !== null && n > 0);
    if (!mins.length) continue;
    const minutes = mins.reduce((a, b) => a + b, 0) / mins.length;
    const entered = Math.max(0, ...g.map((r) => asNumber(r.per_month) ?? 0));
    const times = entered > 0 ? entered : Math.round(g.length * WEEKS_PER_MONTH);
    out.push({
      task: text(g[0].task),
      minutes: Math.round(minutes),
      times_per_month: times,
      hours_per_month: Math.round(((minutes * times) / 60) * 10) / 10,
      workflow: g.map((r) => text(r.workflow)).find(Boolean) ?? "",
    });
  }
  return out.sort((a, b) => b.hours_per_month - a.hours_per_month);
}

export const aiAuditTracker: WorksheetDef = {
  assetId: "ai-audit-tracker",
  exports: ["pdf", "xlsx"],
  sections: [
    {
      title: "Stage 1 · Log five working days",
      blocks: [
        {
          kind: "callout",
          tone: "note",
          title: "Log at the moment you switch",
          text: "Write the line when you switch tasks, not from memory at the end of the day. Memory drops the five-minute jobs, and those are the ones AI takes off your plate first.",
        },
        {
          kind: "prose",
          paragraphs: [
            "Write each task as a specific action: \"Turned Tuesday's client call into a recap email\", not \"email\". Log the same task again each time you do it; the tracker counts the repeats.",
            "Stage 2 happens after the five days: fill the last three columns for every row.",
          ],
        },
        {
          kind: "table",
          table: {
            key: "log",
            minRows: 20,
            maxRows: 150,
            addable: true,
            columns: [
              { key: "date", label: "Date", type: "date", width: 0.9 },
              { key: "task", label: "Task (a specific action)", type: "text", width: 2.6 },
              { key: "minutes", label: "Minutes", type: "number", width: 0.6 },
              { key: "done_before", label: "Done before?", type: "yesno", width: 0.8 },
              { key: "bucket", label: "Stage 2: bucket", type: "select", options: BUCKETS, width: 1.4 },
              { key: "per_month", label: "Times a month", type: "number", width: 0.7 },
              { key: "workflow", label: "Closest workflow", type: "select", options: [...WORKFLOW_TYPES, "Other"], width: 1.3 },
            ],
          },
        },
      ],
    },
    {
      title: "Stage 2 · Sort and rank",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "prose",
          bullets: [
            "Recurring and repetitive: you do it the same way every time. These are your automation candidates.",
            "Recurring and judgment-based: it comes back, but each time needs your call. Keep these; AI can draft, you decide.",
            "One-off: ignore for now.",
            "Times a month: for repetitive tasks, how often it happens in a normal month. Leave it blank and the tracker estimates it from your log.",
          ],
        },
        {
          kind: "callout",
          tone: "note",
          text: "The ranking is by hours a month, worked out for you. Not by how annoying a task feels: people rank by irritation every time, and automate the wrong thing first.",
        },
        {
          kind: "computed",
          key: "ranking",
          label: "Repetitive tasks, ranked by hours a month",
          compute: (d) => {
            const t = rankTargets(d);
            if (!t.length) return null;
            return {
              headers: ["#", "Task", "Minutes each", "Times a month", "Hours a month"],
              rows: t.map((x, i) => [String(i + 1), x.task, String(x.minutes), String(x.times_per_month), String(x.hours_per_month)]),
            };
          },
        },
        {
          kind: "computed",
          key: "top3",
          label: "Your top three automation targets",
          big: true,
          compute: (d) => {
            const t = rankTargets(d).slice(0, 3);
            return t.length ? t.map((x, i) => `${i + 1}. ${x.task} (${x.hours_per_month} h/mo)`).join("   ") : null;
          },
        },
      ],
    },
  ],
  completeCheck: (d) =>
    rankTargets(d).length ? null : "Sort at least one task into \"Recurring and repetitive\" with its minutes, so there is something to rank.",
  writes: [
    {
      key: "audit_top_three",
      from: (d) => {
        const t = rankTargets(d).slice(0, 3);
        return t.length ? t.map(({ task, hours_per_month, workflow }) => ({ task, hours_per_month, workflow })) : null;
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 11.2 Workflow Library
// ---------------------------------------------------------------------------

const wf = (category: string, title: string, inputs: string, job: string, prompt: string, good: string): LibraryEntry => ({
  category,
  title,
  parts: [
    { label: "Have this ready first", text: inputs },
    { label: "The job it does", text: job },
    { label: "Prompt", text: prompt, copy: true },
    { label: "A good output looks like", text: good },
  ],
});

export const WORKFLOWS: LibraryEntry[] = [
  wf(
    "Content repurposing",
    "One conversation into a week of posts",
    "A real transcript or voice memo of you explaining something to a client or peer (10+ minutes). Not a topic.",
    "Pulls the three strongest ideas out of something you already said and drafts a post for each.",
    "Below is a transcript of me talking with a client. Find the three moments where I explained something a peer would find useful. For each, write a LinkedIn post of about 150 words in my voice: plain words, short sentences, one idea, first line under 12 words. Use only what I actually said; quote my phrasing where it is strong. Do not add advice I did not give.\n\nTranscript:\n[paste]",
    "Three posts that each sound like you on a good day, each built on a line you actually said, none with a generic opener like \"In today's world\".",
  ),
  wf(
    "Content repurposing",
    "Long post into a 40-second video script",
    "A post or article you wrote that did well, plus one sentence on who it is for.",
    "Rewrites written prose for speaking: shorter lines, a hook in the first three seconds, one call to action.",
    "Turn this post into a 30 to 45 second talking-head script for [who it is for]. Spoken rhythm, not the post read aloud: lines under 12 words, a hook in the first sentence, one example, one closing line that asks a question. Mark pauses with /.\n\nPost:\n[paste]",
    "A script you can read once and record without stumbling, about 90 to 110 words.",
  ),
  wf(
    "Inbox triage and replies",
    "Morning inbox sort",
    "Your unread emails pasted in (subject, sender, first lines), plus a short list of your current priorities.",
    "Sorts the inbox into reply today, reply this week, delegate and ignore, with a one-line reason each.",
    "My priorities this week: [list]. Sort these emails into four groups: reply today, reply this week, delegate (say to whom if obvious) and ignore. One line each on why. Flag anything with a deadline or money attached.\n\nEmails:\n[paste]",
    "A short sorted list where the reply-today group is under five items and every deadline is flagged.",
  ),
  wf(
    "Inbox triage and replies",
    "Draft replies in your voice",
    "Five to ten replies you have sent before that you were happy with, plus the email you need to answer.",
    "Drafts a reply that sounds like your past replies. You edit and send; it never sends.",
    "Here are replies I have written before, so you can match my tone and length:\n[paste examples]\n\nDraft a reply to the email below. Keep it as short as my examples. Answer only what was asked. If you need a fact you do not have, leave [brackets] for me to fill.\n\nEmail:\n[paste]",
    "A reply you would send after changing a word or two, with brackets where only you know the answer.",
  ),
  wf(
    "Calendar and pre-call briefs",
    "Pre-call brief",
    "The prospect's LinkedIn About and Experience text, their website's About page, and your notes from any earlier contact.",
    "One page you read in two minutes before the call: who they are, what they likely care about, three questions to ask.",
    "I have a discovery call with the person below. Using only this material, write a brief: who they are in two lines, what their business seems to prioritise right now, anything that suggests a problem I solve, and three open questions to ask. Do not guess at facts not in the material.\n\nMaterial:\n[paste]",
    "A brief with specific, checkable details from their own words and questions that could not be asked of anyone else.",
  ),
  wf(
    "Calendar and pre-call briefs",
    "Weekly calendar review",
    "Next week's calendar exported or pasted as a list, plus your top three goals for the week.",
    "Spots meetings that do not serve your goals and the gaps where deep work fits.",
    "My goals for next week: [three goals]. Here is my calendar. Mark each meeting as serves a goal, maintenance or could decline. Then find two blocks of 90 minutes or more for focused work and suggest which goal each should go to.\n\nCalendar:\n[paste]",
    "A short list of meetings to question and two protected blocks with a goal attached to each.",
  ),
  wf(
    "SOP capture",
    "Recording into a first-draft SOP",
    "A transcript of you narrating the task while doing it (screen recording with voice works best).",
    "Turns the narration into numbered steps someone else can follow, with the decisions called out.",
    "Turn this narrated walkthrough into a standard operating procedure. Numbered steps, one action each, starting with a verb. Call out every decision point as \"If X, then Y\". List the tools and logins needed at the top. Mark anything I skipped over with [ask owner].\n\nTranscript:\n[paste]",
    "Steps a new hire could follow on day one, with every judgment call visible instead of hidden in your head. (Course 12's SOP Generator does this inside the Command Center.)",
  ),
  wf(
    "SOP capture",
    "Find the gaps in an existing SOP",
    "An SOP you already have, plus one example of the task going wrong.",
    "Reads the SOP the way a new hire would and lists where they would get stuck.",
    "Read this SOP as someone doing the task for the first time. List every place you would have to stop and ask, every step that assumes knowledge, and how the failure below could happen while following it exactly.\n\nSOP:\n[paste]\n\nWhat went wrong:\n[paste]",
    "A short list of specific gaps, each tied to a step number.",
  ),
  wf(
    "Support replies",
    "Answer bank from past replies",
    "Twenty or more past customer questions and the answers you gave.",
    "Groups repeat questions and writes one approved answer for each, for you to reuse.",
    "Below are customer questions and the answers I gave. Group the questions that are really the same. For each group, write one answer in my voice based only on what I said before, and list the variations of how people asked.\n\nQuestions and answers:\n[paste]",
    "Five to ten reusable answers, each traceable to something you actually told a customer.",
  ),
  wf(
    "Support replies",
    "First reply to a support request",
    "Your answer bank (above) and the new request.",
    "Drafts a reply from your approved answers, and says plainly when the request needs you.",
    "Using only the approved answers below, draft a reply to this customer. If none of them fits, do not improvise: say \"Needs owner\" and explain why in one line.\n\nApproved answers:\n[paste]\n\nRequest:\n[paste]",
    "Either a reply you can send as is, or a clear \"Needs owner\" flag. Never a confident guess.",
  ),
];

export const workflowLibrary: WorksheetDef = {
  assetId: "workflow-library",
  exports: ["pdf"],
  readOnly: true,
  reads: ["audit_top_three"],
  sections: [
    {
      title: "Before you run any of these",
      blocks: [
        {
          kind: "callout",
          tone: "warning",
          title: "Feed it real material, not a topic",
          text: "The most common reason AI \"does not work\" is feeding it a topic instead of material. \"Write a post about leadership\" gets you what everyone else gets. Every entry below starts with what to have ready. Do not skip it.",
        },
      ],
    },
    {
      title: "Workflows",
      blocks: [
        {
          kind: "library",
          categories: WORKFLOW_TYPES,
          entries: WORKFLOWS,
          forYou: (p: ProfileData) =>
            Array.isArray(p.audit_top_three) ? (p.audit_top_three as { workflow?: string }[]).map((t) => t.workflow ?? "").filter(Boolean) : [],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// 11.5 Hours-Saved Tracker
// ---------------------------------------------------------------------------

export function hoursSaved(d: SheetData) {
  const all = rows(d, "workflows").filter((r) => text(r.name));
  const running = all.filter((r) => r.running === "yes");
  const weekly = Math.round(running.reduce((s, r) => s + (asNumber(r.hours_week) ?? 0), 0) * 10) / 10;
  return { weekly, monthly: Math.round(weekly * WEEKS_PER_MONTH * 10) / 10, running: running.length, excluded: all.length - running.length };
}

const addMonth = (iso: string) => {
  const t = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(t.getTime())) return "";
  t.setUTCMonth(t.getUTCMonth() + 1);
  return t.toISOString().slice(0, 10);
};

export const hoursSavedTracker: WorksheetDef = {
  assetId: "hours-saved-tracker",
  exports: ["pdf", "xlsx"],
  initial: () => ({ audited_on: new Date().toISOString().slice(0, 10) }),
  sections: [
    {
      title: "Every workflow you set up",
      intro: "One row per workflow, including the ones you stopped using. Only the ones still running count.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "workflows",
            minRows: 5,
            maxRows: 40,
            addable: true,
            columns: [
              { key: "name", label: "Workflow", type: "text", width: 2 },
              { key: "source", label: "Where it came from", type: "text", width: 1.2 },
              { key: "hours_week", label: "Hours saved a week", type: "number", width: 0.8 },
              { key: "running", label: "Actually running?", type: "yesno", width: 0.9 },
            ],
          },
        },
        {
          kind: "computed",
          key: "total",
          label: "Hours reclaimed each week (running workflows only)",
          big: true,
          compute: (d) => {
            const h = hoursSaved(d);
            return h.running ? `${h.weekly} h/week (about ${h.monthly} h a month)` : null;
          },
        },
        {
          kind: "computed",
          key: "excluded",
          label: "Set up but not running",
          compute: (d) => {
            const h = hoursSaved(d);
            return h.excluded ? `${h.excluded} workflow${h.excluded === 1 ? "" : "s"} not counted. Fix them or drop them.` : "None. Everything you set up is running.";
          },
        },
      ],
    },
    {
      title: "Where the time goes",
      blocks: [
        {
          kind: "fields",
          fields: [
            {
              key: "destination",
              label: "What the reclaimed time is for",
              type: "textarea",
              lines: 3,
              hint: "An actual task or an actual hour of the week, such as \"Tuesday 9 to 11: sales calls\". Not \"more strategy\". Time with no job gets eaten by whatever is loudest.",
            },
          ],
        },
      ],
    },
    {
      title: "Re-audit monthly",
      blocks: [
        {
          kind: "fields",
          fields: [{ key: "audited_on", label: "Last checked", type: "date", width: "half" }],
        },
        {
          kind: "computed",
          key: "next",
          label: "Next check",
          compute: (d) => (typeof d.audited_on === "string" && d.audited_on ? addMonth(d.audited_on) : null),
        },
        {
          kind: "callout",
          tone: "note",
          text: "Once a month, go down the list and re-answer \"Actually running?\" honestly. Workflows quietly stop: a login expires, a tool changes, you go back to doing it by hand. Then save a new version so you can see the trend.",
        },
      ],
    },
  ],
  completeCheck: (d) => {
    if (!hoursSaved(d).running) return "Mark at least one workflow as actually running.";
    if (!text(d.destination)) return "Say what the reclaimed time is for before you complete this. Unassigned time disappears.";
    return null;
  },
  writes: [
    {
      key: "hours_saved",
      from: (d) => {
        const h = hoursSaved(d);
        return { date: text(d.audited_on), weekly_hours: h.weekly, running: h.running, excluded: h.excluded, destination: text(d.destination) };
      },
    },
  ],
};

export const course11Worksheets = [aiAuditTracker, workflowLibrary, hoursSavedTracker];
