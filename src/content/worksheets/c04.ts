import type { SheetData, WorksheetDef } from "../types";

// Member record written here:
//   name_candidates: string[]  // non-empty candidate names, in row order (read by the Availability-Sweep Agent)

const rows = (d: SheetData, k: string) => (Array.isArray(d[k]) ? (d[k] as Record<string, unknown>[]) : []);
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export const nameCandidates: WorksheetDef = {
  assetId: "name-candidates",
  exports: ["pdf", "xlsx"],
  dense: true, // spec: one page
  reads: ["name_candidates"],
  initial: (p) => {
    const names = Array.isArray(p.name_candidates) ? (p.name_candidates as unknown[]).map(text).filter(Boolean) : [];
    return names.length ? { candidates: names.slice(0, 5).map((name) => ({ name })) } : {};
  },
  sections: [
    {
      title: "The three buckets",
      blocks: [
        {
          kind: "prose",
          bullets: [
            "Descriptive: says what you do (Austin Tax Prep). Clear on day one, hard to protect and easy to outgrow.",
            "Evocative: suggests a feeling or result without saying it (Patagonia, Basecamp). Memorable, needs a line of explanation.",
            "Invented: a made-up word (Kodak, Etsy). Easiest to own and trademark, means nothing until you teach it.",
          ],
        },
      ],
    },
    {
      title: "Your five candidates",
      intro:
        "Said aloud: tell the name to someone over the phone; pass if they repeat it back right. Spelled cold: ask them to type it without help; pass if they spell it right first time.",
      blocks: [
        {
          kind: "table",
          table: {
            key: "candidates",
            minRows: 5,
            maxRows: 5,
            columns: [
              { key: "name", label: "Candidate name", type: "text", width: 1.4 },
              {
                key: "bucket",
                label: "Bucket",
                type: "select",
                options: ["Descriptive", "Evocative", "Invented"],
                width: 0.9,
              },
              { key: "said_aloud", label: "Said aloud passed", type: "yesno", width: 0.7 },
              { key: "spelled_cold", label: "Spelled cold passed", type: "yesno", width: 0.7 },
              { key: "names_honestly", label: "Who this name names, honestly (one sentence)", type: "text", width: 2.6 },
            ],
          },
        },
        {
          kind: "callout",
          tone: "note",
          text: "Take the names that pass both tests into the Availability-Sweep Agent. It checks domains, social handles and trademarks for all of them in one pass.",
        },
      ],
    },
  ],
  writes: [
    {
      key: "name_candidates",
      from: (d) => rows(d, "candidates").map((r) => text(r.name)).filter(Boolean),
    },
  ],
};

export const trademarkTriageGuide: WorksheetDef = {
  assetId: "trademark-triage-guide",
  exports: ["pdf", "docx"],
  readOnly: true,
  sections: [
    {
      title: "How to use this guide",
      blocks: [
        {
          kind: "callout",
          tone: "legal",
          title: "General guidance, not a legal determination",
          text: "This guide helps you triage trademark hits so you know which ones to drop, which to ignore and which to take to an attorney. It does not tell you whether a name is legally clear. Only a trademark attorney can do that for your situation.",
        },
        {
          kind: "prose",
          paragraphs: [
            "A trademark search almost always returns hits. Most of them are coincidences: another business, in another line of work, that happens to share a word with you. A few are dealbreakers. Your job is to sort them fast, before you spend money on a domain, a logo or signage.",
            "Run every hit through the three questions below, in order. If a hit clears all three, it is a coincidence. If it fails any one, treat it as a real conflict and either drop the name or get an attorney's view before you go further.",
          ],
        },
      ],
    },
    {
      title: "Question 1: How similar is the name, really?",
      blocks: [
        {
          kind: "prose",
          paragraphs: [
            "Look past spelling. Trademark examiners compare how names look, how they sound when said aloud, and what they mean. Swapping a letter, dropping a vowel or translating a word does not make two names different. Generic words that everyone in a field uses (\"consulting\", \"labs\", \"group\") count for very little; the distinctive part of the name is what matters.",
          ],
          bullets: [
            "Dealbreaker: you want \"Brightlyne Coaching\" and the hit is \"Brightline Coaching\". Different spelling, identical sound, same distinctive word. A customer who heard it on a podcast could not tell them apart.",
            "Coincidence: you want \"Harbor Point Advisory\" and the hit is \"Harbor Freight\". They share one common word, but the distinctive parts differ and nobody says one and hears the other.",
          ],
        },
      ],
    },
    {
      title: "Question 2: Is the category the same or adjacent?",
      blocks: [
        {
          kind: "prose",
          paragraphs: [
            "Trademarks are registered for specific classes of goods and services. The same word can be owned by different businesses in unrelated categories. The risk comes from the same category, or from an adjacent one where a customer would expect the same company to offer both. Check the registered category on every hit, then ask whether a natural expansion of either business would put you side by side.",
          ],
          bullets: [
            "Dealbreaker: you plan bookkeeping services under \"Ledgerline\" and the hit is \"Ledgerline\" accounting software. Software and services for the same job are adjacent: customers expect a software firm to offer setup and support.",
            "Coincidence: you plan a landscape design studio called \"Fern & Stone\" and the hit is \"Fern & Stone\" for jewellery. Different class, different buyer, no reasonable expansion that brings them together.",
          ],
        },
      ],
    },
    {
      title: "Question 3: Would a reasonable customer be confused about who they are buying from?",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "prose",
          paragraphs: [
            "This is the question the law actually turns on, so it is the one to answer last and most honestly. Picture an ordinary buyer, not an expert, who is in a hurry. Would they think your business is the other one, or connected to it, or endorsed by it? Shared customers, shared marketing channels and shared geography all push the answer towards yes.",
          ],
          bullets: [
            "Dealbreaker: your \"Northstar Fitness\" coaching would sell to the same local gym-goers as an established \"North Star Fitness\" studio three miles away. Same buyers, same town, same search results. Confusion is close to certain.",
            "Coincidence: your \"Summit\" retirement-planning practice sells to pre-retirees, and the hit is \"Summit\" for climbing gear sold through outdoor shops. A buyer of one would never assume they were dealing with the other.",
          ],
        },
      ],
    },
    {
      title: "When to call a trademark attorney",
      blocks: [
        {
          kind: "prose",
          paragraphs: ["Triage handles most hits. These three situations need a professional before you commit to the name:"],
          numbered: [
            "A hit passes question 1 or 2 but you are not sure about question 3. A close call on confusion is exactly what an attorney is for, and an hour of their time costs less than a rebrand.",
            "You have received a cease-and-desist letter, a demand or any contact from another business about your name. Do not reply on your own.",
            "You are about to spend real money on the name: registering your own trademark, printing signage or packaging, or raising investment. Clear it properly first.",
          ],
        },
        {
          kind: "callout",
          tone: "legal",
          text: "General guidance to help you triage, not a legal determination. Trademark rights depend on your country, your registrations and how each business actually trades.",
        },
      ],
    },
  ],
};

