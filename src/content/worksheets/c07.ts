import type { LibraryEntry, ProfileData, SheetData, TableRow, WorksheetDef } from "../types";

// Member-record fields written here:
//   content_pillars: Record<Pillar, string>   one specific post idea per pillar (Content Pillar Worksheet)
//   angle_statement: string                   read by the Course 11 Repurposing Engine as a standing filter

export const PILLARS = ["Clarity", "Authority", "Legacy", "Lessons", "AI"] as const;
const PILLAR_COPY: Record<(typeof PILLARS)[number], string> = {
  Clarity: "Making something confusing in your field simple. Explainers, myths, what people get wrong.",
  Authority: "Proof you know the work: results, client stories, the calls you got right.",
  Legacy: "What decades in your field taught you, and what you want to leave behind.",
  Lessons: "Mistakes and turning points, told honestly, with what you would do differently.",
  AI: "How you actually use AI in your work, as someone with the experience to judge its output.",
};

const rows = (d: SheetData, k: string): TableRow[] =>
  Array.isArray(d[k]) ? (d[k] as TableRow[]).filter((r) => r && typeof r === "object") : [];
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// ---------------------------------------------------------------------------
// 07.2 Hook & Template Library
// ---------------------------------------------------------------------------

const ADAPT = "Adapt, do not paste. Swap in your own detail; if a stranger could have written it, it is not done.";

const entry = (category: string, title: string, pattern: string, generic: string, specific: string, tags?: string[]): LibraryEntry => ({
  category,
  title,
  tags,
  parts: [
    { label: "The pattern", text: pattern, copy: true },
    { label: "Generic (what everyone writes)", text: generic },
    { label: "Specific (what works)", text: specific },
    { label: "Before you use it", text: ADAPT },
  ],
});

export const HOOKS: LibraryEntry[] = [
  entry("Hook patterns", "Contrarian statement", "[Common belief in your field] is wrong. Here is what [years] of [your work] taught me instead.",
    "Hustle culture is wrong.",
    "Most small firms raise prices too late. In 22 years of running a print shop, every price rise I delayed cost me a client anyway.",
    ["Clarity", "Authority"]),
  entry("Hook patterns", "Vulnerable admission", "I [mistake or fear] for [time]. Here is what finally changed.",
    "I used to struggle with confidence.",
    "For three years I let one client pay 60 days late because I was afraid to lose them. Here is the email that fixed it.",
    ["Lessons", "Legacy"]),
  entry("Hook patterns", "Numbered promise", "[Number] [specific things] I wish I had known before [specific moment].",
    "5 tips for success.",
    "4 questions I wish I had asked before signing my first commercial lease at 51.",
    ["Clarity", "Lessons"]),
  entry("Hook patterns", "Mistake confession", "The [cost] mistake I made [when], and the rule I made after it.",
    "We all make mistakes.",
    "The $40,000 hiring mistake I made in 2019, and the one-page scorecard I have used for every hire since.",
    ["Lessons", "Authority"]),
  entry("Hook patterns", "Specific-pain question", "Ever [very specific painful moment your buyer knows]?",
    "Struggling with growth?",
    "Ever opened your accounting software on the 28th and realised payroll is bigger than the bank balance?",
    ["Clarity", "AI"]),

  entry("Post formats", "Framework or list", "Hook. One line on why it matters. Three to five numbered points, one sentence each. A closing line that asks which one they would add.",
    "A list of generic tips with no context.",
    "\"The three numbers I check every Monday\", each with what it told you last month.",
    ["Clarity", "Authority", "AI"]),
  entry("Post formats", "Story arc", "Where I was. What went wrong. The moment it turned. What I do now. One line on what it means for the reader.",
    "A motivational story with no specifics.",
    "The week your biggest client left, told in dates and numbers, ending with the change you made to pricing.",
    ["Lessons", "Legacy"]),
  entry("Post formats", "Contrarian take", "The common advice. Why it fails in practice, with one example. What you do instead. Where the common advice is still right.",
    "Disagreeing for attention.",
    "Why \"niche down\" nearly broke your agency, and the one situation where it is still right.",
    ["Clarity", "Authority"]),
  entry("Post formats", "Before and after", "Before: the situation, in numbers. The one change. After: the result, in the same numbers. What it took.",
    "Vague transformation claims.",
    "A client's onboarding took 14 days; one checklist took it to 3. The before and after, step by step.",
    ["Authority", "AI"]),
  entry("Post formats", "Direct question", "A short setup with your own answer, then a real question you want answered.",
    "\"Thoughts?\" at the end of anything.",
    "\"I have stopped doing discovery calls over 30 minutes. Has anyone found the long call actually closes better?\"",
    ["Legacy", "Lessons"]),

  entry("Comment openers", "Add a specific", "[Their point] matches what I saw when [your specific example].", "Great post!", "This matches what I saw running a 40-person warehouse: the night shift's errors halved when we wrote the steps down."),
  entry("Comment openers", "Respectful disagreement", "I would push back on one part: [point]. In my experience [specific].", "I disagree.", "I would push back on the hiring point. In my experience the first hire should be operations, not sales."),
  entry("Comment openers", "Useful question", "How did you handle [specific next problem their post raises]?", "Interesting, tell me more.", "How did you handle the clients who were on the old price when you raised it?"),

  entry("Connection requests", "Shared context", "Hi [name], we both [specific shared context]. Your post on [topic] stuck with me. Would be good to connect.", "I'd like to add you to my network.", "Hi Dana, we both spent years in logistics before going out on our own. Your post on pricing pallets stuck with me."),
  entry("Connection requests", "Their work", "Hi [name], I read [specific thing they made or said]. [One honest sentence on why]. Glad to connect.", "Let's connect!", "Hi Sam, I read your breakdown of the bakery's margins. The point on waste was something I had never priced in."),
  entry("Connection requests", "Same audience", "Hi [name], I work with [audience] too, on [different angle]. Would be good to compare notes some time.", "I help businesses grow.", "Hi Priya, I work with family-owned manufacturers too, on succession rather than marketing. Would be good to compare notes."),

  entry("DM openers", "Follow their post", "Your post about [specific point] made me think of [specific]. How has that played out since?", "Hi, how are you?", "Your post about firing your biggest client made me think of my own in 2016. How has revenue held up since?"),
  entry("DM openers", "Offer something", "I saw you are working on [specific]. I wrote down [specific resource] when I did the same. Happy to send it if useful.", "I have a service that could help you.", "I saw you are hiring your first operations lead. I kept the scorecard I used for mine; happy to send it if useful."),
  entry("DM openers", "Simple thanks", "Thanks for connecting. What are you working on this quarter?", "Thanks for connecting! Would you like a call?", "Thanks for connecting, Ruth. What is the main thing you are working on this quarter?"),
];

