import type { ModeDef, ProfileData } from "../types";
import { SaveError, str, objArray } from "./util";

// Member record shapes written here:
//
// journal_entries: {
//   id: string;              // "je-<timestamp>"
//   date: string;            // yyyy-mm-dd
//   prompt_set: "Layoff reframe" | "Rut as signal" | "Perfectly timed";
//   factual: string;         // the member's factual account, in their words
//   first_decision: string;  // the first deliberate decision they made afterward
//   reframed: string;        // the same events with the member as the actor
//   spoken_sentence: string; // the one-sentence, said-aloud version
// }[]
// Entries are permanent: every save appends; prior entries are never edited or removed.
//
// origin_story: string       // the latest spoken_sentence (read by the 90-Day Commitment Worksheet)

type DocBlock = ReturnType<ModeDef["onSave"]>["doc"]["blocks"][number];

const PROMPT_SETS = ["Layoff reframe", "Rut as signal", "Perfectly timed"] as const;
const MAX_SENTENCE_WORDS = 40;

const existingEntries = (p: ProfileData) => (Array.isArray(p.journal_entries) ? (p.journal_entries as unknown[]) : []);

export const reframingJournal: ModeDef = {
  assetId: "reframing-journal",
  reads: ["founder_type", "journal_entries", "origin_story"],
  writes: ["journal_entries", "origin_story"],
  systemPrompt: `You run the Reframing Journal. The member rewrites one chapter of their working life so they are the one who acted, not the one things happened to.

Three prompt sets. The member picks one per entry:
- Layoff reframe: a job that ended, a layoff, a restructure, being pushed out.
- Rut as signal: a stretch of feeling stuck, bored or passed over, read as information about what they wanted next.
- Perfectly timed: why starting now, later in life, is the right moment rather than a late one.
You may suggest the set that fits their founder type, but the member chooses.

Steps, in order:
1. Factual account. Ask the member to write what happened, plainly, as facts: what, when, who, what they did. No interpretation yet. Let them write at length; do not rewrite it for them.
2. Follow-ups. Ask one question at a time to find the first deliberate decision they made afterward: the first thing they chose to do rather than had done to them (a call they made, a course they signed up for, a no they said, a plan they started). Keep asking until that decision is specific and in their words. If they cannot name one, help them look at the days and weeks after, but never supply one for them.
3. Reframe. Write the same account again with the member as the actor: same events, same order, told from that first decision forward. Use only events and details the member described. Do not invent conversations, feelings, outcomes, dates or people. Do not exaggerate. Keep their voice; first person; plain words. Show it to them and revise until they say it is true.
4. Spoken sentence. Compress the reframe into one sentence they could say aloud when someone asks "So what made you start this?" Under ${MAX_SENTENCE_WORDS} words, first person, no jargon. Ask them to say it out loud and tell you if it sounds like them. Revise until it does. Tell them this sentence becomes their origin story, used on their 90-Day Commitment Worksheet, and replaces any previous one.

Save only after the member approves both the reframe and the sentence. "factual" must be the member's own account as they wrote it (you may join multiple messages, but do not rewrite it).`,
  opener: (p: ProfileData) => {
    const type = typeof p.founder_type === "string" ? p.founder_type : "";
    const count = existingEntries(p).length;
    const story = typeof p.origin_story === "string" ? p.origin_story.trim() : "";
    const lines = ["This journal takes one chapter of your story and rewrites it with you as the one who acted. You write what happened, I ask a few questions, and we end with a single sentence you can say out loud."];
    if (count) lines.push(`You have ${count} saved ${count === 1 ? "entry" : "entries"}. They stay as they are; today's entry is added beside them.`);
    if (story) lines.push(`Your current origin story: "${story}"`);
    const suggestion =
      type === "Fresh Start" ? " As a Fresh Start founder, the layoff reframe is a good place to begin." :
      type === "First-Timer" ? " As a First-Timer, rut as signal is a good place to begin." :
      type === "Buried Founder" ? " As a Buried Founder, perfectly timed is a good place to begin." : "";
    lines.push(
      `Pick one to work on today: the layoff reframe, rut as signal, or perfectly timed.${suggestion}`,
    );
    return lines.join("\n\n");
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["prompt_set", "factual", "first_decision", "reframed", "spoken_sentence"],
    properties: {
      prompt_set: { type: "string", enum: [...PROMPT_SETS] },
      factual: { type: "string", description: "The member's factual account, in their own words." },
      first_decision: { type: "string", description: "The first deliberate decision they made afterward, as they described it." },
      reframed: { type: "string", description: "The approved reframe, with the member as the actor. Only events they described." },
      spoken_sentence: { type: "string", description: "One sentence to say aloud, approved by the member." },
    },
  },
  onSave: (o, profile) => {
    const promptSet = str(o.prompt_set);
    if (!(PROMPT_SETS as readonly string[]).includes(promptSet)) throw new SaveError(`prompt_set must be one of: ${PROMPT_SETS.join(", ")}.`);
    const factual = str(o.factual);
    if (!factual) throw new SaveError("factual is empty. Save the member's own factual account.");
    const decision = str(o.first_decision);
    if (!decision) throw new SaveError("first_decision is empty. Keep asking until the member names the first deliberate decision they made.");
    const reframed = str(o.reframed);
    if (!reframed) throw new SaveError("reframed is empty.");
    const sentence = str(o.spoken_sentence).replace(/\s+/g, " ");
    if (!sentence) throw new SaveError("spoken_sentence is empty.");
    const words = sentence.split(" ").length;
    if (words > MAX_SENTENCE_WORDS)
      throw new SaveError(`spoken_sentence is ${words} words. Cut it to under ${MAX_SENTENCE_WORDS} with the member so it can be said in one breath.`);
    if (/[.!?]\s+\S/.test(sentence)) throw new SaveError("spoken_sentence must be a single sentence. Combine or cut it with the member.");

    const now = new Date();
    const entry = {
      id: `je-${now.getTime()}`,
      date: now.toISOString().slice(0, 10),
      prompt_set: promptSet,
      factual,
      first_decision: decision,
      reframed,
      spoken_sentence: sentence,
    };
    // Append only: prior entries are kept exactly as saved.
    const entries = [...existingEntries(profile), entry];

    const earlier = objArray(existingEntries(profile));
    const blocks: DocBlock[] = [
      { type: "kv", items: [{ label: "Prompt set", value: promptSet }, { label: "Date", value: entry.date }] },
      {
        type: "table",
        table: {
          headers: ["What happened", "The reframe: you as the actor"],
          widths: [1, 1],
          rows: [[factual, reframed]],
        },
      },
      { type: "heading", text: "Your first deliberate decision" },
      { type: "paragraph", text: decision },
      { type: "big", label: "Say it out loud", value: sentence, note: "Your origin story, in one sentence." },
    ];
    if (earlier.length) {
      blocks.push(
        { type: "heading", text: "Earlier entries" },
        {
          type: "table",
          table: {
            headers: ["Date", "Prompt set", "Sentence"],
            widths: [0.7, 0.9, 3],
            rows: earlier.map((e) => [str(e.date), str(e.prompt_set), str(e.spoken_sentence)]),
          },
        },
      );
    }

    return {
      profile: { journal_entries: entries, origin_story: sentence },
      summary: `${promptSet} · "${sentence}"`,
      doc: {
        title: "Reframing Journal",
        eyebrow: "COURSE 02 · THE LATE ADVANTAGE",
        purpose: "Your account and its reframe side by side, compressed into one sentence you can say out loud.",
        blocks,
      },
    };
  },
};

export const course02Modes = [reframingJournal];
