import type { ModeDef, ProfileData } from "../types";
import { SaveError, obj, str } from "./util";

// Member record written here:
//   message_sequence: { date; steps: { step; job; message; delay_days }[]; value_test: string }
// Read: icp_paragraph (ICP Worksheet), offer_record (Course 05), angle_statement (Course 07).

type DocBlock = ReturnType<ModeDef["onSave"]>["doc"]["blocks"][number];

const LINK = /(https?:\/\/|www\.|calendly|cal\.com|book a (time|call|slot)|grab a (time|slot)|my calendar)/i;
const PITCH = /\b(i help|we help|my (service|offer|program|course|company)|our (service|offer|program|company)|book a call|hop on a call)\b/i;

const STEPS = [
  { key: "request", label: "1 · Connection request", job: "Gets accepted." },
  { key: "opener", label: "2 · Opener", job: "Starts a real exchange and proves you looked at their profile." },
  { key: "value", label: "3 · Value message", job: "Gives something useful, unprompted." },
  { key: "cta", label: "4 · Soft CTA", job: "Asks a question, with an easy out." },
] as const;

export const sequenceGenerator: ModeDef = {
  assetId: "sequence-generator",
  reads: ["icp_paragraph", "offer_record", "angle_statement", "message_sequence"],
  writes: ["message_sequence"],
  systemPrompt: `You run the Message-Sequence Generator for Course 08. You draft a four-step LinkedIn sequence for the buyer in the member's ICP paragraph. Each step has one job.

1. Connection request. Its only job is to get accepted. Under 300 characters. It references the buyer's trigger condition from the ICP. No pitch, and no mention of what the member does or sells.
2. Opener. Starts a genuine exchange: one low-pressure observation or question tied to their situation that proves the member looked at the profile. No pitch.
3. Value message. Gives one genuinely useful insight or resource, unprompted, with no pivot to a pitch in the same message. Before you show it, test it: would this be worth receiving if the person never replied? If not, it is a teaser, not value. Say so plainly and rewrite it until it passes. In save_output, state in one sentence why it passes.
4. Soft CTA. Asks a question rather than giving an instruction, refers directly to the value message, includes an explicit easy out ("if the timing is wrong, no problem"), and contains no calendar link or booking language.

Delays: 3 to 5 days between unanswered steps (none before step 1).

Use the ICP paragraph, and the member's offer and angle statement when they are in the record, only to make the messages specific; never quote the offer in steps 1 to 3. Do not invent facts about the buyer: write placeholders like [their new warehouse] where the member fills in each prospect's detail. Show all four, let the member edit, and save once they approve.`,
  opener: (p: ProfileData) => {
    const icp = str(p.icp_paragraph);
    if (!icp)
      return "This tool writes from your ICP paragraph, and you do not have one yet. Fill in the ICP Worksheet first (it takes ten minutes), then come back and I will draft your four messages from it.";
    const prev = obj(p.message_sequence);
    const lines = [`I will write from your ICP: "${icp}"`, "Four messages, each with one job: get accepted, start a real exchange, give something useful, then ask a soft question with an easy out."];
    if (str(prev.date)) lines.push(`You saved a sequence on ${str(prev.date)}. This run will be saved as a new version beside it.`);
    lines.push("Before I draft: what is one genuinely useful thing you could give this buyer for free, such as a checklist, a number, or a mistake to avoid? That becomes the value message.");
    return lines.join("\n\n");
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["request", "opener", "value", "cta", "value_test", "delays"],
    properties: {
      request: { type: "string", description: "Step 1, under 300 characters." },
      opener: { type: "string" },
      value: { type: "string" },
      cta: { type: "string" },
      value_test: { type: "string", description: "One sentence: why the value message is worth receiving even if they never reply." },
      delays: {
        type: "object",
        additionalProperties: false,
        required: ["before_opener", "before_value", "before_cta"],
        properties: {
          before_opener: { type: "integer" },
          before_value: { type: "integer" },
          before_cta: { type: "integer" },
        },
      },
    },
  },
  onSave: (o, profile) => {
    if (!str(profile.icp_paragraph)) throw new SaveError("There is no ICP paragraph on record. The member must complete the ICP Worksheet first.");
    const msgs = { request: str(o.request), opener: str(o.opener), value: str(o.value), cta: str(o.cta) };
    for (const s of STEPS) if (!msgs[s.key]) throw new SaveError(`${s.label} is empty.`);
    if (msgs.request.length > 300) throw new SaveError(`The connection request is ${msgs.request.length} characters. Cut it under 300.`);
    if (PITCH.test(msgs.request)) throw new SaveError("The connection request pitches. Its only job is to get accepted: reference their trigger, say nothing about what the member sells.");
    if (PITCH.test(msgs.opener)) throw new SaveError("The opener pitches. Make it an observation or question about them.");
    if (PITCH.test(msgs.value))
      throw new SaveError("The value message pivots to a pitch. Give the value and stop.");
    if (!str(o.value_test)) throw new SaveError("Run the still-worth-receiving test on the value message and state why it passes.");
    for (const s of STEPS) if (LINK.test(msgs[s.key])) throw new SaveError(`${s.label} contains a link or booking language. No links, no calendar.`);
    if (!msgs.cta.includes("?")) throw new SaveError("The soft CTA must ask a question, not give an instruction.");
    const d = obj(o.delays);
    const delays = [d.before_opener, d.before_value, d.before_cta].map((x) => (typeof x === "number" ? Math.round(x) : NaN));
    if (delays.some((x) => !(x >= 3 && x <= 5))) throw new SaveError("Each delay between unanswered steps must be 3 to 5 days.");

    const steps = STEPS.map((s, i) => ({ step: s.label, job: s.job, message: msgs[s.key], delay_days: i === 0 ? 0 : delays[i - 1] }));
    const date = new Date().toISOString().slice(0, 10);
    const blocks: DocBlock[] = [{ type: "kv", items: [{ label: "Written for", value: str(profile.icp_paragraph) }] }];
    for (const s of steps) {
      blocks.push(
        { type: "heading", text: s.step },
        { type: "paragraph", text: `${s.job}${s.delay_days ? ` Send ${s.delay_days} days after the last step if there is no reply.` : ""}`, tone: "muted" },
        { type: "paragraph", text: s.message },
      );
      if (s.step.startsWith("3")) blocks.push({ type: "callout", tone: "note", title: "Still worth receiving?", text: str(o.value_test) });
    }
    blocks.push({ type: "callout", tone: "warning", text: "Fill every [bracket] with that prospect's real detail before sending. Never send the same words to everyone." });

    return {
      profile: { message_sequence: { date, steps, value_test: str(o.value_test) } },
      summary: `Four-step sequence · request ${msgs.request.length} characters`,
      doc: {
        title: "LinkedIn Message Sequence",
        eyebrow: "COURSE 08 · LINKEDIN AUTOMATION & CAMPAIGN SETUP",
        purpose: "Four messages, each with one job, ready to load into your outreach tool.",
        blocks,
      },
    };
  },
};

export const course08Modes = [sequenceGenerator];
