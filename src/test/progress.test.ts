import { describe, expect, it } from "vitest";
import { courseStatus, nextAsset, type StatusMap } from "@/lib/assets";
import { COURSES } from "@/content/catalog";

const done = (ids: string[]): StatusMap => Object.fromEntries(ids.map((id) => [id, { status: "complete" as const, updatedAt: new Date() }]));
const course = (n: number) => COURSES.find((c) => c.number === n)!.assets;

describe("course progress", () => {
  it("points a new member at the Founder Diagnostic", () => {
    expect(nextAsset({}, {})?.id).toBe("founder-diagnostic");
  });

  it("recommends the next unfinished asset along the member's route", () => {
    const p = { founder_type: "Fresh Start" };
    expect(nextAsset(p, done(course(1)))?.id).toBe("hidden-assets-inventory");
    expect(nextAsset(p, done([...course(1), ...course(2)]))?.course).toBe(3);
  });

  it("routes a Buried Founder to Course 12 after Course 02", () => {
    const p = { founder_type: "Buried Founder" };
    expect(nextAsset(p, done([...course(1), ...course(2)]))?.course).toBe(12);
  });

  it("returns nothing when every course is complete", () => {
    expect(nextAsset({ founder_type: "Fresh Start" }, done(COURSES.flatMap((c) => c.assets)))).toBeNull();
  });

  it("reports course status", () => {
    expect(courseStatus(1, done(course(1)))).toBe("complete");
    expect(courseStatus(1, done(["founder-diagnostic"]))).toBe("in_progress");
    expect(courseStatus(1, {})).toBe("not_started");
  });
});
