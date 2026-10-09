import { describe, expect, it } from "vitest";
import { domainCandidates, domainFlag, hyphenated, similarity, slug } from "@/lib/sweep";

describe("availability sweep helpers", () => {
  it("normalises names", () => {
    expect(slug("Ledger & Co.")).toBe("ledgerco");
    expect(hyphenated("Ledger & Co")).toBe("ledger-co");
  });

  it("offers a hyphenated .com only for multi-word names", () => {
    expect(domainCandidates("Ledgerly").some((d) => d.variant === "hyphenated")).toBe(false);
    expect(domainCandidates("Ledger Lane").find((d) => d.variant === "hyphenated")?.domain).toBe("ledger-lane.com");
  });

  it("flags when only altered domains are free", () => {
    expect(
      domainFlag([
        { domain: "x.com", status: "taken", variant: "exact" },
        { domain: "getx.com", status: "available", variant: "close" },
      ]),
    ).toMatch(/Only altered versions/);
    expect(domainFlag([{ domain: "x.com", status: "available", variant: "exact" }])).toBeNull();
    // A failed check is never reported as a clear.
    expect(domainFlag([{ domain: "x.com", status: "unknown", variant: "exact" }])).toBeNull();
  });

  it("scores similarity", () => {
    expect(similarity("Ledgerly", "LEDGERLY")).toBe(100);
    expect(similarity("Ledgerly", "Ledgerlee")).toBeGreaterThan(70);
    expect(similarity("Ledgerly", "Bloom")).toBeLessThan(30);
  });
});
