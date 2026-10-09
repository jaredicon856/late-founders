import type { AssetDef, CourseDef } from "./types";

// In scope this round: Courses 01-05 and 12-14. Courses 06-11 come later; add
// them here and their assets will appear on the shelves automatically.

export const COURSES: CourseDef[] = [
  {
    number: 1,
    title: "Start Here: The Founder Diagnostic",
    pillar: "Foundations",
    assets: ["founder-diagnostic", "personal-roadmap"],
  },
  {
    number: 2,
    title: "The Late Advantage",
    pillar: "Foundations",
    assets: ["hidden-assets-inventory", "reframing-journal", "ninety-day-commitment"],
  },
  {
    number: 3,
    title: "The 90-Day Side-Hustle Test",
    pillar: "Pillar 1 · Clarity & Execution",
    assets: ["interview-script-generator", "interview-tracker", "go-no-go"],
  },
  {
    number: 4,
    title: "Name, Brand & Legal Basics",
    pillar: "Pillar 1 · Clarity & Execution",
    assets: [
      "name-candidates",
      "availability-sweep",
      "trademark-triage-guide",
      "entity-decision",
      "brand-sheet-generator",
      "entity-setup-checklist",
      "digital-presence-audit",
    ],
  },
  {
    number: 5,
    title: "Define Your Offer",
    pillar: "Pillar 1 · Clarity & Execution",
    assets: ["offer-builder", "one-page-offer", "skeptical-buyer"],
  },
  {
    number: 12,
    title: "Get Out of Your Own Business",
    pillar: "Pillar 3 · Scale & Exit",
    assets: [
      "owners-audit",
      "task-sort",
      "sop-generator",
      "sop-library",
      "business-dashboard",
      "one-week-away",
    ],
  },
  {
    number: 13,
    title: "The 10-Year Build-to-Sell Plan",
    pillar: "Pillar 3 · Scale & Exit",
    assets: ["sellability-scorecard", "valuation-estimator", "roadmap-builder", "data-room"],
  },
  {
    number: 14,
    title: "Hire & Delegate",
    pillar: "Pillar 3 · Scale & Exit",
    assets: [
      "role-scorecard",
      "lane-decision-guide",
      "interview-people-guide",
      "onboarding-30-60-90",
      "delegation-tracker",
    ],
  },
];

