import type { SheetData, WorksheetDef } from "../types";

// Course 09's software (the GHL sub-account, pipeline, site templates and email
// sequences) lives in the GHL snapshot. The Command Center links out to it and
// holds two things: the weekend progress tracker and the launch checklist.

const state = (d: SheetData, k: string) =>
  d[k] && typeof d[k] === "object" ? (d[k] as Record<string, { done?: unknown; result?: unknown }>) : {};

export const WEEKEND_STEPS = [
  { key: "login", label: "Log in to your Late Founders GHL workspace", detail: "Use the login link on the Course 09 shelf and the invite email from the Late Founders team. No invite yet? Ask the team in Skool. Once in, change the password and turn on two-factor sign-in." },
  { key: "profile", label: "Business profile filled in", detail: "Business name, address, time zone, logo and brand colors from your Brand Sheet." },
  { key: "domain", label: "Domain connected", detail: "The domain you registered in Course 04, pointed at your site. Not sure how? Ask the Late Founders team before you change any DNS settings." },
  { key: "pipeline", label: "Pipeline reviewed", detail: "Rename the stages you use to match how you actually sell, and leave the rest. Renaming is a label change, not a rebuild." },
  { key: "site", label: "Homepage and landing page customized", detail: "Your words from the One-Page Offer, not the template's." },
  { key: "calendar", label: "Booking calendar set up", detail: "Your real availability, a buffer between calls, confirmation and reminder messages on." },
  { key: "sequences", label: "Welcome and nurture emails rewritten in your voice", detail: "Rewrite every email before you turn the sequence on, or keep the unrewritten ones paused: real leads can arrive this weekend. Read each one aloud. If it does not sound like you, rewrite it." },
  { key: "payments", label: "Payments connected", detail: "Your processor linked and your real price on the offer." },
];

export const weekendTracker: WorksheetDef = {
  assetId: "weekend-tracker",
  exports: ["pdf"],
  sections: [
    {
      title: "Your tech stack, one weekend",
      intro: "Your CRM, website, pipeline and email sequences already exist inside your GHL workspace. Work through them here and tick each off as you go.",
      blocks: [
        { kind: "checklist", key: "steps", mode: "check", notes: true, items: WEEKEND_STEPS },
        {
          kind: "computed",
          key: "progress",
          label: "Progress",
          big: true,
          compute: (d) => `${WEEKEND_STEPS.filter((s) => state(d, "steps")[s.key]?.done === true).length} of ${WEEKEND_STEPS.length}`,
        },
        { kind: "callout", tone: "note", text: "When all eight are done, run the 8-Point Launch Checklist before you switch the site live." },
      ],
    },
  ],
};

export const LAUNCH_CHECKS = [
  { key: "published", label: "Site loads at its live address, on your own domain, on desktop and mobile", detail: "Publish first, then check. Open it on your phone on mobile data, not your home Wi-Fi." },
  { key: "placeholders", label: "All placeholder text and images replaced", detail: "Search every page for \"lorem\", \"your business\" and template stock photos." },
  { key: "pipeline", label: "Pipeline active, with a test contact moved through every stage", detail: "Create a fake contact and drag it from first stage to last. Check each automation fired." },
  { key: "welcome", label: "Welcome sequence live and rewritten in your voice", detail: "Send it to yourself. Read it on your phone." },
  {
    key: "booking",
    label: "Booking flow tested end to end from the live page",
    detail: "Four separate checks: book from the live page, the confirmation arrives, the reminder fires, and the contact record updates. Tick pass only if all four did.",
  },
  { key: "nurture_exit", label: "Nurture sequence stops when someone books", detail: "Book as your test contact and confirm the nurture emails stop." },
  { key: "payments", label: "Payments connected, price correct, a test payment updates the contact", detail: "Make a real small payment and refund it." },
  { key: "links", label: "Every link and button clicked, and a privacy page live", detail: "Including the footer and every button on mobile. The privacy page must exist and be linked from every page." },
];

export const launchChecklist: WorksheetDef = {
  assetId: "launch-checklist",
  exports: ["pdf", "docx"],
  sections: [
    {
      title: "Before you switch it on",
      intro: "Pass or fail, with a note on what you tested. Ticking without testing is not testing.",
      blocks: [
        { kind: "checklist", key: "checks", mode: "passfail", notes: true, items: LAUNCH_CHECKS },
        {
          kind: "computed",
          key: "result",
          label: "Ready to launch?",
          big: true,
          compute: (d) => {
            const s = state(d, "checks");
            const passed = LAUNCH_CHECKS.filter((c) => s[c.key]?.result === "pass").length;
            return passed === LAUNCH_CHECKS.length ? "Yes: all eight pass" : `Not yet: ${passed} of 8 pass`;
          },
        },
      ],
    },
  ],
  completeCheck: (d) => {
    const s = state(d, "checks");
    const failing = LAUNCH_CHECKS.filter((c) => s[c.key]?.result !== "pass");
    return failing.length ? `All eight must pass before this is complete. Still open: ${failing.map((c) => c.label.split(",")[0]).join("; ")}.` : null;
  },
};

export const course09Worksheets = [weekendTracker, launchChecklist];
