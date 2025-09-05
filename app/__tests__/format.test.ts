import { describe, it, expect } from "vitest";
import { formatUSD } from "../utils/format";

describe("formatUSD", () => {
  it("formats positive numbers with two decimals and separators", () => {
    expect(formatUSD(1234.567)).toBe("$1,234.57");
    expect(formatUSD(0)).toBe("$0.00");
  });

  it("handles large numbers", () => {
    expect(formatUSD(9876543.21)).toBe("$9,876,543.21");
  });

  it("returns em dash for null/undefined/non-finite", () => {
    expect(formatUSD(undefined)).toBe("—");
    expect(formatUSD(null as unknown as number)).toBe("—");
    expect(formatUSD(NaN)).toBe("—");
    expect(formatUSD(Infinity)).toBe("—");
  });
});

