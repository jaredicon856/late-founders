import { describe, expect, it } from "vitest";
import { ninetyDayCommitment } from "@/content/worksheets/c02";

describe("90 Day Commitment dates", () => {
  const derive = ninetyDayCommitment.derive!;
  it("sets the end date 90 days after the start", () => {
    expect(derive("start_date", { start_date: "2026-11-05" })).toEqual({ end_date: "2027-02-03" });
  });
  it("moves an end date that lands before the start", () => {
    expect(derive("end_date", { start_date: "2026-11-05", end_date: "2026-10-01" })).toEqual({ end_date: "2027-02-03" });
  });
  it("keeps an end date the member chose after the start", () => {
    expect(derive("end_date", { start_date: "2026-11-05", end_date: "2027-03-01" })).toEqual({});
  });
  it("does nothing without a start date", () => {
    expect(derive("start_date", { start_date: "" })).toEqual({});
  });
});
