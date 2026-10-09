// Course 05 AI modes: Offer-Builder Agent and Skeptical-Buyer Simulation.
//
// Member-record shapes (agreed, written here):
//   offer_record: {
//     headline: string; promise: string; proof: string[]; price_sentence: string;
//     tiers: { name: string; price: string; scope: string; default: boolean }[];
//     guarantee: string; cta: string;
//     buyer: { situation: string; stage: string; problem: string; skepticism: string };
//     buyer_quotes: string[];
//     levers: { dream_outcome: { text: string; score: number }; likelihood: {...}; time_delay: {...}; effort: {...} };
//     stack: { addition: string; lever: string }[];          // lever is one of LEVER_KEYS
//     promise_variants: string[];
//     package: { name: string; scope: string; exclusions: string[]; timeline: string; price: string };
//     objections: { objection: string; lever: string; edit: string }[];
//     stage_reached: number;    // 1 to 7, never goes down
//     updated_at: string;       // ISO timestamp
//   }
//   Lever scores run 1 to 10 (0 = not scored yet). Every save is merged onto the
//   existing record: empty incoming values keep what was saved before, so a save
//   at stage 3 never wipes stage 1. The engine versions each save.
//
//   objection_list: { objection: string; lever: string; dismissed: boolean }[]

import { asNumber } from "../profile";
import type { ModeDef, ProfileData } from "../types";
import { SaveError, str, strArray, obj, objArray } from "./util";

type DocBlock = ReturnType<ModeDef["onSave"]>["doc"]["blocks"][number];

const EYEBROW = "COURSE 05 · DEFINE YOUR OFFER";

const LEVER_KEYS = ["dream_outcome", "likelihood", "time_delay", "effort"] as const;
type LeverKey = (typeof LEVER_KEYS)[number];
const LEVER_LABELS: Record<LeverKey, string> = {
  dream_outcome: "Dream outcome",
  likelihood: "Perceived likelihood of success",
  time_delay: "Time delay",
  effort: "Effort and sacrifice",
};
const isLever = (v: string): v is LeverKey => (LEVER_KEYS as readonly string[]).includes(v);

const STAGES = [
  "The four value levers",
  "Stacking additions",
  "A keepable promise",
  "Your buyer, in their words",
  "Productized package and tiers",
  "Price sentence with an anchor",
  "Objections sorted by lever",
];

function offerRecord(p: ProfileData): Record<string, unknown> | null {
  const o = obj(p.offer_record);
  return Object.keys(o).length ? o : null;
}

function experienceProof(p: ProfileData): string[] {
  const ha = obj(p.hidden_assets);
  return objArray(ha.experience)
    .map((e) => [str(e.skill), str(e.outcome)].filter(Boolean).join(": "))
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Offer-Builder Agent
// ---------------------------------------------------------------------------

const leverSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "score"],
  properties: {
    text: { type: "string", description: "The member's answer for this lever. Empty if not reached yet." },
    score: { type: "integer", description: "1 to 10, agreed with the member. 0 if not scored yet." },
  },
};

const s = { type: "string" };

