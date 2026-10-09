// Course 03 AI modes: Buyer-Interview Script Generator and Go/No-Go Scorecard.
//
// Member-record shapes owned here:
//   problem_statement: string
//   audience: string
//   script_versions: ScriptVersion[]  (append-only; every save adds one, nothing is replaced)
//     ScriptVersion = {
//       version: number;            // 1-based, computed server-side from the existing array length
//       created_at: string;         // ISO timestamp
//       problem_statement: string; audience: string;
//       interview_type: "warm" | "cold";
//       opener: string;
//       questions: { question: string; follow_up: string; listen_for: string }[];   // exactly 9
//       close: string;
//       context_notes: { painkiller_score: string; market_floor: string; personal_fit: string; price_objections: string };
//       changes: string;            // what was sharpened since the previous version
//     }
//   gonogo_score: number              // 4 to 20, summed server-side
//   gonogo_band: "Go" | "Pivot" | "No-Go"

import { asNumber, money } from "../profile";
import type { ModeDef, ProfileData } from "../types";
import { SaveError, str, obj, objArray, score } from "./util";

type DocBlock = ReturnType<ModeDef["onSave"]>["doc"]["blocks"][number];

const EYEBROW = "COURSE 03 · THE 90-DAY SIDE-HUSTLE TEST";

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

function scriptVersions(p: ProfileData): Record<string, unknown>[] {
  return Array.isArray(p.script_versions) ? objArray(p.script_versions) : [];
}

// ---------------------------------------------------------------------------
// Buyer-Interview Script Generator
// ---------------------------------------------------------------------------

// Phrasings that ask a buyer to predict the future instead of report the past.
const HYPOTHETICAL: RegExp[] = [
  /\bwould you (buy|pay|use|purchase|sign|consider|be willing|be interested|want|like|switch|try|hire|recommend)\b/i,
  /\bhow much would\b/i,
  /\bwould .{0,40}\b(pay|buy|purchase|spend)\b/i,
  /\bwill you\b/i,
  /\bwilling to\b/i,
  /\binterested in\b/i,
  /\bimagine\b/i,
  /\bif (you|we|i|there|someone) (could|had|were|was|built|offered|made|created|launched)\b/i,
  /\bwhat if\b/i,
  /\bin the future\b/i,
];

const CONTEXT_LABELS: Record<string, string> = {
  painkiller_score: "Painkiller score",
  market_floor: "Market floor",
  personal_fit: "Personal fit notes",
  price_objections: "Price objections heard",
};

