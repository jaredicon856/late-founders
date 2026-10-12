import { describe, expect, it } from "vitest";
import { DEFAULT_DAILY_LIMIT, dailyLimit, limitMessage } from "@/lib/assistant/limit";

describe("Assistant daily cap", () => {
  it("defaults when unset or invalid", () => {
    for (const raw of [undefined, "", "abc", "0", "-5"]) expect(dailyLimit(raw)).toBe(DEFAULT_DAILY_LIMIT);
  });
  it("reads a configured limit", () => {
    expect(dailyLimit("40")).toBe(40);
    expect(dailyLimit("40.9")).toBe(40);
  });
  it("tells the member when they can send again", () => {
    const now = new Date("2026-10-12T12:00:00Z");
    expect(limitMessage(100, new Date("2026-10-12T02:30:00Z"), now)).toContain("about 15 hours");
    expect(limitMessage(100, new Date("2026-10-11T12:30:00Z"), now)).toContain("about 1 hour.");
  });
});
