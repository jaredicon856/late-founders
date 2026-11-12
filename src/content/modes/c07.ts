import type { ModeDef, ProfileData } from "../types";
import { SaveError, obj, str } from "./util";

// Member record written here:
//   linkedin_audit: { date; total; lowest: string; sections: { section; provided; score; issue; rewrite }[] }

type DocBlock = ReturnType<ModeDef["onSave"]>["doc"]["blocks"][number];

export const SECTIONS = [
  ["headline", "Headline"],
  ["banner", "Banner"],
  ["about", "About"],
  ["experience", "Experience"],
  ["featured", "Featured"],
  ["skills", "Skills"],
  ["activity", "Recent activity"],
  ["recommendations", "Recommendations"],
] as const;
type Key = (typeof SECTIONS)[number][0];

const sectionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["provided", "score", "issue", "rewrite"],
  properties: {
    provided: { type: "boolean", description: "False if the member has nothing in this section yet." },
    score: { type: "integer", description: "1 to 10, where 10 is excellent. 1 if not provided." },
    issue: { type: "string", description: "The main problem, in one plain sentence." },
    rewrite: { type: "string", description: "Your rewrite, approved by the member. For About, leave empty: the five parts are assembled." },
  },
};

const prior = (p: ProfileData) => obj(p.linkedin_audit);