export const interviewScriptGenerator: ModeDef = {
  assetId: "interview-script-generator",
  persistent: true,
  reads: ["problem_statement", "audience", "script_versions", "interview_signal_tally"],
  writes: ["problem_statement", "audience", "script_versions"],
  systemPrompt: `You run the Buyer-Interview Script Generator for Course 03. You build, and over later sessions re-sharpen, the script the member uses to interview potential buyers. Every save creates a new version; all earlier versions are kept.

INPUTS
- A problem statement that is solution-free: it describes the buyer's problem and its cost to them, and does not mention the member's product, service or idea. If the member's statement names a solution ("an app that...", "a coaching programme for..."), point that out and help them rewrite it as the problem alone.
- An audience description: who has the problem, specifically enough that the member could name ten of them.
- Whether these are warm interviews (referrals, people who know the member) or cold ones (LinkedIn, communities). The opener differs.
- Optional context the member adds in later sessions: painkiller score, market floor, personal fit notes, price objections heard. Use any that are present to sharpen the questions. Carry forward context from the latest saved version unless the member changes it.

VAGUENESS
If the problem statement is too vague to produce specific questions (no clear who, no concrete situation, no cost or consequence), tell the member directly: "This statement is too vague. The questions it produces will be generic and the answers will tell you nothing." Then ask one question to tighten it. Do not generate a script from a vague statement.

THE SCRIPT
1. Opener: about one minute spoken (roughly 120 to 160 words). Who the member is, why they are calling, that they are not selling anything, and permission to ask about the buyer's experience. Warm: reference the person who connected them. Cold: one line on why this person was chosen.
2. Exactly nine core questions. Every question asks about actual past behaviour or current and prior spend: the last time the problem happened, what it cost, what they tried, what they paid for, who else was involved, what they use now. Never ask about hypothetical willingness to buy or future intent: no "would you pay", "would you use", "how much would", "are you interested in", "imagine if". Each question gets a follow-up probe and a note on what to listen for.
3. Close: about two minutes spoken (roughly 250 to 320 words). Thank them, ask whether there is anything you should have asked, ask for two or three referrals to others with the same problem, and agree how to follow up.

When you regenerate, say in one or two lines what changed from the previous version and why.

Show the full draft script in the chat, ask the member to confirm or correct it, then call save_output.`,
  opener: (p) => {
    const ps = str(p.problem_statement);
    const aud = str(p.audience);
    const versions = scriptVersions(p);
    if (!ps) {
      return "Let's build your buyer-interview script. I need two things.\n\nFirst, your problem statement, written without your solution in it. Describe the problem your buyer has and what it costs them, and leave out what you plan to sell. For example: \"Owners of small dental practices lose four to six hours a week chasing unpaid insurance claims.\"\n\nSecond, your audience: who has this problem, specifically enough that you could name ten of them.\n\nStart with the problem statement. What is it?";
    }
    const lines = [`I have your problem statement: "${ps}"`];
    lines.push(aud ? `Audience: ${aud}.` : "I do not have your audience yet.");
    if (versions.length) {
      const last = versions[versions.length - 1];
      lines.push(
        `You have ${versions.length} saved script version${versions.length === 1 ? "" : "s"}. The latest is version ${versions.length}, for ${str(last.interview_type) === "cold" ? "cold" : "warm"} interviews.`,
      );
      lines.push(
        "To sharpen it, tell me what you have learned since: a painkiller score, your market floor, personal fit notes, or price objections you have heard. Or tell me if the statement itself needs to change.",
      );
    } else if (aud) {
      lines.push("Before I write the script: will these be warm interviews, through people who know you, or cold ones through LinkedIn or communities?");
    } else {
      lines.push("Who is your audience? Describe them specifically enough that you could name ten of them.");
    }
    return lines.join("\n\n");
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["problem_statement", "audience", "interview_type", "opener", "questions", "close", "context_notes", "changes"],
    properties: {
      problem_statement: { type: "string", description: "Solution-free problem statement, as confirmed by the member." },
      audience: { type: "string" },
      interview_type: { type: "string", enum: ["warm", "cold"] },
      opener: { type: "string", description: "About one minute spoken, roughly 120 to 160 words." },
      questions: {
        type: "array",
        description: "Exactly nine. Past behaviour and prior spend only. Never hypothetical willingness to buy.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "follow_up", "listen_for"],
          properties: {
            question: { type: "string" },
            follow_up: { type: "string", description: "One probe to dig into the answer." },
            listen_for: { type: "string", description: "What a strong signal sounds like here." },
          },
        },
      },
      close: { type: "string", description: "About two minutes spoken, roughly 250 to 320 words. Must ask for referrals." },
      context_notes: {
        type: "object",
        additionalProperties: false,
        description: "Context used for this version. Empty string where the member has not given it.",
        required: ["painkiller_score", "market_floor", "personal_fit", "price_objections"],
        properties: {
          painkiller_score: { type: "string" },
          market_floor: { type: "string" },
          personal_fit: { type: "string" },
          price_objections: { type: "string" },
        },
      },
      changes: { type: "string", description: "What changed from the previous version and why. 'First version' for version 1." },
    },
  },
  onSave: (o, profile) => {
    const ps = str(o.problem_statement);
    const aud = str(o.audience);
    if (!ps) throw new SaveError("problem_statement is empty. Ask the member for a solution-free problem statement.");
    if (wordCount(ps) < 8)
      throw new SaveError(
        "The problem statement is too vague to produce specific questions. Tell the member that directly and help them add who has the problem, the situation, and what it costs them.",
      );
    if (!aud) throw new SaveError("audience is empty. Ask the member who has this problem.");
    const type = str(o.interview_type);
    if (type !== "warm" && type !== "cold") throw new SaveError("interview_type must be warm or cold. Ask the member.");

    const opener = str(o.opener);
    const ow = wordCount(opener);
    if (ow < 60 || ow > 200) throw new SaveError(`The opener is ${ow} words. It must run about one minute spoken: 120 to 160 words.`);

    const questions = objArray(o.questions).map((q) => ({
      question: str(q.question),
      follow_up: str(q.follow_up),
      listen_for: str(q.listen_for),
    }));
    if (questions.length !== 9) throw new SaveError(`The script must have exactly nine core questions; it has ${questions.length}.`);
    questions.forEach((q, i) => {
      if (!q.question) throw new SaveError(`Question ${i + 1} is empty.`);
      const text = `${q.question} ${q.follow_up}`;
      const hit = HYPOTHETICAL.find((re) => re.test(text));
      if (hit)
        throw new SaveError(
          `Question ${i + 1} asks about hypothetical future behaviour ("${text.match(hit)?.[0]}"). Rewrite it to ask what the buyer actually did or spent in the past.`,
        );
    });

    const close = str(o.close);
    const cw = wordCount(close);
    if (cw < 150 || cw > 380) throw new SaveError(`The close is ${cw} words. It must run about two minutes spoken: 250 to 320 words.`);
    if (!/referr|introduc|who else|anyone else|connect me/i.test(close))
      throw new SaveError("The close must ask for referrals to others with the same problem.");

    const cn = obj(o.context_notes);
    const context_notes = {
      painkiller_score: str(cn.painkiller_score),
      market_floor: str(cn.market_floor),
      personal_fit: str(cn.personal_fit),
      price_objections: str(cn.price_objections),
    };

    const prior = scriptVersions(profile);
    const version = prior.length + 1;
    const created_at = new Date().toISOString();
    const entry = {
      version,
      created_at,
      problem_statement: ps,
      audience: aud,
      interview_type: type,
      opener,
      questions,
      close,
      context_notes,
      changes: str(o.changes) || (version === 1 ? "First version" : ""),
    };

    const contextItems = Object.entries(context_notes)
      .filter(([, v]) => v)
      .map(([k, v]) => ({ label: CONTEXT_LABELS[k], value: v }));

    const blocks: DocBlock[] = [
      {
        type: "kv",
        items: [
          { label: "Version", value: String(version) },
          { label: "Date", value: created_at.slice(0, 10) },
          { label: "Interview type", value: type === "warm" ? "Warm (referral or known contact)" : "Cold (LinkedIn or community)" },
          { label: "Audience", value: aud },
        ],
      },
      { type: "subheading", text: "Problem statement" },
      { type: "paragraph", text: ps, tone: "accent" },
      { type: "heading", text: "Opener (about one minute)" },
      { type: "paragraph", text: opener },
      { type: "heading", text: "Nine core questions" },
      {
        type: "paragraph",
        tone: "muted",
        text: "Ask about what they have done and spent, not what they might do. Let silences run.",
      },
      {
        type: "table",
        table: {
          headers: ["#", "Question", "Follow-up", "Listen for"],
          widths: [0.3, 2.4, 1.8, 1.6],
          rows: questions.map((q, i) => [String(i + 1), q.question, q.follow_up, q.listen_for]),
        },
      },
      { type: "heading", text: "Close (about two minutes)" },
      { type: "paragraph", text: close },
    ];
    if (contextItems.length) {
      blocks.push({ type: "subheading", text: "Context used in this version" }, { type: "kv", items: contextItems });
    }
    if (version > 1 && entry.changes) {
      blocks.push({ type: "subheading", text: `What changed from version ${version - 1}` }, { type: "paragraph", text: entry.changes });
    }

    return {
      profile: { problem_statement: ps, audience: aud, script_versions: [...prior, entry] },
      summary: `Interview script version ${version} (${type})`,
      doc: {
        title: "Buyer-Interview Script",
        eyebrow: EYEBROW,
        purpose: `Version ${version}: an opener, nine past-behaviour questions and a referral close for your buyer interviews.`,
        blocks,
        meta: { version, completedAt: created_at },
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Go/No-Go Scorecard + AI Scorer
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { key: "demand", label: "Demand" },
  { key: "margin", label: "Margin" },
  { key: "personal_fit", label: "Personal fit" },
  { key: "market_size", label: "Market size" },
] as const;

type Strength = "solid" | "thin" | "missing";

const categorySchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "rationale", "evidence", "evidence_strength"],
  properties: {
    score: { type: "integer", description: "1 to 5. Thin evidence scores 3 at most; missing evidence scores 1." },
    rationale: { type: "string", description: "Two to four sentences citing the specific evidence used, with the numbers." },
    evidence: { type: "array", items: { type: "string" }, description: "Each specific piece of evidence used, as stated or recorded." },
    evidence_strength: { type: "string", enum: ["solid", "thin", "missing"] },
  },
};

