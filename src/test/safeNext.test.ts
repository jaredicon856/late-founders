import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safeNext";

describe("login return path", () => {
  it("keeps a tool link from Skool", () => {
    expect(safeNext("/assets/interview-script-generator")).toBe("/assets/interview-script-generator");
  });

  it("never sends a member to another website", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "evil", "", null, 42]) {
      expect(safeNext(bad)).toBeNull();
    }
  });

  it("never loops back to the login page", () => {
    expect(safeNext("/login?next=/x")).toBeNull();
  });
});
