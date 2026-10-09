import { asNumber, money } from "../profile";
import type { ModeDef, ProfileData } from "../types";
import { SaveError, str, strArray, obj, objArray } from "./util";

// Member record shapes written here:
//
// entity_recommendation: {
//   structure: "LLC" | "S-Corp election" | "C-Corp" | "Nonprofit";
//   reasoning: string;
//   ruled_out: { option: string; reason: string }[];   // the other three options
//   inputs: { projected_annual_revenue: number; risk_exposure: "low"|"moderate"|"high"; risk_detail: string;
//             outside_investment: "yes"|"no"|"undecided"; jurisdiction: string };
//   triggers: { cofounder_or_investor: { met: boolean; reason: string };
//               close_call: { met: boolean; reason: string };
//               trademark_conflict: { met: boolean; reason: string } };
//   see_professional: boolean;   // set server-side: true when any trigger is met
//   date: string;                // yyyy-mm-dd
// }
//
// brand_sheet: {
//   business_name: string; category: string; audience: string; existing_assets: string;
//   logo: { minimum_size: string; clear_space: string; notes: string[] };
//   colours: { primary: { hex: string; use: string }[]; secondary: { hex: string; use: string }[] };
//   typefaces: { family: string; role: "headline" | "body" | "headline and body"; licence: string; fallback: string }[];
//   voice: { descriptor: string; do: string; dont: string }[];   // 3 to 5
//   date: string;
// }
// business_name: string

type DocBlock = ReturnType<ModeDef["onSave"]>["doc"]["blocks"][number];

const EYEBROW = "COURSE 04 · NAME, BRAND & LEGAL BASICS";
const today = () => new Date().toISOString().slice(0, 10);
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// ---------------------------------------------------------------------------
// Entity-Decision AI
// ---------------------------------------------------------------------------

const STRUCTURES = ["LLC", "S-Corp election", "C-Corp", "Nonprofit"] as const;

const ENTITY_DISCLAIMER =
  "General guidance only, not legal or accounting advice for your situation. Confirm your structure with an accountant or business attorney in your state before you file.";

const trigger = {
  type: "object",
  additionalProperties: false,
  required: ["met", "reason"],
  properties: {
    met: { type: "boolean" },
    reason: { type: "string", description: "One plain sentence on why this trigger is or is not met, from what the member said." },
  },
};

