// Course 14 · Hire & Delegate
//
// Member-record shape owned here (written by the Role Scorecard):
//
//   role_scorecards: {
//     role: string;                                  // role name, the merge key (case-insensitive)
//     outcome: string;                               // the result the role produces, not a duty list
//     tasks: string[];                               // top three tasks that produce the outcome
//     traits: string[];                              // two or three traits the work actually requires
//     numbers: { metric: string; target: string }[]; // one or two numbers checked weekly
//     lane: "AI" | "Contractor" | "Employee" | "";   // from the Contractor / Employee / AI Decision Guide
//   }[]
//
// One worksheet instance holds one role. On save the entry for that role name
// replaces any existing entry with the same name; other roles are kept. The
// most recently saved role is placed first, so role_scorecards[0] is the role
// the member worked on last (read by the onboarding and delegation sheets).

import type { ProfileData, SheetData, WorksheetDef } from "../types";
import { asNumber } from "../profile";

type Row = Record<string, unknown>;

const rows = (d: SheetData, k: string): Row[] => (Array.isArray(d[k]) ? (d[k] as Row[]) : []);
const s = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

interface Scorecard {
  role: string;
  outcome: string;
  tasks: string[];
  traits: string[];
  numbers: { metric: string; target: string }[];
  lane: string;
}

function scorecards(p: ProfileData): Scorecard[] {
  if (!Array.isArray(p.role_scorecards)) return [];
  return (p.role_scorecards as unknown[]).filter(
    (x): x is Scorecard => !!x && typeof x === "object" && typeof (x as Scorecard).role === "string",
  );
}

function latestScorecard(p: ProfileData): Scorecard | null {
  return scorecards(p)[0] ?? null;
}

// ---------------------------------------------------------------------------
// Role Scorecard
// ---------------------------------------------------------------------------

