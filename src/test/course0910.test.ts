import { describe, expect, it } from "vitest";
import { LAUNCH_CHECKS, launchChecklist } from "@/content/worksheets/c09";
import { discoverySheet, starterScripts } from "@/content/worksheets/c10";

describe("8-Point Launch Checklist", () => {
  it("cannot complete until all eight pass", () => {
    const seven = Object.fromEntries(LAUNCH_CHECKS.slice(0, 7).map((c) => [c.key, { result: "pass" }]));
    expect(launchChecklist.completeCheck!({ checks: seven }, {})).toMatch(/Still open: Every link/);
    const all = Object.fromEntries(LAUNCH_CHECKS.map((c) => [c.key, { result: "pass" }]));
    expect(launchChecklist.completeCheck!({ checks: all }, {})).toBeNull();
  });
});

describe("Discovery Question Sheet", () => {
  it("labels each saved version with the prospect", () => {
    expect(discoverySheet.versionLabel!({ prospect: "Dana Ruiz", company: "Reno Foods" })).toBe("Dana Ruiz, Reno Foods");
  });
  it("needs the gap in one line before completing", () => {
    expect(discoverySheet.completeCheck!({ prospect: "Dana" }, {})).toMatch(/gap/);
  });
});

describe("Objection-Handling Script Library", () => {
  it("starts every slot with a draft, using the offer's price when there is one", () => {
    const s = starterScripts({ offer_record: { package: { price: "$4,500" } } });
    expect(s.price_line).toContain("$4,500");
    expect(s.too_expensive).toBeTruthy();
  });
});
