import { describe, expect, it } from "vitest";
import { profileAudit } from "@/content/modes/c07";
import { PILLARS, ROTATION, angleStatement, contentPillars, prefilledCalendar } from "@/content/worksheets/c07";

describe("Content Pillar Worksheet", () => {
  const parts = { angle_experience: "25 years running warehouses", angle_pov: "most firms automate the wrong jobs first", angle_audience: "owners of distribution firms" };
  it("assembles the angle statement from three parts, and prefers the member's rewrite", () => {
    expect(angleStatement(parts)).toBe("After 25 years running warehouses, I believe most firms automate the wrong jobs first, and I write for owners of distribution firms.");
    expect(angleStatement({ ...parts, angle_final: "My own words." })).toBe("My own words.");
  });
  it("will not complete without an idea for every pillar", () => {
    expect(contentPillars.completeCheck!({ ...parts, pillars: [{ idea: "x" }] }, {})).toMatch(/Authority/);
    expect(contentPillars.completeCheck!({ ...parts, pillars: PILLARS.map(() => ({ idea: "x" })) }, {})).toBeNull();
  });
});

describe("4-Week Content Calendar", () => {
  it("never opens empty: three posts a week, every pillar at least twice", () => {
    for (const p of PILLARS) expect(ROTATION.filter((r) => r[2] === p).length).toBeGreaterThanOrEqual(2);
    for (const w of [1, 2, 3, 4]) expect(ROTATION.filter((r) => r[0] === w)).toHaveLength(3);
  });
  it("drops each pillar's idea into its first slot", () => {
    const cal = prefilledCalendar({ content_pillars: { Lessons: "The lease I should not have signed" } });
    expect(cal[0]).toMatchObject({ pillar: "Lessons", idea: "The lease I should not have signed" });
    expect(cal.filter((s) => s.idea)).toHaveLength(1);
  });
});

describe("Profile-Audit AI", () => {
  const section = (rewrite: string, score = 6) => ({ provided: true, score, issue: "Too vague.", rewrite });
  const good = {
    headline_parts: { who: "owners of trades firms", outcome: "step out of the day-to-day", credibility: "30 years running crews" },
    about_parts: { problem: "p", credibility_bridge: "c", who_and_mechanism: "w", proof: "p", closing: "c" },
    sections: {
      headline: section("Helping owners of trades firms step out of the day-to-day | 30 years running crews"),
      banner: section("b"), about: section(""), experience: section("Cut delivery errors 38% across three sites", 4),
      featured: section("f", 3), skills: section("s"), activity: section("a"), recommendations: section("r", 8),
    },
  };
  it("flags the lowest-scoring section", () => {
    expect(profileAudit.onSave(good, {}).summary).toContain("fix Featured first");
  });
  it("rejects a headline that is only a job title", () => {
    expect(() => profileAudit.onSave({ ...good, sections: { ...good.sections, headline: section("VP Operations at Acme") } }, {})).toThrow(/job title/);
  });
  it("rejects experience without numbers", () => {
    expect(() => profileAudit.onSave({ ...good, sections: { ...good.sections, experience: section("Responsible for logistics") } }, {})).toThrow(/numbers/);
  });
});