export const ASSETS: AssetDef[] = [
  // Course 01
  { id: "founder-diagnostic", code: "01.1", course: 1, kind: "ai", title: "Founder Diagnostic",
    summary: "A guided 15 to 20 minute interview that sets your founder type, Freedom Number and first five moves." },
  { id: "personal-roadmap", code: "01.2", course: 1, kind: "generated", title: "Personal Roadmap",
    summary: "Your diagnostic results on one page: founder type, Freedom Number, first five moves, 90-day target and route." },

  // Course 02
  { id: "hidden-assets-inventory", code: "02.1", course: 2, kind: "worksheet", title: "Hidden Assets Inventory",
    summary: "One page listing the experience, network, capital and judgment you already have." },
  { id: "reframing-journal", code: "02.2", course: 2, kind: "ai", title: "Reframing Journal",
    summary: "Rewrite a layoff, a rut or a late start with you as the one who acted." },
  { id: "ninety-day-commitment", code: "02.3", course: 2, kind: "worksheet", title: "90-Day Commitment Worksheet",
    summary: "Dates, a daily minimum and an enough number, printed and signed." },

  // Course 03
  { id: "interview-script-generator", code: "03.1", course: 3, kind: "ai", title: "Buyer-Interview Script Generator",
    lesson: "Lesson 2.2",
    summary: "Builds and re-tunes your buyer-interview script from your problem statement." },
  { id: "interview-tracker", code: "03.2", course: 3, kind: "worksheet", title: "Interview Notes & Signal Tracker",
    summary: "Log every buyer interview and count your strong signals against ten." },
  { id: "go-no-go", code: "03.3", course: 3, kind: "ai", title: "Go/No-Go Scorecard",
    summary: "Scores demand, margin, fit and market size from your evidence and bands the result." },

  // Course 04
  { id: "name-candidates", code: "04.1", course: 4, kind: "worksheet", title: "Name Candidate Worksheet",
    summary: "Five name candidates, run through the said-aloud and spelled-cold tests." },
  { id: "availability-sweep", code: "04.2", course: 4, kind: "tool", title: "Availability-Sweep Agent",
    summary: "Checks domains, social handles and trademarks for up to five names in one pass." },
  { id: "trademark-triage-guide", code: "04.3", course: 4, kind: "guide", title: "Trademark Conflict Triage Guide",
    summary: "Three questions that sort a dealbreaker from a coincidence." },
  { id: "entity-decision", code: "04.4", course: 4, kind: "ai", title: "Entity-Decision AI",
    summary: "Recommends LLC, S-Corp election, C-Corp or nonprofit, with the reasons for each ruled out." },
  { id: "brand-sheet-generator", code: "04.5", course: 4, kind: "ai", title: "Brand-Sheet Generator",
    summary: "A one-page brand sheet for your business you can hand to a freelancer." },
  { id: "entity-setup-checklist", code: "04.6", course: 4, kind: "checklist", title: "Entity Setup Checklist",
    summary: "File, get the EIN, open the bank account, in that order." },
  { id: "digital-presence-audit", code: "04.7", course: 4, kind: "checklist", title: "Digital Presence Audit Checklist",
    summary: "Five credibility gaps and six touchpoints, pass or fail." },

  // Course 05
  { id: "offer-builder", code: "05.1", course: 5, kind: "ai", title: "Offer-Builder Agent",
    summary: "Your offer workspace across every lesson of the course. It keeps everything." },
  { id: "one-page-offer", code: "05.2", course: 5, kind: "template", title: "One-Page Offer Template",
    summary: "Headline, promise, proof, price, guarantee and one call to action." },
  { id: "skeptical-buyer", code: "05.3", course: 5, kind: "ai", title: "Skeptical-Buyer Simulation",
    summary: "Your hardest buyer pushes on your offer. Every objection is kept." },

  // Course 12
  { id: "owners-audit", code: "12.1", course: 12, kind: "worksheet", title: "Owner's Audit Worksheet",
    summary: "Five days of every task you do, logged as you switch." },
  { id: "task-sort", code: "12.2", course: 12, kind: "worksheet", title: "Task-Sort Worksheet",
    summary: "Sorts your logged tasks into $10, $100 and $1,000 an hour work." },
  { id: "sop-generator", code: "12.3", course: 12, kind: "ai", title: "SOP Generator",
    summary: "Turns a narrated recording or transcript into a step-by-step SOP." },
  { id: "sop-library", code: "12.4", course: 12, kind: "library", title: "SOP Library",
    summary: "Your SOPs by role, with owners, review dates and every version." },
  { id: "business-dashboard", code: "12.5", course: 12, kind: "template", title: "Business Dashboard",
    summary: "Five to seven metrics with ranges, owners and the triggers that need you." },
  { id: "one-week-away", code: "12.6", course: 12, kind: "worksheet", title: "One-Week-Away Test Plan",
    summary: "Plan a week away, log the urges, and route every issue to a fix." },

  // Course 13
  { id: "sellability-scorecard", code: "13.1", course: 13, kind: "calculator", title: "Sellability Scorecard",
    summary: "Scores how transferable your business is, and compares it with last year." },
  { id: "valuation-estimator", code: "13.2", course: 13, kind: "calculator", title: "Valuation Estimator",
    summary: "A directional value range and the one input that moves it most." },
  { id: "roadmap-builder", code: "13.3", course: 13, kind: "ai", title: "10-Year Roadmap Builder",
    summary: "Works back from your target year to what must be true this year." },
  { id: "data-room", code: "13.4", course: 13, kind: "template", title: "Data Room Folder Structure",
    summary: "Five empty folders with a README in each. The gaps are the point." },

  // Course 14
  { id: "role-scorecard", code: "14.1", course: 14, kind: "worksheet", title: "Role Scorecard",
    summary: "One page per role: the outcome, the tasks, the traits and the numbers." },
  { id: "lane-decision-guide", code: "14.2", course: 14, kind: "guide", title: "Contractor / Employee / AI Decision Guide",
    summary: "Three questions that place a task with AI, a contractor or an employee." },
  { id: "interview-people-guide", code: "14.3", course: 14, kind: "guide", title: "Interview & People-Reading Guide",
    summary: "Five interview questions and five ways to read what you hear." },
  { id: "onboarding-30-60-90", code: "14.4", course: 14, kind: "template", title: "30/60/90 Onboarding Checklist",
    summary: "Three stages with one yes-or-no success marker each." },
  { id: "delegation-tracker", code: "14.5", course: 14, kind: "worksheet", title: "Delegation Check-In Tracker",
    summary: "Status and relationship check-ins kept apart, and the outcome metric week by week." },
];

const byId = new Map(ASSETS.map((a) => [a.id, a]));

export function getAsset(id: string): AssetDef | undefined {
  return byId.get(id);
}

export function getCourse(n: number): CourseDef | undefined {
  return COURSES.find((c) => c.number === n);
}

export function courseLabel(n: number): string {
  return `Course ${String(n).padStart(2, "0")}`;
}

export function eyebrowFor(asset: AssetDef): string {
  const course = getCourse(asset.course);
  return `${courseLabel(asset.course)} · ${course?.title ?? ""}`.toUpperCase();
}

// Founder type -> course order. Fresh Start and First-Timer validate an idea
// first; a Buried Founder already runs a business and needs out of it first.
export const ROUTES: Record<string, number[]> = {
  "Fresh Start": [1, 2, 3, 4, 5, 12, 13, 14],
  "First-Timer": [1, 2, 3, 4, 5, 12, 13, 14],
  "Buried Founder": [1, 2, 12, 14, 13, 3, 4, 5],
};
export const DEFAULT_ROUTE = ROUTES["Fresh Start"];

export const FOUNDER_TYPE_COPY: Record<string, string> = {
  "Fresh Start": "Something ended. You have runway and a decision to make.",
  "First-Timer": "You still have the job. You are building on the side, carefully.",
  "Buried Founder": "You already run a business, and it runs you. The work is getting out from under it.",
};
