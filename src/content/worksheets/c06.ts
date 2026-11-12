import { asNumber, money } from "../profile";
import { addMonths, monthlyBurn, monthsText, mvi, openRisks, personalGap, scenarios } from "../quit";
import type { SheetData, WorksheetDef } from "../types";

// Member-record fields written here:
//   monthly_burn: number        real monthly spending, from three months of statements
//   mvi: number                 Minimum Viable Income, the pre-tax monthly income needed to quit
//   committed_revenue: number   monthly revenue from signed contracts only
//   reserve_balance: number     cash the member could live on
//   quit_scenarios: { cold_turkey, phased_exit, stay_and_build: months of coverage or null (covered), quit_date }
//   open_risk_count: number     open rows on the Risk Inventory
//   risk_items: string[]        the open rows, in words (read by the Decision Engine)

const NOT_ADVICE =
  "General guidance only, not financial, tax or legal advice. These figures are only as good as the numbers you enter; check big decisions with an accountant.";

const moneyOrNull = (n: number | null) => (n === null ? null : `${money(n)}/mo`);

export const runwayCalculator: WorksheetDef = {
  assetId: "runway-calculator",
  exports: ["pdf", "xlsx"],
  reads: ["freedom_number", "health_cost"],
  fill: (p) => ({ health_premium: asNumber(p.health_cost) ?? "" }),
  sections: [
    {
      title: "1 · Your real monthly burn",
      intro: "Use three months of real bank and card statements, not estimates. Most people guess 20 to 30% low.",
      blocks: [
        {
          kind: "table",
          label: "Fixed costs (the same every month)",
          table: {
            key: "fixed_costs",
            minRows: 6,
            maxRows: 25,
            addable: true,
            columns: [
              { key: "label", label: "Cost", type: "text", width: 2.4 },
              { key: "monthly", label: "Per month ($)", type: "money", width: 1 },
            ],
          },
        },
        {
          kind: "table",
          label: "Variable costs (three months, averaged for you)",
          table: {
            key: "variable_costs",
            minRows: 5,
            maxRows: 25,
            addable: true,
            columns: [
              { key: "label", label: "Cost", type: "text", width: 1.8 },
              { key: "month1", label: "Month 1 ($)", type: "money", width: 1 },
              { key: "month2", label: "Month 2 ($)", type: "money", width: 1 },
              { key: "month3", label: "Month 3 ($)", type: "money", width: 1 },
            ],
          },
        },
        {
          kind: "table",
          label: "Irregular costs (once or twice a year)",
          table: {
            key: "annual_costs",
            minRows: 3,
            maxRows: 15,
            addable: true,
            columns: [
              { key: "label", label: "Cost", type: "text", width: 2.4 },
              { key: "yearly", label: "Per year ($)", type: "money", width: 1 },
            ],
          },
        },
        { kind: "computed", key: "burn", label: "Your true monthly burn", big: true, compute: (d) => moneyOrNull(monthlyBurn(d)) },
      ],
    },
    {
      title: "2 · Minimum Viable Income",
      intro: "What the business has to pay you, before tax, for you to leave a paycheck.",
      blocks: [
        {
          kind: "fields",
          fields: [
            {
              key: "guaranteed_income", label: "Guaranteed non-business income ($/mo)", type: "money", width: "half",
              hint: "Income that keeps coming if you quit: a pension, rent, a partner's paycheck you can count on.",
            },
            {
              key: "se_tax_pct", label: "Tax set-aside (%)", type: "percent", width: "half",
              hint: "The share of business income you put aside for self-employment and income tax. Ask your accountant for your rate.",
            },
            {
              key: "health_premium", label: "Replacement health premium ($/mo)", type: "money", width: "half",
              hint: "The full monthly premium, with no employer paying part of it. Leave employer-paid cover out of your burn above: it stops when the paycheck does, and this line replaces it. Your Risk Inventory quote fills this in if it is empty.",
            },
            {
              key: "overhead", label: "Business overhead ($/mo)", type: "money", width: "half",
              hint: "Software, insurance, accounting and anything else the business costs to run.",
            },
          ],
        },
        { kind: "computed", key: "mvi", label: "Your Minimum Viable Income (MVI)", big: true, compute: (d) => moneyOrNull(mvi(d)) },
        {
          kind: "computed",
          key: "compare",
          label: "The gate and the destination",
          compute: (d, p) => {
            const m = mvi(d);
            if (m === null) return null;
            const f = asNumber(p.freedom_number);
            return {
              headers: ["Number", "Per month", "What it means"],
              rows: [
                ["Simple personal gap", money(personalGap(d)), "Burn minus guaranteed income. Too low to quit on."],
                ["MVI", money(m), "The quit gate: tax, health cover and overhead added back."],
                ["Freedom Number", f === null ? "Set in the Founder Diagnostic" : money(f), "The destination, not the gate."],
              ],
            };
          },
        },
        {
          kind: "callout",
          tone: "note",
          text: "Your MVI is the gate: the least the business must pay before you leave a paycheck. Your Freedom Number is the destination: the income that buys your life back. Do not quit on the Freedom Number, and do not stop at the MVI.",
        },
      ],
    },
    {
      title: "3 · Three ways out",
      intro: "The same reserve, run three ways. Update these every month as the numbers change.",
      blocks: [
        {
          kind: "fields",
          fields: [
            {
              key: "reserve", label: "Reserve you could live on ($)", type: "money", width: "half",
              hint: "Savings and severance. Not retirement money you would pay penalties to touch.",
            },
            {
              key: "committed_revenue", label: "Committed revenue ($/mo)", type: "money", width: "half",
              hint: "Signed contracts only. Not pipeline, not verbal yeses.",
            },
          ],
        },
        { kind: "prose", heading: "Cold turkey", paragraphs: ["Your job income goes to zero on one date. Reserve and signed revenue carry you."] },
        { kind: "fields", fields: [{ key: "quit_date", label: "Quit date", type: "date", width: "half" }] },
        {
          kind: "computed",
          key: "cold",
          label: "Cold turkey: months of coverage",
          compute: (d) => {
            const s = scenarios(d);
            if (!s) return null;
            const c = s.cold_turkey;
            const runsOut = c.months !== null && typeof d.quit_date === "string" && d.quit_date ? addMonths(d.quit_date, c.months) : "";
            return `${monthsText(c)}${runsOut ? `. Reserve runs out around ${runsOut}` : ""}`;
          },
        },
        { kind: "prose", heading: "Phased exit", paragraphs: ["You cut your job back and the business makes up the rest."] },
        {
          kind: "fields",
          fields: [
            { key: "reduced_w2", label: "Reduced job income ($/mo, after tax)", type: "money", width: "half" },
            { key: "business_income", label: "Business income ($/mo)", type: "money", width: "half" },
          ],
        },
        { kind: "computed", key: "phased", label: "Phased exit: months of coverage", compute: (d) => { const s = scenarios(d); return s ? monthsText(s.phased_exit) : null; } },
        { kind: "prose", heading: "Stay and build", paragraphs: ["You keep the job and grow side income until it reaches your MVI."] },
        {
          kind: "fields",
          fields: [
            { key: "current_income", label: "Current job income ($/mo, after tax)", type: "money", width: "half" },
            { key: "side_income", label: "Side income this month ($/mo)", type: "money", width: "half" },
          ],
        },
        {
          kind: "table",
          label: "Side income, month by month",
          table: {
            key: "side_log",
            minRows: 3,
            maxRows: 36,
            addable: true,
            columns: [
              { key: "month", label: "Month", type: "text", width: 1 },
              { key: "amount", label: "Side income ($)", type: "money", width: 1 },
            ],
          },
        },
        {
          kind: "computed",
          key: "stay",
          label: "Stay and build: where you stand",
          compute: (d) => {
            const s = scenarios(d);
            const m = mvi(d);
            if (!s || !m) return null;
            const side = asNumber(d.side_income) ?? 0;
            return `${monthsText(s.stay_and_build)}. Side income is ${Math.round((side / m) * 100)}% of your MVI.`;
          },
        },
        {
          kind: "computed",
          key: "all",
          label: "Side by side",
          compute: (d) => {
            const s = scenarios(d);
            if (!s) return null;
            const row = (name: string, c: (typeof s)["cold_turkey"], need: string) => [name, money(c.income), `${money(c.need)} (${need})`, money(c.shortfall), monthsText(c)];
            return {
              headers: ["Scenario", "Income /mo", "Needs /mo", "Shortfall /mo", "Coverage"],
              rows: [
                row("Cold turkey", s.cold_turkey, "MVI"),
                row("Phased exit", s.phased_exit, "MVI"),
                row("Stay and build", s.stay_and_build, "burn"),
              ],
            };
          },
        },
        { kind: "callout", tone: "legal", text: NOT_ADVICE },
      ],
    },
  ],
  writes: [
    { key: "monthly_burn", from: (d) => monthlyBurn(d) },
    { key: "mvi", from: (d) => mvi(d) },
    { key: "committed_revenue", from: (d) => asNumber(d.committed_revenue) },
    { key: "reserve_balance", from: (d) => asNumber(d.reserve) },
    { key: "health_premium", from: (d) => asNumber(d.health_premium) },
    {
      key: "quit_scenarios",
      from: (d: SheetData) => {
        const s = scenarios(d);
        if (!s) return null;
        return {
          cold_turkey: s.cold_turkey.months,
          phased_exit: s.phased_exit.months,
          stay_and_build: s.stay_and_build.months,
          quit_date: typeof d.quit_date === "string" ? d.quit_date : "",
        };
      },
    },
  ],
};

