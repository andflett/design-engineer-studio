import { describe, it, expect } from "vitest";
import { classifyCssProperties } from "./css-scale-classifier.js";

describe("classifyCssProperties", () => {
  it("returns null when no properties match any prefix", () => {
    const result = classifyCssProperties([
      { name: "--color-primary", value: "#ff0000" },
      { name: "--custom-thing", value: "42px" },
    ]);
    expect(result).toBeNull();
  });

  it("returns null when matching groups have fewer than 2 entries", () => {
    const result = classifyCssProperties([
      { name: "--space-sm", value: "4px" },
    ]);
    expect(result).toBeNull();
  });

  it("classifies --space-* variables into spacing scale", () => {
    const result = classifyCssProperties([
      { name: "--space-sm", value: "4px" },
      { name: "--space-md", value: "8px" },
      { name: "--space-lg", value: "16px" },
    ]);
    expect(result).not.toBeNull();
    expect(result!.spacing).toEqual([
      { key: "sm", value: "4px" },
      { key: "md", value: "8px" },
      { key: "lg", value: "16px" },
    ]);
    expect(result!.varPrefixes?.spacing).toBe("--space");
  });

  it("classifies --spacing-* variables into spacing scale", () => {
    const result = classifyCssProperties([
      { name: "--spacing-xs", value: "2px" },
      { name: "--spacing-sm", value: "4px" },
    ]);
    expect(result).not.toBeNull();
    expect(result!.spacing).toEqual([
      { key: "xs", value: "2px" },
      { key: "sm", value: "4px" },
    ]);
    expect(result!.varPrefixes?.spacing).toBe("--spacing");
  });

  it("classifies --text-* variables into fontSize scale", () => {
    const result = classifyCssProperties([
      { name: "--text-sm", value: "0.875rem" },
      { name: "--text-base", value: "1rem" },
      { name: "--text-lg", value: "1.125rem" },
    ]);
    expect(result).not.toBeNull();
    expect(result!.fontSize).toEqual([
      { key: "sm", value: "0.875rem" },
      { key: "base", value: "1rem" },
      { key: "lg", value: "1.125rem" },
    ]);
    expect(result!.varPrefixes?.fontSize).toBe("--text");
  });

  it("classifies --font-size-* variables into fontSize scale", () => {
    const result = classifyCssProperties([
      { name: "--font-size-body", value: "1rem" },
      { name: "--font-size-heading", value: "2rem" },
    ]);
    expect(result).not.toBeNull();
    expect(result!.fontSize).toEqual([
      { key: "body", value: "1rem" },
      { key: "heading", value: "2rem" },
    ]);
    expect(result!.varPrefixes?.fontSize).toBe("--font-size");
  });

  it("classifies --font-weight-* variables into fontWeight scale", () => {
    const result = classifyCssProperties([
      { name: "--font-weight-normal", value: "400" },
      { name: "--font-weight-bold", value: "700" },
    ]);
    expect(result).not.toBeNull();
    expect(result!.fontWeight).toEqual([
      { key: "normal", value: "400" },
      { key: "bold", value: "700" },
    ]);
  });

  it("classifies --radius-* variables into borderRadius scale", () => {
    const result = classifyCssProperties([
      { name: "--radius-sm", value: "0.25rem" },
      { name: "--radius-md", value: "0.5rem" },
      { name: "--radius-lg", value: "1rem" },
    ]);
    expect(result).not.toBeNull();
    expect(result!.borderRadius).toEqual([
      { key: "sm", value: "0.25rem" },
      { key: "md", value: "0.5rem" },
      { key: "lg", value: "1rem" },
    ]);
  });

  it("filters out --text-shadow-* entries", () => {
    const result = classifyCssProperties([
      { name: "--text-sm", value: "0.875rem" },
      { name: "--text-base", value: "1rem" },
      { name: "--text-shadow-sm", value: "0 1px 2px rgba(0,0,0,0.1)" },
      { name: "--text-shadow-lg", value: "0 4px 8px rgba(0,0,0,0.2)" },
    ]);
    expect(result).not.toBeNull();
    expect(result!.fontSize).toEqual([
      { key: "sm", value: "0.875rem" },
      { key: "base", value: "1rem" },
    ]);
  });

  it("filters out --text-*--line-height companion entries", () => {
    const result = classifyCssProperties([
      { name: "--text-sm", value: "0.875rem" },
      { name: "--text-base", value: "1rem" },
      { name: "--text-sm--line-height", value: "1.25rem" },
      { name: "--text-base--line-height", value: "1.5rem" },
    ]);
    expect(result).not.toBeNull();
    // companion entries (keys with --) should be filtered
    expect(result!.fontSize).toEqual([
      { key: "sm", value: "0.875rem" },
      { key: "base", value: "1rem" },
    ]);
  });

  it("filters out groups where all values are colors", () => {
    const result = classifyCssProperties([
      { name: "--text-primary", value: "#333333" },
      { name: "--text-secondary", value: "rgb(100, 100, 100)" },
      { name: "--space-sm", value: "4px" },
      { name: "--space-md", value: "8px" },
    ]);
    expect(result).not.toBeNull();
    // fontSize group should be filtered (all colors)
    expect(result!.fontSize).toEqual([]);
    // spacing group should remain
    expect(result!.spacing.length).toBe(2);
  });

  it("handles mixed scales from the same set of properties", () => {
    const result = classifyCssProperties([
      { name: "--space-sm", value: "4px" },
      { name: "--space-md", value: "8px" },
      { name: "--text-sm", value: "0.875rem" },
      { name: "--text-base", value: "1rem" },
      { name: "--radius-sm", value: "4px" },
      { name: "--radius-lg", value: "8px" },
    ]);
    expect(result).not.toBeNull();
    expect(result!.spacing.length).toBe(2);
    expect(result!.fontSize.length).toBe(2);
    expect(result!.borderRadius.length).toBe(2);
    expect(result!.varPrefixes?.spacing).toBe("--space");
    expect(result!.varPrefixes?.fontSize).toBe("--text");
    expect(result!.varPrefixes?.borderRadius).toBe("--radius");
  });

  it("handles oklch color values in filter", () => {
    const result = classifyCssProperties([
      { name: "--text-primary", value: "oklch(0.6 0.2 250)" },
      { name: "--text-secondary", value: "oklch(0.7 0.1 200)" },
    ]);
    // All fontSize entries are colors → filtered → no scales remain → null
    expect(result).toBeNull();
  });

  it("classifies --leading-* into lineHeight", () => {
    const result = classifyCssProperties([
      { name: "--leading-tight", value: "1.2" },
      { name: "--leading-normal", value: "1.5" },
      { name: "--leading-loose", value: "2" },
    ]);
    expect(result).not.toBeNull();
    expect(result!.lineHeight).toEqual([
      { key: "tight", value: "1.2" },
      { key: "normal", value: "1.5" },
      { key: "loose", value: "2" },
    ]);
  });

  it("classifies --tracking-* into letterSpacing", () => {
    const result = classifyCssProperties([
      { name: "--tracking-tight", value: "-0.02em" },
      { name: "--tracking-wide", value: "0.05em" },
    ]);
    expect(result).not.toBeNull();
    expect(result!.letterSpacing).toEqual([
      { key: "tight", value: "-0.02em" },
      { key: "wide", value: "0.05em" },
    ]);
  });

  it("classifies --shadow-* into boxShadow", () => {
    const result = classifyCssProperties([
      { name: "--shadow-sm", value: "0 1px 2px rgba(0,0,0,0.05)" },
      { name: "--shadow-md", value: "0 4px 6px rgba(0,0,0,0.1)" },
    ]);
    expect(result).not.toBeNull();
    expect(result!.boxShadow).toEqual([
      { key: "sm", value: "0 1px 2px rgba(0,0,0,0.05)" },
      { key: "md", value: "0 4px 6px rgba(0,0,0,0.1)" },
    ]);
    expect(result!.varPrefixes?.boxShadow).toBe("--shadow");
  });

  it("classifies --opacity-* into opacity", () => {
    const result = classifyCssProperties([
      { name: "--opacity-dim", value: "0.3" },
      { name: "--opacity-full", value: "1" },
    ]);
    expect(result).not.toBeNull();
    expect(result!.opacity).toEqual([
      { key: "dim", value: "0.3" },
      { key: "full", value: "1" },
    ]);
  });
});