export const profileAudit: ModeDef = {
  assetId: "profile-audit",
  reads: ["linkedin_audit", "angle_statement", "founder_type", "offer_record", "interview_signal_tally"],
  writes: ["linkedin_audit"],
  systemPrompt: `You run the Profile-Audit AI for Course 07, LinkedIn Authority. The member pastes their LinkedIn profile section by section; you score each and rewrite it.

Sections, in this order: Headline, Banner (they describe what it shows and says), About, Experience, Featured, Skills, Recent activity (what they posted or commented on lately), Recommendations. Ask for one section at a time. If they have nothing in a section, note it as not provided and move on.

Score each section 1 to 10 against these standards, then rewrite it:
- Headline: who you help + the specific outcome + a credibility marker. Example shape: "Helping owners of 20-person trades firms step out of the day-to-day | 30 years running crews". A job title alone ("VP Operations at X") scores 3 or less, and your rewrite must never return a job title.
- About: five parts, in order. (1) Open on the reader's problem, not your biography. (2) A short credibility bridge: why you understand it. (3) Who you help and the mechanism: how you help. (4) Proof: a result, with a number if the member has one. (5) A plain closing line: what to do next. You fill these five parts separately in save_output; the system assembles them.
- Experience: outcomes with numbers, never duties. "Responsible for logistics" becomes "Cut delivery errors 38% across three warehouses". Use only numbers the member gives you; ask for them. If they truly have none, use [number] as a placeholder for them to fill, never an invented figure.
- Banner: says what they do and for whom at a glance.
- Featured, Skills, Recent activity, Recommendations: whether each supports the headline's promise.

For the About section's opening (the reader's problem) and the headline's outcome, use the buyer's own words from the member's Course 03 interview quotes (interview_signal_tally.quotes) when they exist: offer one or two that fit and ask which sounds right. Also score the About section on each of its five parts (1 to 10 each, shown as you go), so the member sees which part is weak, not only the total.

Use only facts the member gives. If their record has an angle statement or an offer, keep the rewrites consistent with them. Show each score and rewrite as you go, and let the member push back. When all eight are done, the system flags the lowest-scoring section as the priority fix; tell them which it is and why. Confirm, then call save_output.`,
  opener: (p) => {
    const a = prior(p);
    const lines = [
      "Let's audit your LinkedIn profile. Paste it in one section at a time: headline, banner, About, Experience, Featured, Skills, recent activity and recommendations. I will score each from 1 to 10 and rewrite it, then flag the one to fix first.",
    ];
    if (str(a.date)) lines.push(`Your last audit (${str(a.date)}) scored ${a.total}/80, with ${str(a.lowest)} as the priority fix. This run is saved as a new version so you can compare.`);
    const angle = str(p.angle_statement);
    if (angle) lines.push(`I will keep the rewrites consistent with your angle: "${angle}"`);
    const quotes = Array.isArray(obj(p.interview_signal_tally).quotes) ? (obj(p.interview_signal_tally).quotes as unknown[]).filter((q) => typeof q === "string" && q.trim()) : [];
    if (quotes.length) lines.push(`I also have ${quotes.length} buyer quote${quotes.length === 1 ? "" : "s"} from your Course 03 interviews. Their words make the strongest About opening, so I will draw on them.`);
    lines.push("Start with your headline. Paste it exactly as it reads now.");
    return lines.join("\n\n");
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["headline_parts", "about_parts", "sections"],
    properties: {
      headline_parts: {
        type: "object",
        additionalProperties: false,
        required: ["who", "outcome", "credibility"],
        properties: {
          who: { type: "string", description: "Who the member helps." },
          outcome: { type: "string", description: "The specific outcome." },
          credibility: { type: "string", description: "The credibility marker." },
        },
      },
      about_parts: {
        type: "object",
        additionalProperties: false,
        required: ["problem", "credibility_bridge", "who_and_mechanism", "proof", "closing"],
        properties: {
          problem: { type: "string" },
          credibility_bridge: { type: "string" },
          who_and_mechanism: { type: "string" },
          proof: { type: "string" },
          closing: { type: "string" },
        },
      },
      sections: {
        type: "object",
        additionalProperties: false,
        required: SECTIONS.map(([k]) => k),
        properties: Object.fromEntries(SECTIONS.map(([k]) => [k, sectionSchema])),
      },
    },
  },
  onSave: (o) => {
    const h = obj(o.headline_parts);
    const who = str(h.who);
    const outcome = str(h.outcome);
    const cred = str(h.credibility);
    if (!who || !outcome || !cred)
      throw new SaveError("The headline needs all three parts: who they help, the specific outcome and a credibility marker.");
    const ab = obj(o.about_parts);
    const about = ["problem", "credibility_bridge", "who_and_mechanism", "proof", "closing"].map((k) => str(ab[k]));
    if (about.some((x) => !x)) throw new SaveError("The About rewrite needs all five parts: problem, credibility bridge, who and mechanism, proof, closing.");

    const s = obj(o.sections);
    const sections = SECTIONS.map(([key, label]) => {
      const x = obj(s[key]);
      const provided = x.provided === true;
      const score = typeof x.score === "number" ? Math.round(x.score) : NaN;
      if (!(score >= 1 && score <= 10)) throw new SaveError(`${label} needs a whole-number score from 1 to 10.`);
      const rewrite = key === "about" ? about.join("\n\n") : str(x.rewrite);
      if (!rewrite) throw new SaveError(`${label} needs a rewrite.`);
      return { section: label, key: key as Key, provided, score: provided ? score : 1, issue: str(x.issue), rewrite };
    });
    const headline = sections[0];
    const lower = headline.rewrite.toLowerCase();
    if (!lower.includes(who.toLowerCase().split(/\s+/).slice(-1)[0]) && !/\bhelp/.test(lower))
      throw new SaveError("The headline rewrite must say who the member helps. A job title is not a headline.");
    const experience = sections.find((x) => x.key === "experience")!;
    if (experience.provided && !/\d|\[number\]/.test(experience.rewrite))
      throw new SaveError("Experience rewrites need outcomes with numbers. Ask the member for figures, or use [number] where they must fill one in.");

    const scored = sections.filter((x) => x.provided);
    const pool = scored.length ? scored : sections;
    const lowest = pool.reduce((a, b) => (b.score < a.score ? b : a));
    const total = sections.reduce((t, x) => t + x.score, 0);
    const date = new Date().toISOString().slice(0, 10);

    const blocks: DocBlock[] = [
      { type: "big", label: "Fix this first", value: lowest.section, note: lowest.issue },
      {
        type: "table",
        table: {
          headers: ["Section", "Score", "Main issue"],
          widths: [0.9, 0.5, 3],
          rows: sections.map((x) => [x.section, x.provided ? `${x.score}/10` : "Missing", x.issue]),
          totalRow: ["Total", `${total}/80`, ""],
        },
      },
    ];
    for (const x of sections) blocks.push({ type: "heading", text: `${x.section}: rewrite` }, { type: "paragraph", text: x.rewrite });

    return {
      profile: {
        linkedin_audit: { date, total, lowest: lowest.section, sections: sections.map((x) => ({ section: x.section, provided: x.provided, score: x.score, issue: x.issue, rewrite: x.rewrite })) },
      },
      summary: `${total}/80 · fix ${lowest.section} first`,
      doc: {
        title: "LinkedIn Profile Audit",
        eyebrow: "COURSE 07 · LINKEDIN AUTHORITY",
        purpose: "Every section scored and rewritten, with the one to fix first.",
        blocks,
      },
    };
  },
};

export const course07Modes = [profileAudit];