export const hookLibrary: WorksheetDef = {
  assetId: "hook-library",
  exports: ["pdf"],
  readOnly: true,
  sections: [
    {
      title: "How to use this library",
      blocks: [
        {
          kind: "callout",
          tone: "warning",
          title: "Adapt, do not paste",
          text: "If everyone in the community pastes the same hook, every feed fills with identical posts, which is worse than no library at all. Use the pattern, then put your own years, numbers and names into it. Each entry shows a generic version next to a specific one so you can see the difference.",
        },
      ],
    },
    {
      title: "Hooks, formats and openers",
      blocks: [
        {
          kind: "library",
          categories: ["Hook patterns", "Post formats", "Comment openers", "Connection requests", "DM openers"],
          entries: HOOKS,
          tagFilter: { label: "Pillar", tags: [...PILLARS] },
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// 07.3 Content Pillar Worksheet
// ---------------------------------------------------------------------------

export function assembledAngle(d: SheetData): string {
  const exp = text(d.angle_experience);
  const pov = text(d.angle_pov);
  const aud = text(d.angle_audience);
  if (!exp || !pov || !aud) return "";
  return `After ${exp.replace(/[.\s]+$/, "")}, I believe ${pov.replace(/[.\s]+$/, "")}, and I write for ${aud.replace(/[.\s]+$/, "")}.`;
}

export const angleStatement = (d: SheetData) => text(d.angle_final) || assembledAngle(d);

const pillarIdeas = (d: SheetData) => {
  const r = rows(d, "pillars");
  return Object.fromEntries(PILLARS.map((p, i) => [p, text(r[i]?.idea)]));
};

export const contentPillars: WorksheetDef = {
  assetId: "content-pillars",
  exports: ["pdf", "xlsx"],
  sections: [
    {
      title: "1 · Five pillars, one idea each",
      intro: "Each idea must be specific to you. If another founder could post it word for word, it is a topic, not an idea.",
      blocks: [
        { kind: "prose", bullets: PILLARS.map((p) => `${p}: ${PILLAR_COPY[p]}`) },
        {
          kind: "table",
          table: {
            key: "pillars",
            minRows: 5,
            maxRows: 5,
            rowLabels: [...PILLARS],
            columns: [{ key: "idea", label: "One post idea only you could write", type: "text", width: 4 }],
          },
        },
      ],
    },
    {
      title: "2 · Your angle statement",
      intro: "Not a tagline. A filter: every post you write should pass through it. Course 11's Repurposing Engine uses it on everything it drafts.",
      blocks: [
        {
          kind: "fields",
          fields: [
            { key: "angle_experience", label: "A specific experience", type: "text", hint: "Example: \"25 years running warehouses for other people\"." },
            { key: "angle_pov", label: "A point of view that is not the safe take", type: "text", hint: "Example: \"most small firms automate the wrong jobs first\"." },
            { key: "angle_audience", label: "A specific audience", type: "text", hint: "Example: \"owners of 10 to 50 person distribution firms\"." },
          ],
        },
        { kind: "computed", key: "draft", label: "Your angle, assembled", compute: (d) => assembledAngle(d) || null },
        {
          kind: "fields",
          fields: [
            {
              key: "angle_final",
              label: "Your angle statement, in your words (optional)",
              type: "textarea",
              lines: 2,
              hint: "Rewrite the assembled sentence until it sounds like you. Leave blank to use it as is.",
            },
          ],
        },
      ],
    },
  ],
  completeCheck: (d) => {
    const ideas = pillarIdeas(d);
    const missing = PILLARS.filter((p) => !ideas[p]);
    if (missing.length) return `Add a post idea for ${missing.join(", ")}.`;
    if (!angleStatement(d)) return "Fill in all three parts of your angle statement.";
    return null;
  },
  writes: [
    { key: "content_pillars", from: (d) => pillarIdeas(d) },
    { key: "angle_statement", from: (d) => angleStatement(d) || null },
  ],
};

// ---------------------------------------------------------------------------
// 07.5 4-Week Content Calendar
// ---------------------------------------------------------------------------

// Three posts a week on a fixed Monday/Wednesday/Friday rotation; every pillar
// comes round at least twice in four weeks, Legacy and AI rotating in from week 2.
export const ROTATION: [number, string, (typeof PILLARS)[number]][] = [
  [1, "Mon", "Lessons"], [1, "Wed", "Authority"], [1, "Fri", "Clarity"],
  [2, "Mon", "Legacy"], [2, "Wed", "AI"], [2, "Fri", "Lessons"],
  [3, "Mon", "Authority"], [3, "Wed", "Clarity"], [3, "Fri", "Legacy"],
  [4, "Mon", "AI"], [4, "Wed", "Lessons"], [4, "Fri", "Authority"],
];

export function prefilledCalendar(p: ProfileData) {
  const ideas = p.content_pillars && typeof p.content_pillars === "object" ? (p.content_pillars as Record<string, string>) : {};
  const used = new Set<string>();
  return ROTATION.map(([week, day, pillar]) => {
    // The member's own idea goes into the first slot for its pillar; later slots start blank.
    const idea = !used.has(pillar) && ideas[pillar] ? ideas[pillar] : "";
    used.add(pillar);
    return { week: `Week ${week}`, day, pillar, idea, status: "Idea" };
  });
}

export const contentCalendar: WorksheetDef = {
  assetId: "content-calendar",
  exports: ["xlsx", "pdf"],
  reads: ["content_pillars"],
  initial: (p) => ({ slots: prefilledCalendar(p) }),
  sections: [
    {
      title: "Four weeks, three posts a week",
      intro: "The rotation is the point, not the volume. It starts filled in; change any day or pillar to suit your week, and add a fourth post if you have one.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "slots",
            minRows: 12,
            maxRows: 20,
            addable: true,
            columns: [
              { key: "week", label: "Week", type: "select", options: ["Week 1", "Week 2", "Week 3", "Week 4"], width: 0.8 },
              { key: "day", label: "Day", type: "select", options: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], width: 0.6 },
              { key: "pillar", label: "Pillar", type: "select", options: [...PILLARS], width: 0.9 },
              { key: "idea", label: "Post idea", type: "text", width: 3 },
              { key: "status", label: "Status", type: "select", options: ["Idea", "Drafted", "Scheduled", "Posted"], width: 0.9 },
            ],
          },
        },
        {
          kind: "computed",
          key: "progress",
          label: "Posted so far",
          compute: (d) => {
            const s = rows(d, "slots").filter((r) => text(r.pillar));
            return s.length ? `${s.filter((r) => r.status === "Posted").length} of ${s.length}` : null;
          },
        },
      ],
    },
  ],
};

export const course07Worksheets = [hookLibrary, contentPillars, contentCalendar];