export const entityDecision: ModeDef = {
  assetId: "entity-decision",
  reads: ["business_name", "name_candidates", "sweep_results"],
  writes: ["entity_recommendation"],
  disclaimer: ENTITY_DISCLAIMER,
  systemPrompt: `You are the Entity-Decision AI. You help a member pick a business structure: LLC, S-Corp election, C-Corp or Nonprofit.

You need four inputs from the member. Ask for each one that is missing, one at a time. Never assume or estimate any of them:
1. Projected annual revenue for the next twelve months, as a dollar figure. If they also know expected profit, take it; it matters for the S-Corp question.
2. Risk exposure: what could go wrong that someone might sue over (physical work, advice clients rely on, products, employees, client data). Classify as low, moderate or high and keep their own description.
3. Whether they plan to raise outside investment: yes, no or undecided.
4. Jurisdiction: the state (and country) they will form and operate in.

Also ask, before recommending: whether anyone else will own part of the business (a co-founder, partner or investor), and whether any trademark conflict on their name is still unresolved. The member record may hold availability sweep results; if they show trademark hits, ask whether the member has resolved them rather than deciding for them.

How to reason (plain language, no jargon without a one-line explanation):
- LLC: the default for most solo service businesses. Liability protection, simple, pass-through tax.
- S-Corp election: a tax election (usually made by an LLC) that can cut self-employment tax once profit reliably exceeds a reasonable salary for the owner. It adds payroll and bookkeeping cost, so it rarely pays at low profit.
- C-Corp: fits when they plan to raise venture-style investment, issue stock options or sell to an acquirer that expects stock. Double taxation on profits paid out.
- Nonprofit: only when the purpose is charitable or educational and nobody intends to own or profit from it.
- If the jurisdiction is outside the United States, say plainly that these four are US structures, recommend the closest fit, and say the local equivalent must be confirmed.

Recommend exactly one. Give the reasoning for the pick and a specific reason for ruling out each of the other three, tied to the member's own inputs.

Report three "see a professional" triggers, each true or false with a reason:
- cofounder_or_investor: a co-founder, partner or investor is involved or planned.
- close_call: two options are genuinely close and real money rides on the choice (for example, an S-Corp election near the break-even point, or a C-Corp versus LLC choice with investment undecided).
- trademark_conflict: an unresolved trademark conflict exists on the name they will use.
Do not decide the overall flag; the system raises it if any trigger is true.

Before saving, summarise the four inputs and your recommendation and ask the member to confirm.`,
  opener: (p: ProfileData) => {
    const lines = ["This tool recommends a business structure: LLC, S-Corp election, C-Corp or Nonprofit, with the reasons for and against each."];
    const name = text(p.business_name);
    if (name) lines.push(`I have your business name: ${name}.`);
    if (p.sweep_results) lines.push("I can also see your availability sweep results, so I will ask whether any trademark hit is still open.");
    lines.push(
      "I need four things from you: projected revenue, your risk exposure, whether you plan to raise outside investment, and where you will form the business.",
      "What revenue do you expect the business to bring in over the next twelve months? A dollar figure, even a rough one you are willing to stand behind.",
    );
    return lines.join("\n\n");
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["inputs", "recommendation", "reasoning", "ruled_out", "triggers", "next_steps"],
    properties: {
      inputs: {
        type: "object",
        additionalProperties: false,
        required: ["projected_annual_revenue", "risk_exposure", "risk_detail", "outside_investment", "jurisdiction"],
        properties: {
          projected_annual_revenue: { type: "number", description: "Dollar figure the member stated." },
          risk_exposure: { type: "string", enum: ["low", "moderate", "high"] },
          risk_detail: { type: "string", description: "The member's description of what could go wrong." },
          outside_investment: { type: "string", enum: ["yes", "no", "undecided"] },
          jurisdiction: { type: "string" },
        },
      },
      recommendation: { type: "string", enum: [...STRUCTURES] },
      reasoning: { type: "string", description: "Plain-language reasons for the pick, tied to the member's inputs." },
      ruled_out: {
        type: "array",
        description: "Each of the other three options, once, with why it was ruled out.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["option", "reason"],
          properties: {
            option: { type: "string", enum: [...STRUCTURES] },
            reason: { type: "string" },
          },
        },
      },
      triggers: {
        type: "object",
        additionalProperties: false,
        required: ["cofounder_or_investor", "close_call", "trademark_conflict"],
        properties: { cofounder_or_investor: trigger, close_call: trigger, trademark_conflict: trigger },
      },
      next_steps: { type: "array", items: { type: "string" }, description: "Two to four concrete next actions." },
    },
  },
  onSave: (o) => {
    const inp = obj(o.inputs);
    const revenue = asNumber(inp.projected_annual_revenue);
    if (revenue === null || revenue < 0) throw new SaveError("projected_annual_revenue is missing. Ask the member for their projected annual revenue.");
    const risk = str(inp.risk_exposure);
    if (!["low", "moderate", "high"].includes(risk)) throw new SaveError("risk_exposure must be low, moderate or high.");
    const investment = str(inp.outside_investment);
    if (!["yes", "no", "undecided"].includes(investment)) throw new SaveError("outside_investment must be yes, no or undecided. Ask the member.");
    const jurisdiction = str(inp.jurisdiction);
    if (!jurisdiction) throw new SaveError("jurisdiction is empty. Ask the member where they will form the business.");

    const structure = str(o.recommendation);
    if (!(STRUCTURES as readonly string[]).includes(structure)) throw new SaveError(`recommendation must be one of: ${STRUCTURES.join(", ")}.`);
    const reasoning = str(o.reasoning);
    if (!reasoning) throw new SaveError("reasoning is empty. Explain the recommendation in plain language.");

    const ruledOut = objArray(o.ruled_out).map((r) => ({ option: str(r.option), reason: str(r.reason) }));
    const expected = STRUCTURES.filter((s) => s !== structure);
    const missing = expected.filter((s) => !ruledOut.some((r) => r.option === s && r.reason));
    if (missing.length || ruledOut.length !== 3)
      throw new SaveError(`ruled_out must cover each of ${expected.join(", ")} exactly once with a reason. Missing or empty: ${missing.join(", ") || "duplicates present"}.`);

    const t = obj(o.triggers);
    const readTrigger = (k: string) => {
      const v = obj(t[k]);
      if (typeof v.met !== "boolean" || !str(v.reason)) throw new SaveError(`triggers.${k} needs met (true/false) and a reason.`);
      return { met: v.met, reason: str(v.reason) };
    };
    const triggers = {
      cofounder_or_investor: readTrigger("cofounder_or_investor"),
      close_call: readTrigger("close_call"),
      trademark_conflict: readTrigger("trademark_conflict"),
    };
    const seePro = Object.values(triggers).some((x) => x.met);
    const steps = strArray(o.next_steps);

    const record = {
      structure,
      reasoning,
      ruled_out: expected.map((s) => ruledOut.find((r) => r.option === s)!),
      inputs: { projected_annual_revenue: revenue, risk_exposure: risk, risk_detail: str(inp.risk_detail), outside_investment: investment, jurisdiction },
      triggers,
      see_professional: seePro,
      date: today(),
    };

    const triggerLabels: Record<string, string> = {
      cofounder_or_investor: "Co-founder or investor involved",
      close_call: "Close call with real money at stake",
      trademark_conflict: "Unresolved trademark conflict",
    };

    const blocks: DocBlock[] = [
      {
        type: "kv",
        items: [
          { label: "Projected annual revenue", value: money(revenue) },
          { label: "Risk exposure", value: `${risk[0].toUpperCase()}${risk.slice(1)}${record.inputs.risk_detail ? `: ${record.inputs.risk_detail}` : ""}` },
          { label: "Outside investment planned", value: investment[0].toUpperCase() + investment.slice(1) },
          { label: "Jurisdiction", value: jurisdiction },
        ],
      },
      { type: "big", label: "Recommended structure", value: structure },
      { type: "callout", tone: "legal", title: "General guidance", text: ENTITY_DISCLAIMER },
      { type: "heading", text: "Why this one" },
      { type: "paragraph", text: reasoning },
      { type: "heading", text: "Why not the others" },
      { type: "table", table: { headers: ["Option", "Why it was ruled out"], widths: [1, 3.4], rows: record.ruled_out.map((r) => [r.option, r.reason]) } },
      { type: "heading", text: "See a professional?" },
      seePro
        ? {
            type: "callout",
            tone: "warning",
            title: "Yes, before you file",
            text: "At least one situation below needs an accountant or business attorney to look at your specifics before you commit to a structure.",
          }
        : { type: "paragraph", text: "None of the three triggers applies right now. If any of them changes, run this again.", tone: "muted" },
      {
        type: "table",
        table: {
          headers: ["Trigger", "Applies", "Why"],
          widths: [1.4, 0.5, 2.6],
          rows: Object.entries(triggers).map(([k, v]) => [triggerLabels[k], v.met ? "Yes" : "No", v.reason]),
        },
      },
    ];
    if (steps.length) blocks.push({ type: "heading", text: "Next steps" }, { type: "bullets", items: steps, style: "checkbox" });

    return {
      profile: { entity_recommendation: record },
      summary: `${structure}${seePro ? " · see a professional before filing" : ""}`,
      doc: {
        title: "Entity Recommendation",
        eyebrow: EYEBROW,
        purpose: "One recommended business structure, why it fits, why the others do not, and whether to see a professional.",
        blocks,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Brand-Sheet Generator
// ---------------------------------------------------------------------------

const HEX = /^#[0-9A-Fa-f]{6}$/;
const LICENCES = ["SIL Open Font License", "Apache License 2.0"] as const;

const colour = {
  type: "object",
  additionalProperties: false,
  required: ["hex", "use"],
  properties: {
    hex: { type: "string", description: "Six-digit hex code, e.g. #1F3A5F. Never a colour name." },
    use: { type: "string", description: "Where it is used: backgrounds, headings, buttons, accents." },
  },
};

export const brandSheetGenerator: ModeDef = {
  assetId: "brand-sheet-generator",
  reads: ["business_name", "name_candidates", "audience", "problem_statement", "sweep_results"],
  writes: ["brand_sheet", "business_name"],
  systemPrompt: `You are the Brand-Sheet Generator. You build a one-page brand sheet the member can hand to a freelance designer or writer.

Inputs. Use what is in the member record and ask only for what is missing, one at a time:
- Chosen business name. If the record holds name candidates but no chosen name, ask which one they chose.
- Business category (what they sell, in a phrase).
- Audience (who buys).
- Existing assets: any logo, colours, fonts, photos or copy they already have and want to keep. "None" is a valid answer.
Then ask one or two questions about the feel they want (three adjectives a client would use about them, and a brand they admire outside their field).

The sheet carries the MEMBER's brand, not Late Founders'. Never use Late Founders colours (#0B0B0D, #73FED2, #E8FF74), Montserrat as a default, or Late Founders wording in the sheet. Write the content in a neutral, practical tone a freelancer can follow.

The sheet must contain:
1. Logo usage notes: a minimum size (in px for screen and mm or inches for print), clear space (stated as a multiple of a logo element, e.g. the height of the first letter), and three to five do or don't notes. If they have no logo yet, write these as the brief for the designer.
2. Colours as six-digit hex codes only, never colour names: one or two primary colours and one to three secondary colours, each with where it is used. Check that body text colour on the background has strong contrast. Keep any existing colours the member wants.
3. One or two typefaces from widely licensable families (free under the SIL Open Font License or Apache License, for example from Google Fonts), each assigned to headline, body, or both, with a common system fallback.
4. Voice: three to five specific descriptors (not "professional" or "friendly" alone), each with one example sentence to write and one to avoid, written for this member's audience.

Show the member a draft of the whole sheet, take their edits, and save only once they approve it.`,
  opener: (p: ProfileData) => {
    const lines = ["This builds a one-page brand sheet for your business: logo rules, colours as hex codes, typefaces and voice. It is yours to hand to any designer or writer."];
    const name = text(p.business_name);
    const candidates = Array.isArray(p.name_candidates) ? (p.name_candidates as unknown[]).map(text).filter(Boolean) : [];
    const audience = text(p.audience);
    if (name) lines.push(`I have your business name: ${name}.`);
    else if (candidates.length) lines.push(`I have your name candidates: ${candidates.join(", ")}.`);
    if (audience) lines.push(`I have your audience: ${audience}.`);
    if (!name && candidates.length) lines.push("Which of those names did you choose?");
    else if (!name) lines.push("What is the name of your business? If you are still choosing, the Name Candidate Worksheet and Availability-Sweep Agent will help you settle it first.");
    else lines.push("In a phrase, what does the business sell?");
    return lines.join("\n\n");
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["business_name", "category", "audience", "existing_assets", "logo", "colours", "typefaces", "voice"],
    properties: {
      business_name: { type: "string" },
      category: { type: "string" },
      audience: { type: "string" },
      existing_assets: { type: "string", description: "What the member already has, or \"None\"." },
      logo: {
        type: "object",
        additionalProperties: false,
        required: ["minimum_size", "clear_space", "notes"],
        properties: {
          minimum_size: { type: "string", description: "e.g. 120 px wide on screen, 30 mm in print." },
          clear_space: { type: "string", description: "e.g. the height of the first letter on every side." },
          notes: { type: "array", items: { type: "string" }, description: "Three to five do or don't usage notes." },
        },
      },
      colours: {
        type: "object",
        additionalProperties: false,
        required: ["primary", "secondary"],
        properties: {
          primary: { type: "array", items: colour, description: "One or two." },
          secondary: { type: "array", items: colour, description: "One to three." },
        },
      },
      typefaces: {
        type: "array",
        description: "One or two, covering headline and body between them.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["family", "role", "licence", "fallback"],
          properties: {
            family: { type: "string" },
            role: { type: "string", enum: ["headline", "body", "headline and body"] },
            licence: { type: "string", enum: [...LICENCES] },
            fallback: { type: "string", description: "System fallback, e.g. Georgia, serif." },
          },
        },
      },
      voice: {
        type: "array",
        description: "Three to five descriptors.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["descriptor", "do", "dont"],
          properties: {
            descriptor: { type: "string" },
            do: { type: "string", description: "An example sentence to write." },
            dont: { type: "string", description: "An example sentence to avoid." },
          },
        },
      },
    },
  },
  onSave: (o) => {
    const name = str(o.business_name);
    if (!name) throw new SaveError("business_name is empty. Ask the member for their chosen business name.");
    const category = str(o.category);
    const audience = str(o.audience);
    if (!category || !audience) throw new SaveError("category and audience are both required. Ask the member for whichever is missing.");

    const logo = obj(o.logo);
    const minSize = str(logo.minimum_size);
    const clearSpace = str(logo.clear_space);
    const logoNotes = strArray(logo.notes);
    if (!minSize || !clearSpace) throw new SaveError("logo needs both minimum_size and clear_space.");
    if (logoNotes.length < 1) throw new SaveError("logo.notes needs three to five usage notes.");

    const c = obj(o.colours);
    const readColours = (k: "primary" | "secondary", min: number, max: number) => {
      const list = objArray(c[k]).map((x) => ({ hex: str(x.hex).toUpperCase(), use: str(x.use) }));
      if (list.length < min || list.length > max) throw new SaveError(`colours.${k} must have ${min} to ${max} entries; got ${list.length}.`);
      const bad = list.filter((x) => !HEX.test(x.hex)).map((x) => x.hex || "(empty)");
      if (bad.length) throw new SaveError(`colours.${k} has values that are not six-digit hex codes: ${bad.join(", ")}. Use codes like #1F3A5F, never colour names.`);
      return list;
    };
    const primary = readColours("primary", 1, 2);
    const secondary = readColours("secondary", 1, 3);

    const typefaces = objArray(o.typefaces).map((t) => ({ family: str(t.family), role: str(t.role), licence: str(t.licence), fallback: str(t.fallback) }));
    if (typefaces.length < 1 || typefaces.length > 2) throw new SaveError(`typefaces must have one or two entries; got ${typefaces.length}.`);
    if (typefaces.some((t) => !t.family)) throw new SaveError("Every typeface needs a family name.");
    if (typefaces.some((t) => !(LICENCES as readonly string[]).includes(t.licence)))
      throw new SaveError("Every typeface must be from a widely licensable family under the SIL Open Font License or Apache License 2.0.");
    const covers = (r: string) => typefaces.some((t) => t.role === r || t.role === "headline and body");
    if (!covers("headline") || !covers("body")) throw new SaveError("Typefaces must cover both headline and body between them.");

    const voice = objArray(o.voice).map((v) => ({ descriptor: str(v.descriptor), do: str(v.do), dont: str(v.dont) }));
    if (voice.length < 3 || voice.length > 5) throw new SaveError(`voice must have three to five descriptors; got ${voice.length}.`);
    if (voice.some((v) => !v.descriptor || !v.do || !v.dont)) throw new SaveError("Every voice descriptor needs one do example and one don't example.");

    const sheet = {
      business_name: name,
      category,
      audience,
      existing_assets: str(o.existing_assets),
      logo: { minimum_size: minSize, clear_space: clearSpace, notes: logoNotes },
      colours: { primary, secondary },
      typefaces,
      voice,
      date: today(),
    };

    // The member's own brand: the neutral template drops Late Founders branding.
    const doc = {
      title: `${name} Brand Sheet`,
      eyebrow: `${name} · BRAND GUIDELINES`.toUpperCase(),
      purpose: `How ${name} looks and sounds, on one page, for anyone designing or writing for it.`,
      dense: true,
      template: "neutral" as const,
      blocks: [
        { type: "kv", items: [{ label: "Category", value: category }, { label: "Audience", value: audience }] },
        { type: "heading", text: "Logo" },
        { type: "kv", items: [{ label: "Minimum size", value: minSize }, { label: "Clear space", value: clearSpace }] },
        { type: "bullets", items: logoNotes },
        { type: "heading", text: "Colours" },
        {
          type: "table",
          table: {
            headers: ["Role", "Hex", "Use"],
            widths: [0.8, 0.8, 2.6],
            rows: [...primary.map((x) => ["Primary", x.hex, x.use]), ...secondary.map((x) => ["Secondary", x.hex, x.use])],
          },
        },
        { type: "heading", text: "Typefaces" },
        {
          type: "table",
          table: {
            headers: ["Typeface", "Used for", "Licence", "Fallback"],
            widths: [1.2, 1, 1.3, 1.2],
            rows: typefaces.map((t) => [t.family, t.role[0].toUpperCase() + t.role.slice(1), t.licence, t.fallback]),
          },
        },
        { type: "heading", text: "Voice" },
        {
          type: "table",
          table: {
            headers: ["We are", "Write this", "Not this"],
            widths: [0.9, 2, 2],
            rows: voice.map((v) => [v.descriptor, v.do, v.dont]),
          },
        },
      ] as DocBlock[],
    };

    return {
      profile: { brand_sheet: sheet, business_name: name },
      summary: `Brand sheet for ${name} · ${primary.length + secondary.length} colours, ${typefaces.length} typeface${typefaces.length > 1 ? "s" : ""}, ${voice.length} voice descriptors`,
      doc,
    };
  },
};

export const course04Modes = [entityDecision, brandSheetGenerator];