const nullableNumber = { type: ["number", "null"] };

function band(total: number): "Go" | "Pivot" | "No-Go" {
  if (total >= 16) return "Go";
  if (total >= 10) return "Pivot";
  return "No-Go";
}

const pct = (n: number | null) => (n === null ? "" : `${Math.round(n * 10) / 10}%`);

export const goNoGo: ModeDef = {
  assetId: "go-no-go",
  reads: ["problem_statement", "interview_signal_tally", "smoke_test_metrics", "script_versions"],
  writes: ["gonogo_score", "gonogo_band"],
  memberEntry: {
    key: "smoke_test_metrics",
    label: "Your smoke-test numbers",
    fields: [
      { key: "visitors", label: "Visitors", type: "number", width: "half" },
      { key: "signups", label: "Sign-ups", type: "number", width: "half" },
      { key: "payments", label: "Payments", type: "number", width: "half" },
      { key: "price", label: "Price charged ($)", type: "money", width: "half" },
    ],
  },
  systemPrompt: `You run the Go/No-Go Scorecard for Course 03. You score the member's idea on evidence, not enthusiasm, across four categories, each 1 to 5:

1. Demand: the interview tally (strong signals against the target of ten, seven being the threshold; prior spend mentioned) plus smoke-test payments. Payments outweigh sign-ups; sign-ups outweigh compliments.
2. Margin: price minus realistic costs per sale, including the member's own time at an hourly value they state. Ask for cost per sale, hours per sale and what their hour is worth if they are not in the record.
3. Personal fit: whether the member can and wants to deliver this for years: skills, energy, hours available, how it sits with their life. Use any personal fit notes in their saved interview scripts, then ask.
4. Market size: their market floor (the number of reachable buyers they can actually name or reach) run through their actual conversion rate from the smoke test. Ask for the floor if it is not in the record.

The interview tally and smoke-test numbers are in the member record when they exist. Smoke-test numbers are entered by the member in the boxes above this chat; if they are missing, ask the member to fill them in there. Ask for everything else one item at a time. Never fill a gap with an assumption.

Scoring rules:
- Each rationale cites the specific evidence used, with the numbers ("6 of 10 strong, 4 mentioned prior spend, 3 payments from 212 visitors").
- Mark evidence_strength honestly. "thin": a small sample, a single data point, or the member's belief without data. "missing": nothing to go on. Thin evidence scores 3 at most and missing evidence scores 1. Do not score generously to be encouraging.
- The system adds the total and sets the band: 16 to 20 Go, 10 to 15 Pivot, below 10 No-Go. For a Pivot, name the one specific variable in the weakest category the member should change (for example "raise the price from $300 to $750", not "improve margin").
- Put each figure you used into the figures object. Use null for anything the member did not give.

Walk the member through your scores category by category, then confirm before calling save_output.`,
  opener: (p) => {
    const ps = str(p.problem_statement);
    const t = obj(p.interview_signal_tally);
    const s = obj(p.smoke_test_metrics);
    const lines: string[] = ["Let's score your idea on the evidence you have. Four categories, each 1 to 5: demand, margin, personal fit and market size."];
    lines.push(ps ? `I have your problem statement: "${ps}"` : "I do not have a problem statement on record. Tell me in a sentence what problem this idea solves and for whom.");
    if (Object.keys(t).length) {
      lines.push(
        `Your interview tally: ${asNumber(t.strong) ?? 0} strong signals against a target of 10 (seven is the threshold), ${asNumber(t.completed) ?? 0} calls completed, prior spend mentioned ${asNumber(t.prior_spend) ?? 0} times.`,
      );
    } else {
      lines.push("I do not see an interview tally yet. Fill in the Interview Notes & Signal Tracker first, or demand will be scored on missing evidence.");
    }
    const v = asNumber(s.visitors);
    const su = asNumber(s.signups);
    const pay = asNumber(s.payments);
    const price = asNumber(s.price);
    if (v !== null || pay !== null) {
      lines.push(
        `Your smoke test: ${v ?? "?"} visitors, ${su ?? "?"} sign-ups, ${pay ?? "?"} payments${price !== null ? ` at ${money(price)}` : ""}.`,
      );
    } else {
      lines.push("Your smoke-test numbers are not in yet. Enter visitors, sign-ups, payments and price in the boxes above.");
    }
    lines.push("To score margin I need your realistic costs. What does it cost you to deliver one sale, not counting your own time?");
    return lines.join("\n\n");
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["demand", "margin", "personal_fit", "market_size", "figures", "pivot_variable", "summary"],
    properties: {
      demand: categorySchema,
      margin: categorySchema,
      personal_fit: categorySchema,
      market_size: categorySchema,
      figures: {
        type: "object",
        additionalProperties: false,
        description: "Numbers the member gave or the record holds. null when not given.",
        required: ["price", "cost_per_sale", "hours_per_sale", "hourly_value", "market_floor", "conversion_rate_pct"],
        properties: {
          price: nullableNumber,
          cost_per_sale: nullableNumber,
          hours_per_sale: nullableNumber,
          hourly_value: nullableNumber,
          market_floor: nullableNumber,
          conversion_rate_pct: { type: ["number", "null"], description: "Only if the member states one different from the smoke test." },
        },
      },
      pivot_variable: { type: "string", description: "For a Pivot: the one specific variable to change in the weakest category. Empty otherwise." },
      summary: { type: "string", description: "Two or three plain sentences on what the evidence says." },
    },
  },
  onSave: (o, profile) => {
    const tallyRec = obj(profile.interview_signal_tally);
    const smoke = obj(profile.smoke_test_metrics);
    const hasTally = Object.keys(tallyRec).length > 0;
    const payments = asNumber(smoke.payments);
    const visitors = asNumber(smoke.visitors);

    const cats = CATEGORIES.map(({ key, label }) => {
      const c = obj(o[key]);
      const s = score(c.score, 1, 5, `${key}.score`);
      const strength = str(c.evidence_strength) as Strength;
      if (!["solid", "thin", "missing"].includes(strength)) throw new SaveError(`${key}.evidence_strength must be solid, thin or missing.`);
      const rationale = str(c.rationale);
      if (!rationale) throw new SaveError(`${key}.rationale is empty. Cite the specific evidence used.`);
      const evidence = Array.isArray(c.evidence) ? (c.evidence as unknown[]).map(str).filter(Boolean) : [];
      if (strength !== "missing" && !evidence.length) throw new SaveError(`${key} has no evidence listed. List the evidence or mark it missing.`);
      if (strength === "missing" && s > 1) throw new SaveError(`${label} has missing evidence, so it scores 1. Do not score it generously.`);
      if (strength === "thin" && s > 3) throw new SaveError(`${label} has thin evidence, so it scores 3 at most.`);
      return { key, label, score: s, strength, rationale, evidence };
    });

    const demand = cats[0];
    if (!hasTally && (payments === null || payments === 0) && demand.strength === "solid")
      throw new SaveError("Demand is marked solid but there is no interview tally and no smoke-test payments on record. Mark it thin or missing.");

    const total = cats.reduce((sum, c) => sum + c.score, 0);
    const result = band(total);
    const minScore = Math.min(...cats.map((c) => c.score));
    const weakest = cats.filter((c) => c.score === minScore);
    const pivotVar = str(o.pivot_variable);
    if (result === "Pivot" && !pivotVar)
      throw new SaveError(
        `The total is ${total}, a Pivot. Name the one specific variable to change in the weakest categor${weakest.length > 1 ? "ies" : "y"} (${weakest.map((c) => c.label).join(", ")}).`,
      );

    // Server-side figures.
    const f = obj(o.figures);
    const price = asNumber(f.price) ?? asNumber(smoke.price);
    const cost = asNumber(f.cost_per_sale);
    const hours = asNumber(f.hours_per_sale);
    const hourly = asNumber(f.hourly_value);
    const floor = asNumber(f.market_floor);
    const smokeRate = visitors && payments !== null ? (payments / visitors) * 100 : null;
    const rate = asNumber(f.conversion_rate_pct) ?? smokeRate;
    const margin = price !== null && cost !== null && hours !== null && hourly !== null ? price - cost - hours * hourly : null;
    const marginPct = margin !== null && price ? (margin / price) * 100 : null;
    const buyersAtFloor = floor !== null && rate !== null ? Math.floor((floor * rate) / 100) : null;

    const figureItems: { label: string; value: string }[] = [];
    if (hasTally)
      figureItems.push({
        label: "Interview tally",
        value: `${asNumber(tallyRec.strong) ?? 0} strong of target 10 (threshold 7), ${asNumber(tallyRec.prior_spend) ?? 0} prior spend`,
      });
    if (visitors !== null || payments !== null)
      figureItems.push({
        label: "Smoke test",
        value: `${visitors ?? "?"} visitors, ${asNumber(smoke.signups) ?? "?"} sign-ups, ${payments ?? "?"} payments`,
      });
    if (price !== null) figureItems.push({ label: "Price", value: money(price) });
    if (margin !== null)
      figureItems.push({
        label: "Margin per sale (after your time)",
        value: `${money(margin)}${marginPct !== null ? ` (${pct(marginPct)})` : ""}`,
      });
    if (rate !== null) figureItems.push({ label: "Conversion rate", value: pct(rate) });
    if (buyersAtFloor !== null) figureItems.push({ label: "Buyers at your market floor", value: `${buyersAtFloor} of ${floor}` });

    const flagged = cats.filter((c) => c.strength !== "solid");
    const flagText = (s: Strength) => (s === "solid" ? "Solid" : s === "thin" ? "Thin evidence" : "Missing evidence");

    const blocks: DocBlock[] = [
      {
        type: "big",
        label: "Total",
        value: `${total} / 20 · ${result}`,
        note: "16 to 20 Go · 10 to 15 Pivot · below 10 No-Go",
      },
      {
        type: "table",
        table: {
          headers: ["Category", "Score", "Evidence", "Rationale"],
          widths: [0.9, 0.5, 0.8, 3.6],
          rows: cats.map((c) => [c.label, `${c.score} / 5`, flagText(c.strength), c.rationale]),
          totalRow: ["Total", `${total} / 20`, "", result],
        },
      },
    ];
    if (flagged.length) {
      blocks.push({
        type: "callout",
        tone: "warning",
        title: "Evidence to strengthen",
        text: flagged
          .map((c) => `${c.label}: ${c.strength === "thin" ? "thin evidence, scored cautiously" : "missing evidence, scored 1"}.`)
          .join(" "),
      });
    }
    if (result === "Pivot") {
      blocks.push({
        type: "callout",
        tone: "note",
        title: `Weakest: ${weakest.map((c) => c.label).join(", ")}`,
        text: `The one variable to change: ${pivotVar}`,
      });
    }
    if (figureItems.length) blocks.push({ type: "subheading", text: "Numbers used" }, { type: "kv", items: figureItems });
    blocks.push({ type: "paragraph", text: str(o.summary) });

    return {
      profile: { gonogo_score: total, gonogo_band: result },
      summary: `Go/No-Go ${total}/20 · ${result}`,
      doc: {
        title: "Go/No-Go Scorecard",
        eyebrow: EYEBROW,
        purpose: "Your idea scored on evidence across demand, margin, personal fit and market size.",
        dense: true,
        blocks,
      },
    };
  },
};

export const course03Modes = [interviewScriptGenerator, goNoGo];
