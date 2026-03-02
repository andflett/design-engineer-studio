import { describe, it, expect } from "vitest";
import {
  computedToTailwindClass,
  uniformBoxToTailwind,
  axisBoxToTailwind,
  uniformRadiusToTailwind,
  matchValueToToken,
  matchColorToToken,
} from "./tailwind-map.js";
import type { ResolvedTailwindTheme } from "./tailwind-theme.js";

describe("computedToTailwindClass", () => {
  describe("direct lookups", () => {
    it("maps font-size px to tailwind class", () => {
      expect(computedToTailwindClass("font-size", "16px")).toEqual({ tailwindClass: "text-base", exact: true });
      expect(computedToTailwindClass("font-size", "1rem")).toEqual({ tailwindClass: "text-base", exact: true });
    });

    it("maps font-weight to tailwind class", () => {
      expect(computedToTailwindClass("font-weight", "700")).toEqual({ tailwindClass: "font-bold", exact: true });
      expect(computedToTailwindClass("font-weight", "400")).toEqual({ tailwindClass: "font-normal", exact: true });
    });

    it("maps line-height to tailwind class", () => {
      expect(computedToTailwindClass("line-height", "1.5")).toEqual({ tailwindClass: "leading-normal", exact: true });
    });

    it("maps letter-spacing to tailwind class", () => {
      expect(computedToTailwindClass("letter-spacing", "-0.025em")).toEqual({ tailwindClass: "tracking-tight", exact: true });
    });

    it("maps display to tailwind class", () => {
      expect(computedToTailwindClass("display", "flex")).toEqual({ tailwindClass: "flex", exact: true });
      expect(computedToTailwindClass("display", "none")).toEqual({ tailwindClass: "hidden", exact: true });
    });

    it("maps flex-direction to tailwind class", () => {
      expect(computedToTailwindClass("flex-direction", "column")).toEqual({ tailwindClass: "flex-col", exact: true });
    });

    it("maps justify-content to tailwind class", () => {
      expect(computedToTailwindClass("justify-content", "space-between")).toEqual({ tailwindClass: "justify-between", exact: true });
    });

    it("maps text-align to tailwind class", () => {
      expect(computedToTailwindClass("text-align", "center")).toEqual({ tailwindClass: "text-center", exact: true });
    });
  });

  describe("spacing lookups", () => {
    it("maps spacing px values to scale classes", () => {
      expect(computedToTailwindClass("padding-top", "16px")).toEqual({ tailwindClass: "pt-4", exact: true });
      expect(computedToTailwindClass("margin-left", "8px")).toEqual({ tailwindClass: "ml-2", exact: true });
      expect(computedToTailwindClass("gap", "24px")).toEqual({ tailwindClass: "gap-6", exact: true });
    });

    it("falls back to arbitrary for non-scale spacing values", () => {
      expect(computedToTailwindClass("padding-top", "13px")).toEqual({ tailwindClass: "pt-[13px]", exact: false });
    });

    it("falls back to arbitrary for auto spacing", () => {
      const result = computedToTailwindClass("margin-top", "auto");
      expect(result).toEqual({ tailwindClass: "mt-[auto]", exact: false });
    });
  });

  describe("radius lookups", () => {
    it("maps radius px to tailwind class", () => {
      expect(computedToTailwindClass("border-top-left-radius", "8px")).toEqual({ tailwindClass: "rounded-tl-lg", exact: true });
    });

    it("falls back to arbitrary for non-scale radius", () => {
      expect(computedToTailwindClass("border-top-left-radius", "5px")).toEqual({ tailwindClass: "rounded-tl-[5px]", exact: false });
    });
  });

  describe("generic arbitrary fallback", () => {
    it("uses arbitrary for known property with unknown value", () => {
      expect(computedToTailwindClass("font-size", "15px")).toEqual({ tailwindClass: "text-[15px]", exact: false });
    });

    it("returns null for completely unknown property", () => {
      expect(computedToTailwindClass("unknown-css-prop", "foo")).toBeNull();
    });
  });
});

describe("uniformBoxToTailwind", () => {
  it("maps scale value for padding", () => {
    expect(uniformBoxToTailwind("padding", "16px")).toEqual({ tailwindClass: "p-4", exact: true });
  });

  it("maps scale value for margin", () => {
    expect(uniformBoxToTailwind("margin", "8px")).toEqual({ tailwindClass: "m-2", exact: true });
  });

  it("falls back to arbitrary", () => {
    expect(uniformBoxToTailwind("padding", "13px")).toEqual({ tailwindClass: "p-[13px]", exact: false });
  });

  it("maps 0px to scale class", () => {
    expect(uniformBoxToTailwind("padding", "0px")).toEqual({ tailwindClass: "p-0", exact: true });
  });
});

