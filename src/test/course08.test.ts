import { describe, expect, it } from "vitest";
import { sequenceGenerator } from "@/content/modes/c08";
import { changeProblems, icpParagraph, icpWorksheet, weakest, weekRates } from "@/content/worksheets/c08";

describe("ICP Worksheet", () => {
  const icp = { role: "operations director", company: "a 40-person food distributor", trigger: "they just opened a second warehouse", pain: "we keep shipping the wrong pallets" };
  it("assembles one readable paragraph", () => {
    expect(icpParagraph(icp)).toBe('My buyer is an operations director at a 40-person food distributor. Right now, they just opened a second warehouse. In their words: "we keep shipping the wrong pallets."');
  });
  it("refuses to complete without the trigger condition", () => {
    expect(icpWorksheet.completeCheck!({ ...icp, trigger: "" }, {})).toMatch(/trigger condition is required/);
    expect(icpWorksheet.completeCheck!(icp, {})).toBeNull();
  });
});

describe("Campaign Metrics Tracker", () => {
  it("computes reply rates per step and flags the weakest against its benchmark", () => {
    const r = weekRates({ sent: 100, accepted: 40, replies_opener: 6, replies_value: 1, replies_cta: 3, booked: 3, held: 3 });
    expect(r).toMatchObject({ acceptance: 40, reply_opener: 15, reply_value: 2.5, reply_cta: 7.5, booking: 30, show: 100 });
    expect(weakest(r)?.key).toBe("reply_value");
  });
  it("flags two changes inside two weeks", () => {
    expect(changeProblems({ changes: [{ date: "2026-11-01", change: "New request" }, { date: "2026-11-08", change: "New opener" }] })).toHaveLength(1);
    expect(changeProblems({ changes: [{ date: "2026-11-01", change: "New request" }, { date: "2026-11-15", change: "New opener" }] })).toHaveLength(0);
  });
});

describe("Message-Sequence Generator", () => {
  const profile = { icp_paragraph: "My buyer is an operations director." };
  const good = {
    request: "Hi Dana, saw you opened the second warehouse in Reno. I ran two sites for years and remember that first quarter well. Would be good to connect.",
    opener: "Congrats on Reno. Are you running both sites off the same pick lists, or did you split them?",
    value: "One thing that saved us: a two-line pallet label check before loading. It cut wrong shipments by a third in a month. Here is the exact wording we used: [paste].",
    cta: "Did the label check fit how your team loads? If the timing is wrong, no problem at all.",
    value_test: "It is a usable fix they can apply today without replying.",
    delays: { before_opener: 3, before_value: 4, before_cta: 5 },
  };
  it("saves a sequence that follows the four jobs", () => {
    expect(sequenceGenerator.onSave(good, profile).profile.message_sequence).toBeTruthy();
  });
  it("rejects a pitch or a link", () => {
    expect(() => sequenceGenerator.onSave({ ...good, request: "Hi Dana, I help distributors fix shipping. Let's connect." }, profile)).toThrow(/pitches/);
    expect(() => sequenceGenerator.onSave({ ...good, cta: "Grab a time here: https://calendly.com/me?" }, profile)).toThrow(/link/);
  });
  it("needs a question in the soft CTA and 3 to 5 day delays", () => {
    expect(() => sequenceGenerator.onSave({ ...good, cta: "Let me know." }, profile)).toThrow(/question/);
    expect(() => sequenceGenerator.onSave({ ...good, delays: { before_opener: 1, before_value: 4, before_cta: 5 } }, profile)).toThrow(/3 to 5 days/);
  });
});
