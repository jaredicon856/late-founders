import { afterEach, describe, expect, it } from "vitest";
import { courseStatus, nextAsset, unlockedCourses, type StatusMap } from "@/lib/assets";
import { COURSES } from "@/content/catalog";

const done = (ids: string[]): StatusMap => Object.fromEntries(ids.map((id) => [id, { status: "complete" as const, updatedAt: new Date() }]));
const course = (n: number) => COURSES.find((c) => c.number === n)!.assets;

describe("course progress", () => {
  afterEach(() => delete process.env.UNLOCK_ALL_COURSES);

  it("opens only Course 01 before the diagnostic", () => {
    expect([...unlockedCourses({}, {})]).toEqual([1]);
    expect(nextAsset({}, {})?.id).toBe("founder-diagnostic");
  });

  it("opens the next course on the route when the previous one is complete", () => {
    const p = { founder_type: "Fresh Start" };
    expect(unlockedCourses(p, done(course(1))).has(2)).toBe(true);
    expect(unlockedCourses(p, done(course(1))).has(3)).toBe(false);
  });

  it("routes a Buried Founder to Course 12 after Course 02", () => {
    const p = { founder_type: "Buried Founder" };
    const open = unlockedCourses(p, done([...course(1), ...course(2)]));
    expect(open.has(12)).toBe(true);
    expect(open.has(3)).toBe(false);
  });

  it("reports course status", () => {
    expect(courseStatus(1, done(course(1)))).toBe("complete");
    expect(courseStatus(1, done(["founder-diagnostic"]))).toBe("in_progress");
    expect(courseStatus(1, {})).toBe("not_started");
  });

  it("can open everything for testing", () => {
    process.env.UNLOCK_ALL_COURSES = "true";
    expect(unlockedCourses({}, {}).size).toBe(COURSES.length);
  });
});