export const offerBuilder: ModeDef = {
  assetId: "offer-builder",
  persistent: true,
  reads: ["hidden_assets", "problem_statement", "audience", "founder_type", "offer_record", "interview_signal_tally", "objection_list"],
  writes: ["offer_record"],
  systemPrompt: `You run the Offer-Builder Agent for Course 05: a persistent workspace where the member builds one offer across eleven lessons and several weeks. Their saved offer_record is in the member record; pick up exactly where it left off and never ask again for something already saved.

Seven stages, in order. Tell the member which stage you are on.
1. The four value levers. Capture and score each 1 to 10 with the member: dream outcome (what the buyer gets, in their terms), perceived likelihood of success (why they will believe it works for them), time delay (how soon they see a result), effort and sacrifice (what it costs them in effort, beyond money). Higher scores are better for the buyer: a short time delay and low effort score high.
2. Stacking additions. Each addition is tagged to the one lever it moves. If an addition moves none of the four levers, reject it and say why. Bonuses that only add bulk do not make the stack.
3. A keepable promise. Generate exactly three promise sentence variants. For each, ask whether the member would defend it to a customer six months after the sale. The chosen promise must be one they said yes to.
4. The buyer: situation, stage, problem, and how skeptical they are. Invite the member to paste real buyer quotes (from interviews or messages). Then rewrite the headline and promise in the buyer's own words, using those quotes. Never invent quotes.
5. Productized package: name, scope, explicit exclusions, timeline, price. Then three tiers, with the middle tier built as the intended default: the one most buyers should choose. The outer tiers exist to make the middle one the obvious choice.
6. A price sentence with an anchor: the price set against something the buyer already compares it to (the cost of the problem, the alternative they pay for now).
7. Objections: list the objections a buyer would raise, sort each by the lever it attacks, and give one specific edit to the offer per objection. Use any objections saved from the Skeptical-Buyer Simulation.

Proof: pull it from the member's Hidden Assets Inventory (experience and outcomes with numbers). Use their actual results only. If the inventory is empty, ask for specific results.

Also build up the one-page offer as you go: headline (the dream outcome in one line), promise, proof, price sentence and tiers, guarantee, and a single call to action.

SAVING: call save_output at the end of every completed stage, after the member confirms that stage. Saves merge onto the existing record: send everything you know so far, and use empty strings, empty arrays or a score of 0 for parts not reached yet. stage_reached is the highest stage completed. Each save is kept as a version, so nothing is lost.`,
  opener: (p) => {
    const rec = offerRecord(p);
    const ps = str(p.problem_statement);
    const proof = experienceProof(p);
    const lines: string[] = [];
    if (rec) {
      const stage = Math.max(0, Math.min(7, asNumber(rec.stage_reached) ?? 0));
      const headline = str(rec.headline);
      lines.push(`Welcome back. Your offer is saved through stage ${stage} of 7${stage ? `: ${STAGES[stage - 1].toLowerCase()}` : ""}.`);
      if (headline) lines.push(`Current headline: "${headline}"`);
      if (stage >= 7) {
        lines.push("All seven stages are done. Do you want to revise a stage, or work through objections from a Skeptical-Buyer Simulation?");
      } else {
        lines.push(`Next is stage ${stage + 1}: ${STAGES[stage].toLowerCase()}. Ready to pick up there, or is there something earlier you want to change first?`);
      }
      return lines.join("\n\n");
    }
    lines.push("This is your offer workspace for the whole course. We build one offer in seven stages, and I save after each one, so you can leave and come back.");
    lines.push(ps ? `I have your problem statement: "${ps}"` : "I do not have a problem statement on record yet. You can still start; we will define the problem as we go.");
    lines.push(
      proof.length
        ? `From your Hidden Assets Inventory I have ${proof.length} result${proof.length === 1 ? "" : "s"} to use as proof, for example: ${proof[0]}.`
        : "Your Hidden Assets Inventory has no experience results yet. Filling it in gives us proof material for the offer.",
    );
    lines.push("Stage 1, the four value levers. Start with the dream outcome: when this works, what does your buyer have that they do not have today, in their terms?");
    return lines.join("\n\n");
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: [
      "stage_reached",
      "change_note",
      "levers",
      "stack",
      "promise_variants",
      "promise",
      "buyer",
      "buyer_quotes",
      "package",
      "tiers",
      "price_sentence",
      "objections",
      "headline",
      "proof",
      "guarantee",
      "cta",
    ],
    properties: {
      stage_reached: { type: "integer", description: "Highest stage completed, 1 to 7." },
      change_note: { type: "string", description: "One line on what this save adds or changes." },
      levers: {
        type: "object",
        additionalProperties: false,
        required: [...LEVER_KEYS],
        properties: { dream_outcome: leverSchema, likelihood: leverSchema, time_delay: leverSchema, effort: leverSchema },
      },
      stack: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["addition", "lever"],
          properties: { addition: s, lever: { type: "string", enum: [...LEVER_KEYS] } },
        },
      },
      promise_variants: { type: "array", items: s, description: "Exactly three once stage 3 is reached, otherwise empty." },
      promise: { type: "string", description: "The chosen promise, one the member would defend six months after the sale." },
      buyer: {
        type: "object",
        additionalProperties: false,
        required: ["situation", "stage", "problem", "skepticism"],
        properties: { situation: s, stage: s, problem: s, skepticism: s },
      },
      buyer_quotes: { type: "array", items: s, description: "Real quotes the member pasted. Never invented." },
      package: {
        type: "object",
        additionalProperties: false,
        required: ["name", "scope", "exclusions", "timeline", "price"],
        properties: { name: s, scope: s, exclusions: { type: "array", items: s }, timeline: s, price: s },
      },
      tiers: {
        type: "array",
        description: "Three tiers in order, the middle one default:true. Empty until stage 5.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "price", "scope", "default"],
          properties: { name: s, price: s, scope: s, default: { type: "boolean" } },
        },
      },
      price_sentence: { type: "string", description: "The price set against an anchor." },
      objections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["objection", "lever", "edit"],
          properties: { objection: s, lever: { type: "string", enum: [...LEVER_KEYS] }, edit: s },
        },
      },
      headline: { type: "string", description: "The dream outcome in one line, in the buyer's words." },
      proof: { type: "array", items: s, description: "Specific results, drawn from the Hidden Assets Inventory." },
      guarantee: s,
      cta: { type: "string", description: "A single call to action." },
    },
  },
  onSave: (o, profile) => {
    const prev = offerRecord(profile) ?? {};
    const stageIn = asNumber(o.stage_reached);
    if (stageIn === null || !Number.isInteger(stageIn) || stageIn < 1 || stageIn > 7)
      throw new SaveError("stage_reached must be a whole number from 1 to 7: the highest stage completed.");

    // Levers: validate incoming, merge per lever.
    const prevLevers = obj(prev.levers);
    const inLevers = obj(o.levers);
    const levers = {} as Record<LeverKey, { text: string; score: number }>;
    for (const k of LEVER_KEYS) {
      const l = obj(inLevers[k]);
      const text = str(l.text);
      const sc = asNumber(l.score) ?? 0;
      if (!Number.isInteger(sc) || sc < 0 || sc > 10) throw new SaveError(`levers.${k}.score must be a whole number from 1 to 10 (0 if not scored yet).`);
      if (text && sc === 0) throw new SaveError(`${LEVER_LABELS[k]} has an answer but no score. Agree a score from 1 to 10 with the member.`);
      const p = obj(prevLevers[k]);
      levers[k] = text ? { text, score: sc } : { text: str(p.text), score: asNumber(p.score) ?? 0 };
    }

    // Stack: every addition must move a lever.
    const stackIn = objArray(o.stack).map((a) => ({ addition: str(a.addition), lever: str(a.lever) }));
    stackIn.forEach((a, i) => {
      if (!a.addition) throw new SaveError(`Stack item ${i + 1} is empty.`);
      if (!isLever(a.lever))
        throw new SaveError(`"${a.addition}" does not move any of the four levers. Reject it and tell the member why, then save without it.`);
    });

    // Promise variants: exactly three once present.
    const variants = strArray(o.promise_variants);
    if (variants.length && variants.length !== 3) throw new SaveError(`promise_variants must have exactly three variants; got ${variants.length}.`);

    // Tiers: three, middle is the only default.
    const tiersIn = objArray(o.tiers).map((t) => ({
      name: str(t.name),
      price: str(t.price),
      scope: str(t.scope),
      default: t.default === true,
    }));
    if (tiersIn.length) {
      if (tiersIn.length !== 3) throw new SaveError(`The package needs exactly three tiers; got ${tiersIn.length}.`);
      if (!tiersIn[1].default || tiersIn[0].default || tiersIn[2].default)
        throw new SaveError("The middle tier must be the default, and only the middle tier. Set default:true on tier 2 only.");
      tiersIn.forEach((t, i) => {
        if (!t.name || !t.price) throw new SaveError(`Tier ${i + 1} needs a name and a price.`);
      });
    }

    // Objections: lever enum and one edit each.
    const objectionsIn = objArray(o.objections).map((x) => ({ objection: str(x.objection), lever: str(x.lever), edit: str(x.edit) }));
    objectionsIn.forEach((x, i) => {
      if (!x.objection) throw new SaveError(`Objection ${i + 1} is empty.`);
      if (!isLever(x.lever)) throw new SaveError(`Objection "${x.objection}" must be sorted into one of the four levers.`);
      if (!x.edit) throw new SaveError(`Objection "${x.objection}" needs one specific edit to the offer.`);
    });

    // Merge: empty incoming keeps what was there.
    const keepStr = (k: string, v: string) => v || str(prev[k]);
    const keepArr = <T,>(k: string, v: T[]): T[] => (v.length ? v : Array.isArray(prev[k]) ? (prev[k] as T[]) : []);
    const merge = <K extends string>(incoming: Record<string, unknown>, before: Record<string, unknown>, keys: K[]) =>
      Object.fromEntries(keys.map((k) => [k, str(incoming[k]) || str(before[k])])) as Record<K, string>;

    const buyerIn = obj(o.buyer);
    const pkgIn = obj(o.package);
    const prevPkg = obj(prev.package);
    const pkgExclusions = strArray(pkgIn.exclusions);

    const record = {
      headline: keepStr("headline", str(o.headline)),
      promise: keepStr("promise", str(o.promise)),
      proof: keepArr("proof", strArray(o.proof)),
      price_sentence: keepStr("price_sentence", str(o.price_sentence)),
      tiers: keepArr("tiers", tiersIn),
      guarantee: keepStr("guarantee", str(o.guarantee)),
      cta: keepStr("cta", str(o.cta)),
      buyer: merge(buyerIn, obj(prev.buyer), ["situation", "stage", "problem", "skepticism"]),
      buyer_quotes: keepArr("buyer_quotes", strArray(o.buyer_quotes)),
      levers,
      stack: keepArr("stack", stackIn),
      promise_variants: keepArr("promise_variants", variants),
      package: {
        ...merge(pkgIn, prevPkg, ["name", "scope", "timeline", "price"]),
        exclusions: pkgExclusions.length ? pkgExclusions : strArray(prevPkg.exclusions),
      },
      objections: keepArr("objections", objectionsIn),
      stage_reached: Math.max(stageIn, asNumber(prev.stage_reached) ?? 0),
      updated_at: new Date().toISOString(),
    };

    // Stage consistency: a stage counts as complete only when its part is there.
    const checks: [number, boolean, string][] = [
      [1, LEVER_KEYS.every((k) => record.levers[k].text && record.levers[k].score > 0), "all four levers captured and scored"],
      [2, record.stack.length > 0, "at least one stacking addition tagged to a lever"],
      [3, record.promise_variants.length === 3 && !!record.promise, "three promise variants and a chosen promise"],
      [4, !!(record.buyer.situation && record.buyer.stage && record.buyer.problem), "the buyer's situation, stage and problem"],
      [5, !!record.package.name && record.tiers.length === 3, "a named package and three tiers"],
      [6, !!record.price_sentence, "a price sentence with an anchor"],
      [7, record.objections.length > 0, "objections sorted by lever, each with an edit"],
    ];
    for (const [stage, ok, what] of checks) {
      if (stageIn >= stage && !ok) throw new SaveError(`stage_reached is ${stageIn}, but stage ${stage} needs ${what}. Finish it or lower stage_reached.`);
    }

    const r = record;
    const blank = "Not written yet";
    const blocks: DocBlock[] = [];
    if (r.stage_reached < 7)
      blocks.push({ type: "callout", tone: "note", title: "In progress", text: `Saved through stage ${r.stage_reached} of 7. Sections still blank are filled in later stages.` });
    blocks.push(
      { type: "heading", text: "Headline" },
      { type: "paragraph", text: r.headline || blank, tone: r.headline ? "accent" : "muted" },
      { type: "heading", text: "Promise" },
      { type: "paragraph", text: r.promise || blank, tone: r.promise ? undefined : "muted" },
      { type: "heading", text: "Proof" },
    );
    blocks.push(r.proof.length ? { type: "bullets", items: r.proof } : { type: "paragraph", text: blank, tone: "muted" });
    blocks.push({ type: "heading", text: "Price and tiers" });
    blocks.push({ type: "paragraph", text: r.price_sentence || blank, tone: r.price_sentence ? undefined : "muted" });
    if (r.tiers.length)
      blocks.push({
        type: "table",
        table: {
          headers: ["Tier", "Price", "What is included"],
          widths: [1.3, 0.8, 3],
          rows: r.tiers.map((t) => [t.default ? `${t.name} (recommended)` : t.name, t.price, t.scope]),
        },
      });
    blocks.push(
      { type: "heading", text: "Guarantee" },
      { type: "paragraph", text: r.guarantee || blank, tone: r.guarantee ? undefined : "muted" },
      { type: "heading", text: "Your next step" },
      { type: "paragraph", text: r.cta || blank, tone: r.cta ? "accent" : "muted" },
    );

    // Workbench page: everything behind the one-pager.
    blocks.push({ type: "pageBreak" }, { type: "heading", text: "Behind the offer" });
    blocks.push({
      type: "table",
      table: {
        headers: ["Value lever", "What it is for your buyer", "Score"],
        widths: [1.4, 3.4, 0.6],
        rows: LEVER_KEYS.map((k) => [LEVER_LABELS[k], r.levers[k].text, r.levers[k].score ? `${r.levers[k].score} / 10` : ""]),
      },
    });
    if (r.stack.length)
      blocks.push(
        { type: "subheading", text: "Stack" },
        {
          type: "table",
          table: {
            headers: ["Addition", "Lever it moves"],
            widths: [3.5, 1.5],
            rows: r.stack.map((a) => [a.addition, isLever(a.lever) ? LEVER_LABELS[a.lever] : a.lever]),
          },
        },
      );
    if (r.buyer.situation || r.buyer.problem)
      blocks.push(
        { type: "subheading", text: "Buyer" },
        {
          type: "kv",
          items: [
            { label: "Situation", value: r.buyer.situation },
            { label: "Stage", value: r.buyer.stage },
            { label: "Problem", value: r.buyer.problem },
            { label: "Skepticism", value: r.buyer.skepticism },
          ],
        },
      );
    if (r.package.name)
      blocks.push(
        { type: "subheading", text: "Package" },
        {
          type: "kv",
          items: [
            { label: "Name", value: r.package.name },
            { label: "Scope", value: r.package.scope },
            { label: "Not included", value: r.package.exclusions.join("; ") },
            { label: "Timeline", value: r.package.timeline },
            { label: "Price", value: r.package.price },
          ],
        },
      );
    if (r.objections.length)
      blocks.push(
        { type: "subheading", text: "Objections and edits" },
        {
          type: "table",
          table: {
            headers: ["Objection", "Lever it attacks", "Edit to the offer"],
            widths: [2.2, 1.2, 2.4],
            rows: r.objections.map((x) => [x.objection, isLever(x.lever) ? LEVER_LABELS[x.lever] : x.lever, x.edit]),
          },
        },
      );

    return {
      profile: { offer_record: record },
      summary: `Offer saved through stage ${record.stage_reached} of 7${str(o.change_note) ? `: ${str(o.change_note)}` : ""}`,
      doc: {
        title: "Your One-Page Offer",
        eyebrow: EYEBROW,
        purpose: "Your offer on one page: headline, promise, proof, price and tiers, guarantee and next step.",
        blocks,
        meta: { completedAt: record.updated_at },
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Skeptical-Buyer Simulation
// ---------------------------------------------------------------------------

export const skepticalBuyer: ModeDef = {
  assetId: "skeptical-buyer",
  reads: ["offer_record"],
  writes: ["objection_list"],
  systemPrompt: `You run the Skeptical-Buyer Simulation for Course 05. You play one buyer: the exact persona in offer_record.buyer (situation, stage, problem, skepticism level). The member presents their offer; you respond as that buyer would.

IN CHARACTER
- Push hard. Raise the objections a real buyer in that situation would raise about price, whether it will work for them, how long it takes, what it will cost them in effort, trust in the member, and timing. Use the offer's actual headline, promise, proof, tiers, price and guarantee.
- Do not concede easily. A good answer earns a follow-up question, not instant agreement. Only move when the member's answer genuinely resolves the concern, and say what resolved it.
- Do not soften to be agreeable, and do not be gratuitously hostile, rude or sarcastic. You are a busy, careful buyer spending your own money.
- Match the skepticism level in the record. Higher skepticism means more proof demanded and more pushback on the promise.
- Raise one objection at a time. Stay in character until the member says they are done.
- Keep a running list of every objection you raised, and note which ones the member brushed aside or did not really answer (dismissed).

ON EXIT
When the member says they are done, step out of character. List every objection raised, numbered, including the dismissed ones, and say which you count as dismissed. Explain the four value levers in one line each: dream outcome, perceived likelihood of success, time delay, effort and sacrifice. Ask the member to sort each objection into the lever it attacks. The sorting is the member's call: you may say where you would put one if they ask, but record their choice. Once every objection is sorted and they confirm the list, call save_output.`,
  opener: (p) => {
    const rec = offerRecord(p);
    const buyer = obj(rec?.buyer);
    if (!rec || (!str(rec.headline) && !str(rec.promise))) {
      return "I need your offer before I can play your buyer, and there is no offer saved yet. Build it first in the Offer-Builder Agent, at least through the buyer stage, then come back here.";
    }
    if (!str(buyer.situation) && !str(buyer.problem)) {
      return `I have your offer ("${str(rec.headline) || str(rec.promise)}") but no buyer definition yet. Finish the buyer stage in the Offer-Builder Agent (situation, stage, problem and how skeptical they are), then come back so I can play that buyer.`;
    }
    const lines = [
      `I have your offer: "${str(rec.headline) || str(rec.promise)}".`,
      `I will play your buyer: ${[str(buyer.situation), str(buyer.stage), str(buyer.problem)].filter(Boolean).join("; ")}.${str(buyer.skepticism) ? ` Skepticism: ${str(buyer.skepticism)}.` : ""}`,
      "I will push hard and I will not agree just to be nice. Every objection I raise is kept, including any you wave away. When you want to stop, say \"I'm done\" and we will sort the objections together.",
      "Pitch me your offer the way you would on a real call.",
    ];
    return lines.join("\n\n");
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["objections"],
    properties: {
      objections: {
        type: "array",
        description: "Every objection raised, in order, including dismissed ones, each sorted by the member.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["objection", "lever", "dismissed", "member_response"],
          properties: {
            objection: { type: "string", description: "The objection as the buyer raised it." },
            lever: { type: "string", enum: [...LEVER_KEYS], description: "The lever the member sorted it into." },
            dismissed: { type: "boolean", description: "True if the member brushed it aside or did not really answer it." },
            member_response: { type: "string", description: "One line on how the member answered. Empty if they did not." },
          },
        },
      },
    },
  },
  onSave: (o, profile) => {
    const items = objArray(o.objections).map((x) => ({
      objection: str(x.objection),
      lever: str(x.lever),
      dismissed: x.dismissed === true,
      response: str(x.member_response),
    }));
    if (!items.length) throw new SaveError("No objections to save. The list must include every objection raised in the role-play.");
    items.forEach((x, i) => {
      if (!x.objection) throw new SaveError(`Objection ${i + 1} is empty.`);
      if (!isLever(x.lever))
        throw new SaveError(`Objection "${x.objection}" has not been sorted. Ask the member which of the four levers it attacks.`);
    });

    const list = items.map((x) => ({ objection: x.objection, lever: x.lever, dismissed: x.dismissed }));
    const counts = LEVER_KEYS.map((k) => ({ k, n: items.filter((x) => x.lever === k).length }));
    const max = Math.max(...counts.map((c) => c.n));
    const hardest = counts.filter((c) => c.n === max).map((c) => LEVER_LABELS[c.k]);
    const dismissedN = items.filter((x) => x.dismissed).length;
    const headline = str(offerRecord(profile)?.headline);

    const blocks: DocBlock[] = [
      {
        type: "big",
        label: "Lever under most attack",
        value: hardest.join(", "),
        note: `${max} of ${items.length} objections. Start your edits here.`,
      },
      {
        type: "table",
        table: {
          headers: ["Value lever", "Objections"],
          widths: [3, 1],
          rows: counts.map((c) => [LEVER_LABELS[c.k], String(c.n)]),
        },
      },
      { type: "heading", text: "Every objection raised" },
      {
        type: "table",
        table: {
          headers: ["#", "Objection", "Lever it attacks", "Your answer", "Dismissed"],
          widths: [0.3, 2.4, 1.2, 2, 0.7],
          rows: items.map((x, i) => [String(i + 1), x.objection, LEVER_LABELS[x.lever as LeverKey], x.response, x.dismissed ? "Yes" : "No"]),
        },
      },
    ];
    if (dismissedN)
      blocks.push({
        type: "callout",
        tone: "warning",
        title: `${dismissedN} dismissed`,
        text: "An objection you waved away in practice is one a real buyer will hold on to. Answer each of these in the offer itself.",
      });
    blocks.push({
      type: "paragraph",
      tone: "muted",
      text: "Take this list into the objections stage of the Offer-Builder Agent and give each one a specific edit.",
    });

    return {
      profile: { objection_list: list },
      summary: `${items.length} objections raised, ${dismissedN} dismissed · most on ${hardest.join(", ")}`,
      doc: {
        title: "Skeptical-Buyer Objections",
        eyebrow: EYEBROW,
        purpose: headline ? `Every objection your buyer raised to "${headline}", sorted by the lever it attacks.` : "Every objection your buyer raised, sorted by the lever it attacks.",
        blocks,
      },
    };
  },
};

export const course05Modes = [offerBuilder, skepticalBuyer];
