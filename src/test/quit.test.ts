import { describe, expect, it } from "vitest";
import { coverage, decide, monthlyBurn, mvi, openRisks, personalGap, scenarios, type DecisionInputs } from "@/content/quit";

const sheet = {
  fixed_costs: [{ label: "Mortgage", monthly: 2000 }, { label: "Insurance", monthly: 300 }],
  variable_costs: [{ label: "Groceries", month1: 600, month2: 700, month3: 800 }],
  annual_costs: [{ label: "Property tax", yearly: 2400 }],
  guaranteed_income: 1000,
  se_tax_pct: 25,
  health_premium: 900,
  overhead: 200,
  reserve: 30000,
  committed_revenue: 1000,
};

describe("Runway Calculator", () => {
  it("averages variable costs and spreads annual costs over twelve months", () => {
    expect(monthlyBurn(sheet)).toBe(2000 + 300 + 700 + 200);
  });
  it("puts MVI above the simple personal gap, with tax grossed up", () => {
    const gap = personalGap(sheet)!;
    expect(gap).toBe(2200);
    // (2200 + 900 + 200) / (1 - 0.25)
    expect(mvi(sheet)).toBe(4400);
    expect(mvi(sheet)!).toBeGreaterThan(gap);
  });
  it("returns months of coverage for each way out", () => {
    const s = scenarios({ ...sheet, reduced_w2: 1500, business_income: 1000, current_income: 5000, side_income: 500 })!;
    expect(s.cold_turkey.months).toBe(8.8); // 30000 / (4400 - 1000) = 8.82
    expect(s.phased_exit.months).toBe(15.7); // 30000 / (4400 - 2500) = 15.79
    expect(s.stay_and_build.months).toBeNull(); // 5500 covers a 3200 burn
  });
  it("reports covered when income meets the need", () => {
    expect(coverage(0, 5000, 4000).months).toBeNull();
  });
});

describe("Risk Inventory", () => {
  it("counts open rows and an unsettled health plan", () => {
    const open = openRisks({
      dependents: [{ name: "Sam", needs: "tuition", hard_deadline: "yes", status: "Open" }, { name: "Ana", status: "Closed" }, {}],
      health_status: "",
      debts: [{ creditor: "Visa", minimum: 200, liability: "Personal" }],
    });
    expect(open).toHaveLength(3);
    expect(open[0]).toContain("hard deadline");
  });
  it("is clear when everything is closed", () => {
    expect(openRisks({ health_status: "Closed" })).toEqual([]);
  });
});

describe("Decision Engine", () => {
  const base: DecisionInputs = { founder_type: "Fresh Start", freedom_number: 9000, monthly_burn: 3200, mvi: 4400, committed_revenue: 0, reserve: 0, open_risk_count: 0 };
  it("quits now once signed revenue meets MVI and nothing is open", () => {
    expect(decide({ ...base, committed_revenue: 4400 }).band).toBe("Quit now");
  });
  it("names every gap to the next band", () => {
    const d = decide({ ...base, committed_revenue: 500, reserve: 10000, open_risk_count: 4 });
    expect(d.band).toBe("Stay and build");
    expect(d.gaps).toHaveLength(3);
  });
  it("asks a First-Timer for three more months of cover", () => {
    const i = { ...base, committed_revenue: 2200, reserve: 2200 * 13 };
    expect(decide(i).band).toBe("Quit now");
    expect(decide({ ...i, founder_type: "First-Timer" }).band).toBe("Quit in three to six months");
  });
});