export const entitySetupChecklist: WorksheetDef = {
  assetId: "entity-setup-checklist",
  exports: ["pdf", "docx"],
  dense: true, // spec: one page
  sections: [
    {
      title: "Three steps, in this order",
      intro: "Do them in sequence. Each step needs a document the one before it produces.",
      blocks: [
        {
          kind: "checklist",
          key: "steps",
          mode: "check",
          notes: true,
          items: [
            {
              key: "file_entity",
              label: "1. File your entity with the state",
              detail:
                "What it is: registering your LLC or corporation with the state's business filing office, which gives you a legal business separate from you.\nWhy first: everything after this needs the exact legal name and filing date the state gives you.",
            },
            {
              key: "ein",
              label: "2. Get your EIN",
              detail:
                "What it is: your Employer Identification Number, the free federal tax ID the IRS issues to your business.\nWhy after filing: the application asks for your entity type and legal name, which only exist once the state accepts your filing.",
            },
            {
              key: "bank_account",
              label: "3. Open the business bank account",
              detail:
                "What it is: a checking account in the business's own name, used for every dollar the business earns or spends.\nWhy after the EIN: banks ask for your formation documents and EIN to open it. Without them you end up with a personal account in disguise.",
            },
          ],
        },
        {
          kind: "callout",
          tone: "warning",
          title: "Never mix personal and business money",
          text: "Every business dollar goes in and out of the business account, and nothing personal touches it. Mixing funds can strip away the liability protection you just filed for, and it turns tax time into guesswork. If you pay yourself, transfer it as a clear owner draw or salary.",
        },
        {
          kind: "callout",
          tone: "legal",
          text: "Requirements and fees vary by state. Check your state's business filing office for current forms, fees and any annual report or franchise tax due.",
        },
      ],
    },
  ],
};

export const digitalPresenceAudit: WorksheetDef = {
  assetId: "digital-presence-audit",
  exports: ["pdf", "docx"],
  dense: true, // spec: one page
  sections: [
    {
      title: "1 · The five credibility gaps",
      intro: "What a buyer checks in the first two minutes. Mark each pass or fail and note what to fix.",
      blocks: [
        {
          kind: "checklist",
          key: "credibility",
          mode: "passfail",
          notes: true,
          items: [
            { key: "email_domain", label: "Professional email on your own domain", detail: "you@yourbusiness.com, not a free webmail address." },
            { key: "website", label: "Complete, live website with no placeholders", detail: "No lorem ipsum, stock \"coming soon\" pages or broken links." },
            { key: "contact", label: "Consistent contact information", detail: "Same name, email, phone and address everywhere they appear." },
            { key: "social", label: "Filled-out social profiles", detail: "Photo, bio, link to your site and a recent post on each profile you keep." },
            { key: "legal_footer", label: "Basic legal footer", detail: "Business name, copyright line, privacy policy and terms on your site." },
          ],
        },
      ],
    },
    {
      title: "2 · The touchpoint audit",
      intro: "The small places clients see you after they say yes. Each one should look like the same business.",
      blocks: [
        {
          kind: "checklist",
          key: "touchpoints",
          mode: "passfail",
          notes: true,
          items: [
            { key: "email_footer", label: "Email footer", detail: "Name, role, business, website and one way to reach you." },
            { key: "invoice", label: "Invoice template", detail: "Business legal name, logo, payment terms and how to pay." },
            { key: "booking", label: "Calendar booking page", detail: "Your branding, a clear meeting name and a confirmation message." },
            { key: "out_of_office", label: "Out-of-office reply", detail: "Return date and who to contact meanwhile." },
            { key: "file_names", label: "Proposal file names", detail: "Client and business name, not \"final_v3_edit.pdf\"." },
            { key: "voicemail", label: "Voicemail greeting", detail: "Your name and business, recorded in your own voice." },
          ],
        },
      ],
    },
  ],
};

export const course04Worksheets = [nameCandidates, trademarkTriageGuide, entitySetupChecklist, digitalPresenceAudit];
