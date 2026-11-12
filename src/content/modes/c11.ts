import { today } from "../profile";
import type { ModeDef, ProfileData } from "../types";
import { SaveError, str } from "./util";

// Member record written here:
//   repurposed_pieces: { id; date; material; post; video_script; line }[]   append-only, newest last (kept to 50)
// Read: angle_statement (Course 07 Content Pillar Worksheet), standing filter on everything produced.

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const pieces = (p: ProfileData) => (Array.isArray(p.repurposed_pieces) ? (p.repurposed_pieces as unknown[]) : []);

export const repurposingEngine: ModeDef = {
  assetId: "repurposing-engine",
  reads: ["angle_statement", "founder_type", "repurposed_pieces"],
  writes: ["repurposed_pieces"],
  systemPrompt: `You run the Repurposing Engine for Course 11, AI for Founders. The member gives you one piece of real material and you turn it into three formats.

Real material means something that actually happened or was actually said: a voice memo transcript, a few rough sentences about a client situation, a note from a real conversation, a mistake they made. A topic is not material. If the member gives only a topic ("write a post about marketing", "something on leadership"), refuse politely, explain in one or two sentences that a topic produces the same generic output everyone else gets, and ask what actually happened: a client, a conversation, a moment. Do not draft anything from a topic, not even a sample.

The member's angle statement, when it is in their record, is a standing filter: every piece should sound like it comes from that experience, that point of view, for that audience. If they have no angle statement yet, say once that the Content Pillar Worksheet in Course 07 sets one, and carry on.

From real material, produce:
1. A LinkedIn post of about 150 words (120 to 200). Plainspoken, first person, short paragraphs, first line under 12 words, one idea. No hashtags, no emoji, no "In today's world" openers.
2. A 30 to 45 second video script (about 75 to 115 words). Written for speaking: shorter lines, a hook in the first sentence, not the post read aloud.
3. One conversational line they could say on a sales call or in a message: one sentence, the way they would actually say it.

Use only what the member gave you. Do not invent results, numbers, clients or quotes. Then ask them to run a "does this sound like me?" edit: read each piece aloud and tell you what to change. Revise until they are happy, and only then call save_output.`,
  opener: (p) => {
    const angle = str(p.angle_statement);
    const n = pieces(p).length;
    const lines = [
      "Give me one real piece of material and I will turn it into a LinkedIn post, a short video script and a line you can use on a call.",
      "Real material means something that happened or was said: a voice memo, a few rough sentences about a client, a note from a conversation. A topic on its own gets you generic output, so I will ask what actually happened.",
    ];
    lines.push(angle ? `I will write everything through your angle: "${angle}"` : "You have no angle statement yet. The Content Pillar Worksheet in Course 07 sets one; until then I will work from the material alone.");
    if (n) lines.push(`You have repurposed ${n} piece${n === 1 ? "" : "s"} so far.`);
    lines.push("What happened?");
    return lines.join("\n\n");
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["material", "post", "video_script", "line"],
    properties: {
      material: { type: "string", description: "The member's raw material as they gave it (joined if several messages). Not a summary." },
      post: { type: "string", description: "The approved LinkedIn post, 120 to 200 words." },
      video_script: { type: "string", description: "The approved 30 to 45 second script, about 75 to 115 words." },
      line: { type: "string", description: "The approved one-sentence conversational line." },
    },
  },
  onSave: (o, profile) => {
    const material = str(o.material);
    if (words(material) < 20)
      throw new SaveError("The material is too thin to be real material. Ask the member what actually happened before drafting.");
    const post = str(o.post);
    const pw = words(post);
    if (pw < 100 || pw > 230) throw new SaveError(`The post is ${pw} words. Bring it to about 150 (120 to 200).`);
    const script = str(o.video_script);
    const sw = words(script);
    if (sw < 60 || sw > 130) throw new SaveError(`The script is ${sw} words. A 30 to 45 second script is about 75 to 115 words.`);
    const line = str(o.line).replace(/\s+/g, " ");
    if (!line) throw new SaveError("The conversational line is empty.");
    if (words(line) > 40) throw new SaveError("The conversational line is too long to say naturally. One sentence, under 40 words.");

    const now = new Date();
    const entry = { id: `rp-${now.getTime()}`, date: today(), material, post, video_script: script, line };
    const angle = str(profile.angle_statement);
    return {
      profile: { repurposed_pieces: [...pieces(profile), entry].slice(-50) },
      summary: `"${post.split(/\n/)[0].slice(0, 80)}"`,
      doc: {
        title: "Repurposed Content",
        eyebrow: "COURSE 11 · AI FOR FOUNDERS",
        purpose: "One real idea, turned into a post, a short video script and a line you can say.",
        blocks: [
          ...(angle ? [{ type: "kv" as const, items: [{ label: "Your angle", value: angle }] }] : []),
          { type: "heading", text: "LinkedIn post" },
          { type: "paragraph", text: post },
          { type: "heading", text: "30 to 45 second video script" },
          { type: "paragraph", text: script },
          { type: "big", label: "Say it on a call", value: line },
          { type: "heading", text: "The material it came from" },
          { type: "paragraph", text: material, tone: "muted" },
        ],
      },
    };
  },
};

export const course11Modes = [repurposingEngine];
