import { describe, expect, it } from "vitest";
import { aiAuditTracker, hoursSaved, hoursSavedTracker, rankTargets } from "@/content/worksheets/c11";

const R = "Recurring and repetitive";

describe("AI Audit Tracker", () => {
  it("ranks by hours a month, not by order or irritation", () => {
    const t = rankTargets({
      log: [
        { task: "Client recap email", minutes: 20, bucket: R, workflow: "Content repurposing" },
        { task: "client recap email", minutes: 30, bucket: R },
        { task: "Invoice chasing", minutes: 15, bucket: R, per_month: 40 },
        { task: "Strategy call", minutes: 60, bucket: "Recurring and judgment-based" },
        { task: "Fix the printer", minutes: 90, bucket: "One-off" },
      ],
    });
    expect(t.map((x) => x.task)).toEqual(["Invoice chasing", "Client recap email"]);
    expect(t[0].hours_per_month).toBe(10); // 15 min x 40
    expect(t[1].times_per_month).toBe(9); // logged twice in five days, scaled to a month
    expect(t[1].workflow).toBe("Content repurposing");
  });
  it("will not complete with nothing to rank", () => {
    expect(aiAuditTracker.completeCheck!({}, {})).toMatch(/Recurring and repetitive/);
  });
});

describe("Hours-Saved Tracker", () => {
  const data = {
    workflows: [
      { name: "Inbox sort", hours_week: 2, running: "yes" },
      { name: "Pre-call briefs", hours_week: 1.5, running: "yes" },
      { name: "Auto-posting", hours_week: 3, running: "no" },
    ],
  };
  it("totals only workflows actually running and counts the rest", () => {
    expect(hoursSaved(data)).toMatchObject({ weekly: 3.5, running: 2, excluded: 1 });
  });
  it("needs a destination for the time before completing", () => {
    expect(hoursSavedTracker.completeCheck!(data, {})).toMatch(/what the reclaimed time is for/);
    expect(hoursSavedTracker.completeCheck!({ ...data, destination: "Tuesday 9-11 sales calls" }, {})).toBeNull();
  });
});
