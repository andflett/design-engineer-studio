import { describe, it, expect } from "vitest";
import {
  parseOklch,
  formatOklch,
  contrastRatio,
  contrastLevel,
  parseHsl,
} from "./oklch.js";

describe("parseOklch", () => {
  it("parses oklch with percentage lightness", () => {
    const result = parseOklch("oklch(75% 0.15 240)");
    expect(result).toEqual({ l: 75, c: 0.15, h: 240 });
  });

  it("parses oklch with fractional lightness (0-1)", () => {
    const result = parseOklch("oklch(0.75 0.15 240)");
    expect(result).toEqual({ l: 75, c: 0.15, h: 240 });
  });

  it("parses oklch with integer lightness > 1 (treated as %)", () => {
    const result = parseOklch("oklch(75 0.15 240)");
    // lightness > 1 and no %, so stays as-is
    expect(result).toEqual({ l: 75, c: 0.15, h: 240 });
  });

  it("returns null for non-oklch string", () => {
    expect(parseOklch("rgb(255, 0, 0)")).toBeNull();
    expect(parseOklch("not a color")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseOklch("")).toBeNull();
  });
});

describe("formatOklch", () => {
  it("formats an oklch color", () => {
    const result = formatOklch({ l: 75, c: 0.15, h: 240 });
    expect(result).toBe("oklch(75.00% 0.1500 240.00)");
  });

  it("formats with proper decimal places", () => {
    const result = formatOklch({ l: 50.123, c: 0.1234, h: 180.5 });
    expect(result).toBe("oklch(50.12% 0.1234 180.50)");
  });
});

describe("contrastRatio", () => {
  it("returns 21:1 for black vs white", () => {
    const ratio = contrastRatio(100, 0);
    expect(ratio).toBeCloseTo(21, 0);
  });

  it("returns 1:1 for same lightness", () => {
    expect(contrastRatio(50, 50)).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio(75, 25)).toBe(contrastRatio(25, 75));
  });
});

describe("contrastLevel", () => {
  it("returns AAA for ratio >= 7", () => {
    expect(contrastLevel(7)).toBe("AAA");
    expect(contrastLevel(10)).toBe("AAA");
  });

  it("returns AA for ratio >= 4.5", () => {
    expect(contrastLevel(4.5)).toBe("AA");
    expect(contrastLevel(6.9)).toBe("AA");
  });

  it("returns AA-large for ratio >= 3", () => {
    expect(contrastLevel(3)).toBe("AA-large");
    expect(contrastLevel(4.4)).toBe("AA-large");
  });

  it("returns fail for ratio < 3", () => {
    expect(contrastLevel(2.9)).toBe("fail");
    expect(contrastLevel(1)).toBe("fail");
  });
});

describe("parseHsl", () => {
  it("parses hsl function", () => {
    const result = parseHsl("hsl(200 50% 60%)");
    expect(result).toEqual({ h: 200, s: 50, l: 60 });
  });

  it("parses bare hsl values", () => {
    const result = parseHsl("200 50% 60%");
    expect(result).toEqual({ h: 200, s: 50, l: 60 });
  });

  it("returns null for invalid input", () => {
    expect(parseHsl("rgb(255, 0, 0)")).toBeNull();
    expect(parseHsl("")).toBeNull();
  });
});