const STATUS = ["Open", "Closed"];

export const riskInventory: WorksheetDef = {
  assetId: "risk-inventory",
  exports: ["pdf", "xlsx"],
  sections: [
    {
      title: "Why this exists",
      blocks: [
        {
          kind: "prose",
          paragraphs: [
            "Write down what is actually at stake if the timing is wrong, so the fear has something specific to argue with. Mark a row Closed only when it is handled, not when it feels better. The Decision Engine counts every open row.",
          ],
        },
      ],
    },
    {
      title: "1 · Dependents",
      intro: "Everyone who relies on your income, and what they need that sits inside your burn number.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "dependents",
            minRows: 3,
            maxRows: 10,
            addable: true,
            columns: [
              { key: "name", label: "Name", type: "text", width: 1 },
              { key: "needs", label: "What they need", type: "text", width: 2 },
              { key: "hard_deadline", label: "Hard deadline?", type: "yesno", width: 0.9 },
              { key: "status", label: "Status", type: "select", options: STATUS, width: 0.8 },
            ],
          },
        },
      ],
    },
    {
      title: "2 · Health coverage",
      intro: "Get real quotes. A guess here is the most common reason a quit date slips.",
      blocks: [
        {
          kind: "fields",
          fields: [
            { key: "cobra_quote", label: "COBRA quote ($/mo)", type: "money", width: "half" },
            { key: "marketplace_quote", label: "Marketplace quote ($/mo)", type: "money", width: "half" },
            { key: "health_option", label: "Selected option", type: "select", options: ["COBRA", "Marketplace", "Partner's plan", "Other"], width: "third" },
            { key: "health_cost", label: "Monthly cost ($)", type: "money", width: "third" },
            { key: "health_status", label: "Status", type: "select", options: STATUS, width: "third" },
          ],
        },
      ],
    },
    {
      title: "3 · Debts",
      blocks: [
        {
          kind: "table",
          table: {
            key: "debts",
            minRows: 4,
            maxRows: 15,
            addable: true,
            columns: [
              { key: "creditor", label: "Creditor", type: "text", width: 1.4 },
              { key: "minimum", label: "Minimum payment ($/mo)", type: "money", width: 1 },
              { key: "liability", label: "Liability", type: "select", options: ["Personal", "Business"], width: 0.9 },
              { key: "status", label: "Status", type: "select", options: STATUS, width: 0.8 },
            ],
          },
        },
      ],
    },
    {
      title: "Open items",
      blocks: [
        { kind: "computed", key: "count", label: "Open risks", big: true, compute: (d) => String(openRisks(d).length) },
        {
          kind: "computed",
          key: "list",
          label: "Still open",
          compute: (d) => {
            const open = openRisks(d);
            return open.length ? { headers: ["Open item"], rows: open.map((x) => [x]) } : "Nothing open.";
          },
        },
      ],
    },
  ],
  reads: ["health_premium"],
  fill: (p) => ({ health_cost: asNumber(p.health_premium) ?? "" }),
  writes: [
    { key: "health_cost", from: (d) => asNumber(d.health_cost) },
    { key: "open_risk_count", from: (d) => openRisks(d).length },
    { key: "risk_items", from: (d) => openRisks(d) },
  ],
};

