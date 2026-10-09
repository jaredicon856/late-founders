import type { ModeDef } from "../types";
import { SaveError, str, objArray } from "./util";

// SOP Generator. Writes nothing to the member record: the engine creates the
// SOP Library record from the saved output fields
// (title, role, owner, next_review, purpose, steps, exceptions, notes).

type DocBlock = ReturnType<ModeDef["onSave"]>["doc"]["blocks"][number];

const MONTHS =
  "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december";

// True when a title is a date, or leans on a date instead of the task.
export function isDateTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  if (!t) return true;
  if (/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/.test(t)) return true;
  if (/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/.test(t)) return true;
  if (/\b\d{1,2}[-.]\d{1,2}[-.]\d{2,4}\b/.test(t)) return true;
  if (new RegExp(`\\b(${MONTHS})\\b\\.?\\s*\\d{1,4}`).test(t)) return true;
  if (new RegExp(`\\b\\d{1,2}(st|nd|rd|th)?\\s+(of\\s+)?(${MONTHS})\\b`).test(t)) return true;
  if (/\b(today|yesterday)\b/.test(t)) return true;
  if (/^(recording|transcript|voice note|screen recording|untitled|sop)\s*\d*$/.test(t)) return true;
  return false;
}

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export const sopGenerator: ModeDef = {
  assetId: "sop-generator",
  reads: ["sop_roles", "task_sort"],
  writes: [],
  systemPrompt: `You are the SOP Generator. You turn a transcript of the member doing a task while narrating it into a numbered step-by-step SOP that someone else can follow.

The transcript arrives either pasted by the member or supplied by the system from an upload (screen recording or voice note). If there is no transcript yet, ask the member to paste one or upload a recording. Do not write steps for a task you have not seen narrated.

How to write the SOP:
- Steps: one action each, in the order performed, written as an instruction ("Open the client folder in Drive"). Keep the narrator's specifics: tool names, fields, amounts, timings.
- Every step has a "what" and a "why". Fill "why" only with the reason the narrator gave, in plain words. If the narrator gave no reason, leave "why" as an empty string. Never invent a reason.
- Exceptions: this is the part recordings lose most often, so extract aggressively. Look for judgment calls mentioned in passing: "normally I would, but if", "unless", "except when", "if it is a big client", "sometimes I", "watch out for", "it depends". Each becomes a "when" (the situation) and a "do" (what to do instead). If the narrator hinted at an exception without saying what to do, ask the member what they do in that case before saving.
- Purpose: one or two sentences on what the task achieves and when it is done.
- Notes: tools, access or logins needed, and anything else that does not fit a step. Empty string if none.

Before saving, confirm four things with the member, one question at a time:
1. The title. It must name the task ("Send the monthly client invoice"), never a date or "Recording 3". Suggest one and ask them to confirm or rename it.
2. The role it belongs to in their SOP Library (for example Bookkeeper, Client Onboarding). Offer their existing role folders if they have any.
3. The owner: the person responsible for keeping this SOP current.
4. The next review date (YYYY-MM-DD). Suggest three or six months from today.
Then show the steps and the "What to do if" list briefly and ask if anything is missing, especially exceptions. Save only after they confirm.`,
  opener: (p) => {
    const roles = Array.isArray(p.sop_roles) ? (p.sop_roles as unknown[]).map(str).filter(Boolean) : [];
    const ts = p.task_sort as { targets?: unknown } | undefined;
    const targets = Array.isArray(ts?.targets) ? (ts!.targets as unknown[]).map(str).filter(Boolean) : [];
    const lines = [
      "Let's turn one of your tasks into an SOP someone else can follow.",
      "Paste a transcript of yourself doing the task while you talk it through, or upload a screen recording or voice note and I will work from the transcript.",
    ];
    if (targets.length) lines.push(`Your Task-Sort named these as your first delegation targets: ${targets.join("; ")}. Any of them is a good place to start.`);
    if (roles.length) lines.push(`Your SOP Library already has these role folders: ${roles.join(", ")}.`);
    lines.push("Which task is this, and do you have the transcript or recording ready?");
    return lines.join("\n\n");
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "role", "owner", "next_review", "purpose", "steps", "exceptions", "notes"],
    properties: {
      title: { type: "string", description: "Named by the task, never by a date. Confirmed by the member." },
      role: { type: "string", description: "The role folder in the SOP Library. Confirmed by the member." },
      owner: { type: "string", description: "Person responsible for keeping this SOP current." },
      next_review: { type: "string", description: "Next review date, YYYY-MM-DD." },
      purpose: { type: "string" },
      steps: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["what", "why"],
          properties: {
            what: { type: "string", description: "The action, as an instruction." },
            why: { type: "string", description: "The narrator's reason, or empty string if none was given." },
          },
        },
      },
      exceptions: {
        type: "array",
        description: "What to do if: every exception and judgment call in the transcript.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["when", "do"],
          properties: {
            when: { type: "string", description: "The situation, e.g. 'The client is on a retainer'." },
            do: { type: "string", description: "What to do instead." },
          },
        },
      },
      notes: { type: "string" },
    },
  },
  onSave: (o) => {
    const title = str(o.title);
    if (!title) throw new SaveError("title is empty. Ask the member to name the SOP by the task it covers.");
    if (isDateTitle(title))
      throw new SaveError(
        `"${title}" names a date or a recording, not a task. Suggest a task-based title such as "Send the monthly client invoice" and ask the member to confirm it.`,
      );
    const role = str(o.role);
    if (!role) throw new SaveError("role is empty. Ask the member which role this SOP belongs to.");
    const owner = str(o.owner);
    if (!owner) throw new SaveError("owner is empty. Ask the member who keeps this SOP current.");
    const nextReview = str(o.next_review);
    if (!validDate(nextReview)) throw new SaveError("next_review must be a real date written YYYY-MM-DD. Confirm it with the member.");
    if (nextReview <= new Date().toISOString().slice(0, 10))
      throw new SaveError("next_review must be in the future. Ask the member for a review date, for example three or six months from today.");

    const steps = objArray(o.steps)
      .map((s) => ({ what: str(s.what), why: str(s.why) }))
      .filter((s) => s.what);
    if (!steps.length) throw new SaveError("steps is empty. Write at least one step from the transcript before saving.");
    const exceptions = objArray(o.exceptions)
      .map((e) => ({ when: str(e.when), do: str(e.do) }))
      .filter((e) => e.when || e.do);
    const half = exceptions.find((e) => !e.when || !e.do);
    if (half)
      throw new SaveError(
        `An exception is missing its ${half.when ? "action" : "situation"}: "${half.when || half.do}". Ask the member to complete it.`,
      );
    const purpose = str(o.purpose);
    const notes = str(o.notes);

    const blocks: DocBlock[] = [
      {
        type: "kv",
        items: [
          { label: "Role", value: role },
          { label: "Owner", value: owner },
          { label: "Next review", value: nextReview },
        ],
      },
    ];
    if (purpose) blocks.push({ type: "heading", text: "Purpose" }, { type: "paragraph", text: purpose });
    blocks.push(
      { type: "heading", text: "Steps" },
      {
        type: "table",
        table: {
          headers: ["#", "What to do", "Why"],
          widths: [0.3, 2.6, 2],
          rows: steps.map((s, i) => [String(i + 1), s.what, s.why]),
        },
      },
    );
    if (notes) blocks.push({ type: "heading", text: "Notes" }, { type: "paragraph", text: notes });
    blocks.push({ type: "heading", text: "What to do if" });
    if (exceptions.length) {
      blocks.push({
        type: "table",
        table: { headers: ["If", "Then"], widths: [2, 2.6], rows: exceptions.map((e) => [e.when, e.do]) },
      });
    } else {
      blocks.push({
        type: "paragraph",
        tone: "muted",
        text: "No exceptions were captured yet. Add each one here the first time it comes up.",
      });
    }

    return {
      profile: {},
      summary: `${title} · ${steps.length} step${steps.length === 1 ? "" : "s"}, ${exceptions.length} exception${exceptions.length === 1 ? "" : "s"}`,
      doc: {
        title,
        eyebrow: "COURSE 12 · GET OUT OF YOUR OWN BUSINESS",
        purpose: purpose || `How to do this task, step by step, for the ${role} role.`,
        blocks,
      },
    };
  },
};

export const course12Modes = [sopGenerator];