describe("axisBoxToTailwind", () => {
  it("maps both axes for padding", () => {
    const result = axisBoxToTailwind("padding", "16px", "8px");
    expect(result.xClass).toEqual({ tailwindClass: "px-4", exact: true });
    expect(result.yClass).toEqual({ tailwindClass: "py-2", exact: true });
  });

  it("maps 0px axis to scale class", () => {
    const result = axisBoxToTailwind("margin", "0px", "16px");
    expect(result.xClass).toEqual({ tailwindClass: "mx-0", exact: true });
    expect(result.yClass).toEqual({ tailwindClass: "my-4", exact: true });
  });
});

describe("uniformRadiusToTailwind", () => {
  it("maps scale radius value", () => {
    expect(uniformRadiusToTailwind("8px")).toEqual({ tailwindClass: "rounded-lg", exact: true });
  });

  it("falls back to arbitrary", () => {
    expect(uniformRadiusToTailwind("5px")).toEqual({ tailwindClass: "rounded-[5px]", exact: false });
  });

  it("maps 0px to rounded-none", () => {
    expect(uniformRadiusToTailwind("0px")).toEqual({ tailwindClass: "rounded-none", exact: true });
  });
});

describe("matchValueToToken", () => {
  const tokenGroups = {
    spacing: [
      { name: "--space-sm", category: "spacing", lightValue: "8px" },
      { name: "--space-md", category: "spacing", lightValue: "16px" },
    ],
    colors: [
      { name: "--primary", category: "color", lightValue: "rgb(59, 130, 246)" },
    ],
  };

  it("matches spacing token by value", () => {
    const result = matchValueToToken("padding-top", "16px", tokenGroups);
    expect(result).not.toBeNull();
    expect(result!.tokenName).toBe("space-md");
    expect(result!.category).toBe("spacing");
  });

  it("matches color token by rgb value", () => {
    const result = matchValueToToken("background-color", "rgb(59, 130, 246)", tokenGroups);
    expect(result).not.toBeNull();
    expect(result!.tokenName).toBe("primary");
    expect(result!.category).toBe("color");
  });

  it("returns null for unmatched value", () => {
    expect(matchValueToToken("padding-top", "99px", tokenGroups)).toBeNull();
  });

  it("returns null for auto/none", () => {
    expect(matchValueToToken("padding-top", "auto", tokenGroups)).toBeNull();
    expect(matchValueToToken("padding-top", "none", tokenGroups)).toBeNull();
  });

  it("returns null for unknown CSS property", () => {
    expect(matchValueToToken("unknown-prop", "16px", tokenGroups)).toBeNull();
  });
});

