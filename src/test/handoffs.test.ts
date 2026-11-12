import { describe, expect, it } from "vitest";
import { pageFromRecord, recordFromPage } from "@/content/worksheets/c05";
import { icpFromOffer, icpParagraph } from "@/content/worksheets/c08";
import { sweepHandles } from "@/content/worksheets/c04";
import { hoursSavedTracker } from "@/content/worksheets/c11";

describe("One shared offer", () => {
  const rec = {
    headline: "Old headline",
    proof: ["Cut errors 38%"],
    tiers: [{ name: "A", price: "$1", scope: "x", default: false }],
    buyer: { situation: "Owner" },
    stage_reached: 5,
  };
  it("shows the stored offer on the page", () => {
    const d = pageFromRecord({ offer_record: rec });
    expect(d.headline).toBe("Old headline");
    expect(d.proof).toBe("• Cut errors 38%");
    expect(d).not.toHaveProperty("promise");
  });
  it("writes page edits back without losing the rest of the offer", () => {
    const next = recordFromPage({ headline: "New headline", proof: "• One\n- Two", promise: "" }, { offer_record: rec })!;
    expect(next.headline).toBe("New headline");
    expect(next.proof).toEqual(["One", "Two"]);
    expect(next.buyer).toEqual({ situation: "Owner" });
    expect(next.stage_reached).toBe(5);
    expect(recordFromPage(pageFromRecord({ offer_record: rec }), { offer_record: rec })).toBeNull();
  });
});

describe("ICP Worksheet", () => {
  it("starts from the Course 05 buyer", () => {
    expect(icpFromOffer({ offer_record: { buyer: { situation: "Just opened a second site", problem: "p" }, buyer_quotes: ['"We keep losing orders"'] } })).toEqual({
      trigger: "Just opened a second site",
      pain: "We keep losing orders",
    });
  });
  it("assembles a clean sentence", () => {
    expect(icpParagraph({ role: "owner", company: "a bakery", trigger: "Just got funding", pain: '"We are drowning."' })).toBe(
      'My buyer is an owner at a bakery. Right now, just got funding. In their words: "We are drowning."',
    );
    expect(icpParagraph({ role: "CFO", company: "x", trigger: "IT just left", pain: "p" })).toContain("Right now, IT just left.");
  });
});

describe("Earlier work carried forward", () => {
  it("lists the Sweep handles for the business name", () => {
    const p = {
      business_name: "Harbor",
      sweep_results: { results: [{ name: "Other", handles: [] }, { name: "Harbor", handles: [{ platform: "LinkedIn", handle: "harbor", status: "available" }] }] },
    };
    expect(sweepHandles(p)).toEqual([["LinkedIn", "@harbor", "Free when swept: claim it"]]);
    expect(sweepHandles({})).toEqual([]);
  });
  it("starts the Hours-Saved Tracker from the AI Audit top three", () => {
    const d = hoursSavedTracker.initial!({ audit_top_three: [{ task: "Invoices", hours_per_month: 8.66, workflow: "Inbox triage and replies" }] });
    expect(d.workflows).toEqual([{ name: "Invoices: Inbox triage and replies", source: "AI Audit Tracker", hours_week: 2, running: "" }]);
  });
});

describe("Local dates", () => {
  it("dates an evening save in the member's own day, not UTC", async () => {
    const { dayIn } = await import("@/lib/tz");
    const evening = new Date("2026-11-11T23:40:00-05:00"); // 11:40 PM in New York is already Nov 12 in UTC
    expect(evening.toISOString().slice(0, 10)).toBe("2026-11-12");
    expect(dayIn("America/New_York", evening)).toBe("2026-11-11");
    expect(dayIn("America/Los_Angeles", new Date("2026-11-12T02:40:00Z"))).toBe("2026-11-11");
  });
});

describe("Calendar files", () => {
  it("puts each trigger on the first of its month, plus monthly runway updates", async () => {
    const { decisionEvents, toIcs } = await import("@/lib/calendar");
    const ev = decisionEvents({ quit_decision: { triggers: [{ condition: "Two signed retainers", target_month: "2027-03" }] } }, "2026-11-12");
    expect(ev[0]).toMatchObject({ date: "2027-03-01", title: "Quit-or-stay check: Two signed retainers" });
    expect(ev[1]).toMatchObject({ date: "2026-12-01", rrule: "FREQ=MONTHLY;COUNT=12" });
    const ics = toIcs("Late Founders", ev);
    expect(ics).toContain("DTSTART;VALUE=DATE:20270301");
    expect(ics).toContain("DTEND;VALUE=DATE:20270302");
  });
  it("starts campaign logging next Monday", async () => {
    const { campaignEvents } = await import("@/lib/calendar");
    expect(campaignEvents({}, "2026-11-12")[0].date).toBe("2026-11-16");
  });
});
