import { describe, expect, it } from "vitest";

import { calculatePrintCount } from "@/lib/printing";

describe("calculatePrintCount", () => {
  it("adds one reserve copy by default", () => {
    expect(calculatePrintCount(90)).toBe(91);
    expect(calculatePrintCount(37)).toBe(38);
  });

  it("supports an explicit reserve count", () => {
    expect(calculatePrintCount(50, 2)).toBe(52);
  });

  it("rejects invalid counts", () => {
    expect(() => calculatePrintCount(-1)).toThrow();
    expect(() => calculatePrintCount(20.5)).toThrow();
  });
});