export const contractChecklist: WorksheetDef = {
  assetId: "contract-review-checklist",
  exports: ["pdf", "docx"],
  sections: [
    {
      title: "Read this first",
      blocks: [
        {
          kind: "callout",
          tone: "legal",
          title: "Not legal advice",
          text: "Whether these clauses can be enforced depends on where you live and work. Non-compete rules in particular vary enormously by state and country, and some places ban them outright. Use this list to find what to ask about, then have an employment lawyer read your actual contract before you rely on it.",
        },
        {
          kind: "prose",
          paragraphs: ["Read your own employment contract and handbook against this list before you build anything on the side. Tick each item once you have found the clause, or confirmed there is none, and note what it says."],
        },
      ],
    },
    {
      title: "1 · IP assignment",
      blocks: [
        {
          kind: "checklist",
          key: "ip",
          mode: "check",
          notes: true,
          items: [
            {
              key: "scope",
              label: "How far does the IP clause reach?",
              detail:
                "Look for: words like \"all inventions, works and ideas\" and whether they are limited to your job or the employer's business.\nCommon language: \"conceived during the term of employment\", \"related to the business of the Company\".\nWhat it may mean: a broad clause can claim side work done on your own time if it touches the employer's field.",
            },
            {
              key: "own_time",
              label: "Is there a carve-out for your own time and equipment?",
              detail:
                "Look for: an exception for work done off the clock, without company resources, unrelated to the business.\nWhat it may mean: some states require this carve-out by law; if yours has it, keeping the work cleanly separate matters even more.",
            },
            {
              key: "prior",
              label: "Did you list prior inventions when you joined?",
              detail: "Look for: a schedule of prior inventions or excluded IP.\nWhat it may mean: anything not listed may be argued to have been created on the job.",
            },
          ],
        },
      ],
    },
    {
      title: "2 · Non-competes and non-solicits",
      blocks: [
        {
          kind: "checklist",
          key: "noncompete",
          mode: "check",
          notes: true,
          items: [
            {
              key: "noncompete",
              label: "Is there a non-compete, and what are its limits?",
              detail:
                "Look for: the length of time, the geography and the definition of a competing business.\nCommon language: \"for 12 months following termination … within the Territory\".\nWhat it may mean: it may stop you starting in the same field for a period. Enforceability depends heavily on where you are.",
            },
            {
              key: "nonsolicit_clients",
              label: "Can you work with the employer's clients?",
              detail: "Look for: a client non-solicit or no-service clause.\nWhat it may mean: your first customers may have to come from outside your employer's book.",
            },
            {
              key: "nonsolicit_staff",
              label: "Can you hire your coworkers?",
              detail: "Look for: an employee non-solicit or no-hire clause.\nWhat it may mean: recruiting colleagues, even after you leave, may breach it.",
            },
          ],
        },
      ],
    },
    {
      title: "3 · Moonlighting and disclosure",
      blocks: [
        {
          kind: "checklist",
          key: "moonlighting",
          mode: "check",
          notes: true,
          items: [
            {
              key: "outside_work",
              label: "Does the contract or handbook limit outside work?",
              detail:
                "Look for: outside-employment, conflict-of-interest or exclusive-service clauses.\nCommon language: \"devote full working time and attention\", \"shall not engage in any other business\".\nWhat it may mean: you may need permission before starting a side business at all.",
            },
            {
              key: "disclosure",
              label: "Do you have to disclose side work?",
              detail: "Look for: a duty to report outside business interests, sometimes yearly.\nWhat it may mean: not disclosing can be a breach on its own, even if the work itself is allowed.",
            },
          ],
        },
      ],
    },
    {
      title: "4 · Stay clean, whatever the contract says",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "checklist",
          key: "clean",
          mode: "check",
          notes: true,
          items: [
            { key: "equipment", label: "Own equipment", detail: "Never use the work laptop, phone or software licence for the business." },
            { key: "accounts", label: "Own accounts", detail: "Personal email, cloud storage and AI accounts only. Nothing on the employer's systems." },
            { key: "time", label: "Own time", detail: "No business work during paid hours, including calls and messages." },
            { key: "crossover", label: "No client or coworker crossover", detail: "Do not pitch the employer's clients or recruit colleagues while you are employed." },
            { key: "records", label: "Dated records", detail: "Keep dated notes of when and where you built each piece, so you can show it was yours." },
          ],
        },
      ],
    },
  ],
};

export const course06Worksheets = [runwayCalculator, riskInventory, contractChecklist];