export const roleScorecard: WorksheetDef = {
  assetId: "role-scorecard",
  exports: ["pdf", "docx"],
  dense: true, // spec: must fit one page per role
  reads: ["role_scorecards"],
  sections: [
    {
      title: "The role",
      blocks: [
        {
          kind: "fields",
          fields: [
            { key: "role", label: "Role name", type: "text", width: "half", placeholder: "e.g. Client Onboarding Lead" },
            { key: "date", label: "Date", type: "date", width: "half" },
          ],
        },
      ],
    },
    {
      title: "1 · Outcome",
      intro:
        "Write the result this role produces, not the duties it performs. \"Manage the inbox\" is a duty. \"Every client email answered within one business day\" is a result.",
      blocks: [
        {
          kind: "fields",
          fields: [
            {
              key: "outcome",
              label: "The outcome, stated as a result",
              type: "textarea",
              lines: 2,
              placeholder: "e.g. New clients fully set up and booked into their first session within five days of paying.",
            },
          ],
        },
      ],
    },
    {
      title: "2 · Top three tasks",
      intro: "The three tasks that produce that outcome. If a task does not move the outcome, it does not belong here.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "tasks",
            minRows: 3,
            maxRows: 3,
            rowLabels: ["Task 1", "Task 2", "Task 3"],
            columns: [{ key: "task", label: "Task, written as a specific action", type: "text", width: 5 }],
          },
        },
      ],
    },
    {
      title: "3 · Traits the work requires",
      intro:
        "Two or three. Avoid generic traits like \"hard-working\" or \"team player\": everyone claims them and you cannot test for them. Name what this work punishes if it is missing, such as \"comfortable chasing late payments without apologising\".",
      blocks: [
        {
          kind: "table",
          table: {
            key: "traits",
            minRows: 3,
            maxRows: 3,
            columns: [
              { key: "trait", label: "Trait", type: "text", width: 2 },
              { key: "why", label: "Where the work demands it", type: "text", width: 3 },
            ],
          },
        },
      ],
    },
    {
      title: "4 · Weekly numbers",
      intro: "One or two numbers you check every week to know the role is working. A number, with a target.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "numbers",
            minRows: 2,
            maxRows: 2,
            columns: [
              { key: "metric", label: "Number checked weekly", type: "text", width: 3 },
              { key: "target", label: "Target", type: "text", width: 1.5 },
            ],
          },
        },
      ],
    },
    {
      title: "5 · Lane",
      blocks: [
        {
          kind: "fields",
          fields: [
            {
              key: "lane",
              label: "Who does this work",
              type: "select",
              options: ["AI", "Contractor", "Employee"],
              width: "third",
              hint: "Decide with the Contractor / Employee / AI Decision Guide.",
            },
            {
              key: "lane_reason",
              label: "Why this lane, in one line",
              type: "text",
              width: "full",
              placeholder: "e.g. Ongoing, needs context about our clients, cannot be done from instructions alone.",
            },
          ],
        },
      ],
    },
  ],
  writes: [
    {
      key: "role_scorecards",
      from: (d, p) => {
        const existing = scorecards(p);
        const role = s(d.role);
        if (!role) return existing;
        const entry: Scorecard = {
          role,
          outcome: s(d.outcome),
          tasks: rows(d, "tasks").map((r) => s(r.task)).filter(Boolean),
          traits: rows(d, "traits")
            .map((r) => {
              const t = s(r.trait);
              const why = s(r.why);
              return t && why ? `${t}: ${why}` : t;
            })
            .filter(Boolean),
          numbers: rows(d, "numbers")
            .map((r) => ({ metric: s(r.metric), target: s(r.target) }))
            .filter((n) => n.metric),
          lane: ["AI", "Contractor", "Employee"].includes(s(d.lane)) ? s(d.lane) : "",
        };
        const others = existing.filter((e) => e.role.trim().toLowerCase() !== role.toLowerCase());
        return [entry, ...others];
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Contractor / Employee / AI Decision Guide
// ---------------------------------------------------------------------------

export const laneDecisionGuide: WorksheetDef = {
  assetId: "lane-decision-guide",
  exports: ["pdf", "docx"],
  readOnly: true,
  sections: [
    {
      title: "Start with the task, not the person",
      blocks: [
        {
          kind: "prose",
          paragraphs: [
            "Most founders decide to \"hire someone\" and then work out what that person will do. That order is how you end up paying a salary for work a tool could do, or handing a contractor work that needs someone who knows every client by name.",
            "Take one task, or one Role Scorecard, and run it through the three questions below in order. Each answer narrows the lane. By the third question the lane is usually obvious, and when it is not, the table on the next page settles it.",
          ],
        },
      ],
    },
    {
      title: "The three questions, in order",
      blocks: [
        {
          kind: "prose",
          heading: "1. Does this need ongoing context about the business, or can it be done from instructions alone?",
          paragraphs: [
            "Context is everything you know that is not written down: which client is touchy about invoices, why you never discount the premium tier, which supplier quietly ships late. If the task can be done well by someone reading a clear SOP, it does not need context. If doing it well depends on judgment built up over months inside the business, it does.",
            "Example: reformatting podcast transcripts into blog drafts runs on instructions alone. Deciding which past client to approach for a case study needs context.",
            "Instructions alone points toward AI or a contractor. Ongoing context points toward an employee.",
          ],
        },
        {
          kind: "prose",
          heading: "2. Is it well-defined enough to hand to someone who has never spoken to you?",
          paragraphs: [
            "Picture a stranger receiving the task by email. Could they deliver the right result without a call? If yes, the task is defined. If you would need to explain, correct and re-explain, it is not defined yet, and no lane will fix that. Write the SOP or the brief first, then come back to this question.",
            "Example: \"Build a five-page site in our existing template using this copy\" is defined. \"Sort out our marketing\" is not.",
            "Well-defined and repeatable points toward AI. Well-defined but specialised points toward a contractor.",
          ],
        },
        {
          kind: "prose",
          heading: "3. Is it ongoing and embedded, or bounded and project-based?",
          paragraphs: [
            "Bounded work has a finish line: a logo, a tax return, a website rebuild, a data migration. Ongoing work never ends and touches other people's work every week: client support, bookkeeping that the rest of the team relies on, account management.",
            "Bounded points toward a contractor. Ongoing and embedded points toward an employee, and it is also the shape that raises the classification question in the warning below.",
          ],
        },
      ],
    },
    {
      title: "The decision table",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "computed",
          key: "lane_table",
          label: "Task shape to lane",
          compute: () => ({
            headers: ["Task shape", "Lane", "Typical examples", "What you still own"],
            rows: [
              [
                "Repeatable and rules-based, no relationship needed",
                "AI",
                "First-draft emails, transcript clean-up, data entry from forms, meeting summaries, invoice reminders",
                "Writing the rules, checking the output weekly, handling every exception",
              ],
              [
                "Specialised and bounded",
                "Contractor",
                "Brand identity, website build, annual accounts, a legal review, a one-off ad campaign",
                "A clear brief, the deadline, accepting or rejecting the deliverable",
              ],
              [
                "Ongoing and context-dependent",
                "Employee",
                "Client account management, operations lead, sales follow-up, day-to-day bookkeeping",
                "Onboarding, regular check-ins, the outcome metric on their scorecard",
              ],
            ],
          }),
        },
        {
          kind: "prose",
          heading: "When the answers disagree",
          bullets: [
            "Instructions alone, but ongoing: start with AI or a contractor on a defined scope. If it keeps needing context, that is your signal the role is growing into an employee.",
            "Needs context, but bounded: keep it yourself, or use a contractor you have worked with before who already knows the business.",
            "Not well-defined yet: no lane. Write the SOP first. Delegating an undefined task moves the confusion, it does not remove it.",
            "Split the role. Many scorecards contain one AI piece, one contractor piece and one employee piece. Splitting is often cheaper than hiring for the whole.",
          ],
        },
        {
          kind: "callout",
          tone: "note",
          title: "Record the decision",
          text: "Write the lane and a one-line reason in the Lane field of the Role Scorecard. If the reason changes later, the lane should too.",
        },
        {
          kind: "callout",
          tone: "legal",
          title: "Employment classification is a legal question",
          text: "Whether someone is a contractor or an employee is governed by local labour law, and the tests vary by jurisdiction. Ongoing, embedded work under your direction can make a \"contractor\" an employee in law, whatever the contract calls them, with back taxes, benefits and penalties at stake. Confirm the classification with a local employment lawyer or accountant before you finalise any ongoing contractor arrangement. This guide is general guidance, not legal advice.",
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Interview & People-Reading Guide
// ---------------------------------------------------------------------------

export const interviewPeopleGuide: WorksheetDef = {
  assetId: "interview-people-guide",
  exports: ["pdf", "docx"],
  readOnly: true,
  sections: [
    {
      title: "How to use this guide",
      blocks: [
        {
          kind: "prose",
          paragraphs: [
            "Bring your Role Scorecard into every interview. The outcome, tasks and traits on it are what you are testing for. These five questions are built to get past rehearsed answers to what the person has actually done, and Part 2 covers what to notice while they talk.",
            "Ask every candidate the same five questions in the same order, and write notes during the call, not after. You are comparing people against the scorecard, not against each other's charm.",
          ],
        },
      ],
    },
    {
      title: "Part 1 · The five interview questions",
      blocks: [
        {
          kind: "prose",
          heading: "1. \"Walk me through the last time you did this exact task.\"",
          paragraphs: [
            "Name a task from your scorecard. You want one specific, recent instance, not their general approach.",
            "Listen for: a real date or project, the steps in order, the tools they used, a number or result at the end, and what they would do differently. Detail you did not ask for is a good sign; people remember what they actually did.",
            "Weak answer: \"Usually I would...\" or \"My approach is...\". Generalities, no specific instance, or a story that drifts to a different task. Push once: \"Pick the most recent one. What happened first?\" If they still cannot name one, they may not have done it.",
          ],
        },
        {
          kind: "prose",
          heading: "2. \"Tell me about a real mistake and what you did next.\"",
          paragraphs: [
            "Listen for: a mistake that cost something, ownership in the first person (\"I missed it\"), how fast they told someone, what they fixed, and what they changed so it would not happen again. The \"what next\" matters more than the mistake.",
            "Weak answer: a disguised strength (\"I care too much\"), a mistake that was really someone else's fault, or a mistake with no consequence. Someone who cannot name a real mistake will hide one from you on the job.",
          ],
        },
        {
          kind: "prose",
          heading: "3. \"Tell me about a manager or coworker you did not get along with.\"",
          paragraphs: [
            "Listen for: a fair description of the other person's point of view, what the candidate did to make it work, and what they learned about how they work with others. Disagreement handled directly and respectfully is what you want.",
            "Weak answer: the other person as a villain with no redeeming side, contempt in the tone, or \"I get along with everyone\". The way they describe a past colleague is close to the way they will describe you.",
          ],
        },
        {
          kind: "prose",
          heading: "4. \"What does a bad day at this work look like for you?\"",
          paragraphs: [
            "Listen for: a bad day that matches the real friction of your role. If the job is chasing unpaid invoices and their bad day is \"awkward conversations about money\", that is honest and useful, so ask how they get through it. You want self-awareness and a coping habit.",
            "Weak answer: \"I don't really have bad days\", or a bad day that describes the core of your role as something they avoid. Both tell you the fit will cost you later.",
          ],
        },
        {
          kind: "prose",
          heading: "5. A live scenario from your own business",
          paragraphs: [
            "Before the interview, write a short real situation from the last month of your business, with the names changed. Pick one that tests a task or trait on your scorecard. Read it out and ask: \"What would you do first, and what would you need from me?\"",
            "Example for an operations hire: \"A client paid on Friday, nobody sent the welcome pack, and they emailed on Monday asking if we received the money. You see this at 9am. Walk me through it.\"",
            "Listen for: a first step that is concrete, questions that show they understand what matters to the client, and a sensible line between what they would handle and what they would bring to you.",
            "Weak answer: waiting for instructions on everything, or confidently solving it in a way that would damage the client relationship. Both show you how the first month will go.",
          ],
        },
      ],
    },
    {
      title: "Part 2 · Reading people",
      pageBreakBefore: true,
      intro: "Five signals to notice while the candidate talks. None of them is proof on its own. Each tells you where to ask the next question.",
      blocks: [
        {
          kind: "callout",
          tone: "warning",
          title: "A read is a hypothesis, never a verdict",
          text: "Every signal below is a guess about the person that you test with a follow-up question before it counts. Cultural norms around directness, eye contact, pauses and self-promotion differ widely. Someone who looks away while thinking, or plays down their own achievements, may be showing respect, not evasion. Judge the substance of the answers, and test your read before you trust it.",
        },
        {
          kind: "prose",
          heading: "1. Congruence between words and delivery",
          paragraphs: [
            "Notice when what they say and how they say it point in different directions: \"I loved that job\" said flatly, or energy that rises sharply on one topic and drops on another.",
            "Test it: \"You sounded less sure about that one. What was it really like?\"",
          ],
        },
        {
          kind: "prose",
          heading: "2. How they treat people with no power over them",
          paragraphs: [
            "Notice how they speak to whoever scheduled the call, a junior team member who joins, or how they describe support staff and juniors in past roles. Politeness aimed only at the decision-maker is a performance.",
            "Test it: ask whoever else met them how the interaction went, and ask the candidate \"Who did you rely on most in that role who was not your manager?\"",
          ],
        },
        {
          kind: "prose",
          heading: "3. Response to an unprepared question",
          paragraphs: [
            "Ask one question they could not have rehearsed, such as the live scenario, or a follow-up two levels deep on a detail they mentioned. Notice whether they think out loud, ask a clarifying question, or cover with confident filler.",
            "Test it: \"What would you need to know to answer that properly?\" A good candidate can say \"I don't know yet, here is how I would find out.\"",
          ],
        },
        {
          kind: "prose",
          heading: "4. Consistency across the whole conversation",
          paragraphs: [
            "Notice whether details hold together: team size, their role in a project, dates, numbers. A story told at minute five and retold at minute forty should match.",
            "Test it: return to an earlier detail later in the call. \"Earlier you mentioned the team was four people. Who owned the reporting?\" Then check references against what you heard.",
          ],
        },
        {
          kind: "prose",
          heading: "5. How they describe the past",
          paragraphs: [
            "Notice the balance of \"I\" and \"we\", and whether past employers, clients and colleagues are described with fairness or blame. People carry their account of the past into the next job.",
            "Test it: \"If I called your last manager, what would they say you were best at, and what would they say you needed to work on?\"",
          ],
        },
        {
          kind: "prose",
          heading: "After the interview",
          bullets: [
            "Score the candidate against each scorecard trait while it is fresh: evidence seen, evidence missing.",
            "List any read you have not yet tested and the question that would test it. Use it in the reference call or a second conversation.",
            "If you liked someone but cannot point to evidence for the outcome on your scorecard, that is a feeling, not a decision.",
          ],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// 30/60/90 Onboarding Checklist
// ---------------------------------------------------------------------------

export const onboarding306090: WorksheetDef = {
  assetId: "onboarding-30-60-90",
  exports: ["pdf", "docx"],
  reads: ["role_scorecards"],
  initial: (p) => {
    const sc = latestScorecard(p);
    return sc ? { role: sc.role, outcome: sc.outcome } : {};
  },
  sections: [
    {
      title: "The hire",
      blocks: [
        {
          kind: "callout",
          tone: "note",
          title: "Hand this to your hire on day one",
          text: "This plan belongs to both of you. Give your new hire a copy on their first day so they know exactly what success looks like at 30, 60 and 90 days, instead of guessing.",
        },
        {
          kind: "fields",
          fields: [
            { key: "hire_name", label: "Hire name", type: "text", width: "third" },
            { key: "role", label: "Role", type: "text", width: "third" },
            { key: "start_date", label: "Start date", type: "date", width: "third" },
            {
              key: "outcome",
              label: "The outcome this role owns (from the Role Scorecard)",
              type: "textarea",
              lines: 2,
            },
          ],
        },
      ],
    },
    {
      title: "Days 1 to 30 · Learn and execute with support",
      intro:
        "They do the real work from week one, with you close by. Write the success marker so the answer on day 30 is a plain yes or no, e.g. \"Has completed ten client onboardings using the SOP with no missed steps.\"",
      blocks: [
        {
          kind: "checklist",
          key: "stage1_setup",
          mode: "check",
          items: [
            { key: "access", label: "All tool and account access working by the end of day one" },
            { key: "scorecard", label: "Role Scorecard walked through together: outcome, tasks, weekly numbers" },
            { key: "sops", label: "Every SOP for their top three tasks shared and read" },
            { key: "first_task", label: "First real task completed alongside you in week one" },
          ],
        },
        {
          kind: "fields",
          fields: [
            { key: "s1_marker", label: "Success marker (answerable yes or no)", type: "text" },
            { key: "s1_met", label: "Met on day 30?", type: "yesno", width: "third" },
            {
              key: "s1_cadence",
              label: "Check-in cadence",
              type: "text",
              width: "full",
              placeholder: "e.g. 15-minute status check daily, 30-minute relationship check-in every Friday",
            },
            {
              key: "s1_watch",
              label: "What to watch for",
              type: "textarea",
              lines: 3,
              hint: "Questions they stop asking too early, steps skipped in the SOP, work held back until it is \"perfect\".",
            },
          ],
        },
      ],
    },
    {
      title: "Days 31 to 60 · Execute independently and handle exceptions",
      intro:
        "They run the tasks without you checking each one, and start handling the cases the SOP does not cover. Each exception they solve should end up written into the SOP.",
      blocks: [
        {
          kind: "checklist",
          key: "stage2_setup",
          mode: "check",
          items: [
            { key: "solo", label: "Top three tasks done without your review of each one" },
            { key: "exceptions", label: "Exceptions logged, with what they did and why" },
            { key: "sop_updates", label: "At least one SOP updated by them from a real exception" },
          ],
        },
        {
          kind: "fields",
          fields: [
            { key: "s2_marker", label: "Success marker (answerable yes or no)", type: "text" },
            { key: "s2_met", label: "Met on day 60?", type: "yesno", width: "third" },
            { key: "s2_cadence", label: "Check-in cadence", type: "text", width: "full", placeholder: "e.g. status check twice a week, relationship check-in every two weeks" },
            {
              key: "s2_watch",
              label: "What to watch for",
              type: "textarea",
              lines: 3,
              hint: "Exceptions escalated that they could have decided, or decided that they should have escalated.",
            },
          ],
        },
      ],
    },
    {
      title: "Days 61 to 90 · Own the outcome and contribute improvements",
      intro:
        "The weekly number on the scorecard is now theirs. They report it, explain it when it moves, and propose at least one improvement to how the work is done.",
      blocks: [
        {
          kind: "checklist",
          key: "stage3_setup",
          mode: "check",
          items: [
            { key: "metric", label: "They report the weekly number to you, not the other way round" },
            { key: "improvement", label: "One improvement proposed and tried" },
            { key: "review", label: "90-day review held, with the next quarter's targets agreed" },
          ],
        },
        {
          kind: "fields",
          fields: [
            { key: "s3_marker", label: "Success marker (answerable yes or no)", type: "text" },
            { key: "s3_met", label: "Met on day 90?", type: "yesno", width: "third" },
            { key: "s3_cadence", label: "Check-in cadence", type: "text", width: "full", placeholder: "e.g. weekly status check, monthly relationship check-in" },
            {
              key: "s3_watch",
              label: "What to watch for",
              type: "textarea",
              lines: 3,
              hint: "You still being the first to notice when the number slips.",
            },
          ],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Delegation Check-In Tracker
// ---------------------------------------------------------------------------

function weekMet(r: Row, target: number | null, higherBetter: boolean): boolean | null {
  const flag = s(r.on_target);
  if (flag === "yes") return true;
  if (flag === "no") return false;
  const result = asNumber(r.result);
  if (result === null || target === null) return null;
  return higherBetter ? result >= target : result <= target;
}

export const delegationTracker: WorksheetDef = {
  assetId: "delegation-tracker",
  exports: ["pdf", "xlsx"],
  reads: ["role_scorecards"],
  initial: (p) => {
    const sc = latestScorecard(p);
    if (!sc) return {};
    const first = Array.isArray(sc.numbers) ? sc.numbers[0] : undefined;
    const target = first ? asNumber(first.target) : null;
    return {
      role: sc.role,
      metric_name: first?.metric ?? "",
      ...(target !== null ? { metric_target: target } : {}),
    };
  },
  sections: [
    {
      title: "Who and what",
      blocks: [
        {
          kind: "fields",
          fields: [
            { key: "person", label: "Person", type: "text", width: "half" },
            { key: "role", label: "Role", type: "text", width: "half" },
          ],
        },
        {
          kind: "callout",
          tone: "note",
          title: "Keep the two cadences apart",
          text: "Status check-ins are about the work: short, frequent, three answers. Relationship check-ins are about the person: less often, open-ended, no task list. Mixing them means the relationship conversation never happens.",
        },
      ],
    },
    {
      title: "Status check-ins",
      intro: "Frequent and short. Three lines each: what got done, what is blocked, what is next.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "status",
            minRows: 10,
            addable: true,
            columns: [
              { key: "date", label: "Date", type: "date", width: 0.8 },
              { key: "done", label: "Done", type: "text", width: 2 },
              { key: "blocked", label: "Blocked", type: "text", width: 2 },
              { key: "next", label: "Next", type: "text", width: 2 },
            ],
          },
        },
      ],
    },
    {
      title: "Relationship check-ins",
      intro: "Less often, for example every two weeks, then monthly. Ask the open questions and listen more than you talk.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "relationship",
            minRows: 4,
            addable: true,
            columns: [
              { key: "date", label: "Date", type: "date", width: 0.8 },
              { key: "how", label: "How is it going?", type: "textarea", width: 2 },
              { key: "working", label: "What is working", type: "textarea", width: 2 },
              { key: "not_working", label: "What is not working", type: "textarea", width: 2 },
            ],
          },
        },
      ],
    },
    {
      title: "Outcome metric, week by week",
      intro: "The weekly number from the Role Scorecard, tracked against its target.",
      blocks: [
        {
          kind: "fields",
          fields: [
            { key: "metric_name", label: "Metric", type: "text", width: "half" },
            { key: "metric_target", label: "Target", type: "number", width: "third" },
            {
              key: "direction",
              label: "On target means",
              type: "select",
              options: ["At or above target", "At or below target"],
              width: "third",
            },
          ],
        },
        {
          kind: "table",
          table: {
            key: "weekly",
            minRows: 12,
            addable: true,
            columns: [
              { key: "week", label: "Week of", type: "date", width: 1 },
              { key: "result", label: "Result", type: "number", width: 1 },
              { key: "on_target", label: "On target?", type: "yesno", width: 0.8 },
              { key: "notes", label: "Notes", type: "text", width: 3 },
            ],
          },
        },
        {
          kind: "computed",
          key: "last_four",
          label: "Last four weeks against target",
          big: true,
          compute: (d) => {
            const target = asNumber(d.metric_target);
            const higherBetter = s(d.direction) !== "At or below target";
            const logged = rows(d, "weekly").filter((r) => s(r.week) || asNumber(r.result) !== null || s(r.on_target));
            if (logged.length === 0) return null;
            const lastFour = logged.slice(-4).map((r) => weekMet(r, target, higherBetter));
            const met = lastFour.filter((m) => m === true).length;
            const unknown = lastFour.filter((m) => m === null).length;
            if (logged.length < 4) return `${met} of ${logged.length} weeks on target so far. Four weeks needed.`;
            if (unknown > 0) return `${met} of 4 on target. ${unknown} week(s) need a result and a target, or an on-target answer.`;
            if (met === 4) return "4 of 4 on target. A steady month: you can space check-ins further out.";
            return `${met} of 4 on target. Keep the current check-in cadence.`;
          },
        },
        {
          kind: "callout",
          tone: "note",
          text: "A steady result for a month is the evidence to space check-ins further out. Not a feeling that things are fine, and not a quiet week: four weeks on target.",
        },
      ],
    },
  ],
};

export const course14Worksheets = [
  roleScorecard,
  laneDecisionGuide,
  interviewPeopleGuide,
  onboarding306090,
  delegationTracker,
];