describe("matchColorToToken", () => {
  const tokenGroups = {
    colors: [
      { name: "--primary", category: "color", lightValue: "rgb(59, 130, 246)" },
      { name: "--secondary", category: "color", lightValue: "rgba(255, 0, 0, 1)" },
    ],
  };

  it("matches rgb color", () => {
    expect(matchColorToToken("rgb(59, 130, 246)", tokenGroups)).toBe("primary");
  });

  it("matches rgba with alpha=1 to rgb", () => {
    expect(matchColorToToken("rgba(255, 0, 0, 1)", tokenGroups)).toBe("secondary");
  });

  it("returns null for transparent", () => {
    expect(matchColorToToken("transparent", tokenGroups)).toBeNull();
  });

  it("returns null for unmatched color", () => {
    expect(matchColorToToken("rgb(0, 0, 0)", tokenGroups)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Theme-aware mapping tests
// ---------------------------------------------------------------------------

const customTheme: ResolvedTailwindTheme = {
  spacing: [
    { key: "sm", value: "4px" },
    { key: "md", value: "8px" },
    { key: "lg", value: "16px" },
    { key: "xl", value: "32px" },
  ],
  fontSize: [
    { key: "tiny", value: "0.625rem" },
    { key: "body", value: "1rem" },
    { key: "heading", value: "2rem" },
  ],
  fontWeight: [
    { key: "normal", value: "400" },
    { key: "bold", value: "700" },
  ],
  lineHeight: [
    { key: "tight", value: "1.2" },
    { key: "normal", value: "1.5" },
  ],
  letterSpacing: [
    { key: "tight", value: "-0.02em" },
    { key: "normal", value: "0em" },
  ],
  borderRadius: [
    { key: "sm", value: "0.25rem" },
    { key: "lg", value: "1rem" },
    { key: "full", value: "9999px" },
  ],
  borderWidth: [],
  opacity: [],
};

describe("computedToTailwindClass with custom theme", () => {
  it("maps custom spacing scale", () => {
    expect(computedToTailwindClass("padding-top", "4px", customTheme)).toEqual({
      tailwindClass: "pt-sm", exact: true,
    });
    expect(computedToTailwindClass("padding-top", "16px", customTheme)).toEqual({
      tailwindClass: "pt-lg", exact: true,
    });
  });

  it("uses default scale for spacing not in custom theme", () => {
    // 24px is in the default scale but NOT in our custom theme — merge means defaults still available
    expect(computedToTailwindClass("padding-top", "24px", customTheme)).toEqual({
      tailwindClass: "pt-6", exact: true,
    });
  });

  it("theme tokens win over defaults on collision", () => {
    // 8px maps to "2" in defaults but "md" in custom theme — theme wins
    expect(computedToTailwindClass("padding-top", "8px", customTheme)).toEqual({
      tailwindClass: "pt-md", exact: true,
    });
  });

  it("maps custom font-size scale", () => {
    expect(computedToTailwindClass("font-size", "1rem", customTheme)).toEqual({
      tailwindClass: "text-body", exact: true,
    });
    expect(computedToTailwindClass("font-size", "2rem", customTheme)).toEqual({
      tailwindClass: "text-heading", exact: true,
    });
  });

  it("maps custom font-size by px via rem→px conversion", () => {
    // 0.625rem = 10px
    expect(computedToTailwindClass("font-size", "10px", customTheme)).toEqual({
      tailwindClass: "text-tiny", exact: true,
    });
  });

  it("maps custom font-weight scale", () => {
    expect(computedToTailwindClass("font-weight", "700", customTheme)).toEqual({
      tailwindClass: "font-bold", exact: true,
    });
  });

  it("falls back to arbitrary for font-weight not in custom scale", () => {
    // 600 (semibold) is in default but not in our custom theme
    expect(computedToTailwindClass("font-weight", "600", customTheme)).toEqual({
      tailwindClass: "font-[600]", exact: false,
    });
  });

  it("maps custom line-height scale", () => {
    expect(computedToTailwindClass("line-height", "1.5", customTheme)).toEqual({
      tailwindClass: "leading-normal", exact: true,
    });
  });

  it("maps custom letter-spacing scale", () => {
    expect(computedToTailwindClass("letter-spacing", "-0.02em", customTheme)).toEqual({
      tailwindClass: "tracking-tight", exact: true,
    });
  });

  it("still uses hardcoded maps for non-overridden properties", () => {
    // display is not in the theme — should still work from REVERSE_MAP
    expect(computedToTailwindClass("display", "flex", customTheme)).toEqual({
      tailwindClass: "flex", exact: true,
    });
  });

  it("uses default maps when theme is null", () => {
    expect(computedToTailwindClass("font-size", "16px", null)).toEqual({
      tailwindClass: "text-base", exact: true,
    });
    expect(computedToTailwindClass("padding-top", "16px", null)).toEqual({
      tailwindClass: "pt-4", exact: true,
    });
  });
});

describe("uniformBoxToTailwind with custom theme", () => {
  it("maps custom spacing for padding", () => {
    expect(uniformBoxToTailwind("padding", "8px", customTheme)).toEqual({
      tailwindClass: "p-md", exact: true,
    });
  });

  it("maps custom spacing for margin", () => {
    expect(uniformBoxToTailwind("margin", "32px", customTheme)).toEqual({
      tailwindClass: "m-xl", exact: true,
    });
  });

  it("uses default scale for non-custom-scale value", () => {
    // 12px maps to "3" in defaults — merge means defaults still available
    expect(uniformBoxToTailwind("padding", "12px", customTheme)).toEqual({
      tailwindClass: "p-3", exact: true,
    });
  });

  it("uses default when theme is null", () => {
    expect(uniformBoxToTailwind("padding", "16px", null)).toEqual({
      tailwindClass: "p-4", exact: true,
    });
  });
});

describe("axisBoxToTailwind with custom theme", () => {
  it("maps custom spacing for both axes", () => {
    const result = axisBoxToTailwind("padding", "4px", "16px", customTheme);
    expect(result.xClass).toEqual({ tailwindClass: "px-sm", exact: true });
    expect(result.yClass).toEqual({ tailwindClass: "py-lg", exact: true });
  });

  it("uses default when theme is null", () => {
    const result = axisBoxToTailwind("padding", "16px", "8px", null);
    expect(result.xClass).toEqual({ tailwindClass: "px-4", exact: true });
    expect(result.yClass).toEqual({ tailwindClass: "py-2", exact: true });
  });
});

describe("uniformRadiusToTailwind with custom theme", () => {
  it("maps custom radius scale", () => {
    expect(uniformRadiusToTailwind("9999px", customTheme)).toEqual({
      tailwindClass: "rounded-full", exact: true,
    });
  });

  it("maps custom radius by rem→px conversion", () => {
    // 0.25rem = 4px, 1rem = 16px
    expect(uniformRadiusToTailwind("4px", customTheme)).toEqual({
      tailwindClass: "rounded-sm", exact: true,
    });
    expect(uniformRadiusToTailwind("16px", customTheme)).toEqual({
      tailwindClass: "rounded-lg", exact: true,
    });
  });

  it("falls back to arbitrary for non-custom-scale radius", () => {
    expect(uniformRadiusToTailwind("6px", customTheme)).toEqual({
      tailwindClass: "rounded-[6px]", exact: false,
    });
  });

  it("uses default when theme is null", () => {
    expect(uniformRadiusToTailwind("8px", null)).toEqual({
      tailwindClass: "rounded-lg", exact: true,
    });
  });
});
