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
  describe("keyword lookups (no theme needed)", () => {
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

  describe("no-theme fallbacks to arbitrary", () => {
    it("falls back to arbitrary for spacing without theme", () => {
      expect(computedToTailwindClass("padding-top", "16px")).toEqual({ tailwindClass: "pt-[16px]", exact: false });
    });

    it("falls back to arbitrary for font-size without theme", () => {
      expect(computedToTailwindClass("font-size", "16px")).toEqual({ tailwindClass: "text-[16px]", exact: false });
    });

    it("falls back to arbitrary for radius without theme", () => {
      expect(computedToTailwindClass("border-top-left-radius", "8px")).toEqual({ tailwindClass: "rounded-tl-[8px]", exact: false });
    });

    it("falls back to arbitrary for auto spacing", () => {
      const result = computedToTailwindClass("margin-top", "auto");
      expect(result).toEqual({ tailwindClass: "mt-[auto]", exact: false });
    });

    it("returns null for completely unknown property", () => {
      expect(computedToTailwindClass("unknown-css-prop", "foo")).toBeNull();
    });
  });

  describe("CSS function values — underscore escaping", () => {
    it("escapes spaces in CSS function values with underscores", () => {
      const result = computedToTailwindClass("font-size", "clamp(14px, 2vw, 24px)");
      expect(result).toEqual({ tailwindClass: "text-[clamp(14px,_2vw,_24px)]", exact: false });
    });

    it("escapes spaces in calc() values", () => {
      const result = computedToTailwindClass("width", "calc(100% - 2rem)");
      expect(result).toEqual({ tailwindClass: "w-[calc(100%_-_2rem)]", exact: false });
    });

    it("escapes spaces in padding with CSS function", () => {
      const result = computedToTailwindClass("padding-top", "clamp(8px, 1vw, 16px)");
      expect(result).toEqual({ tailwindClass: "pt-[clamp(8px,_1vw,_16px)]", exact: false });
    });

    it("does not escape values without spaces", () => {
      const result = computedToTailwindClass("font-size", "clamp(14px,2vw,24px)");
      expect(result).toEqual({ tailwindClass: "text-[clamp(14px,2vw,24px)]", exact: false });
    });
  });
});

describe("uniformBoxToTailwind", () => {
  it("falls back to arbitrary without theme", () => {
    expect(uniformBoxToTailwind("padding", "16px")).toEqual({ tailwindClass: "p-[16px]", exact: false });
  });

  it("returns null for 0px without theme", () => {
    expect(uniformBoxToTailwind("padding", "0px")).toBeNull();
  });

  it("falls back to arbitrary for non-scale value", () => {
    expect(uniformBoxToTailwind("padding", "13px")).toEqual({ tailwindClass: "p-[13px]", exact: false });
  });
});

describe("axisBoxToTailwind", () => {
  it("falls back to arbitrary without theme", () => {
    const result = axisBoxToTailwind("padding", "16px", "8px");
    expect(result.xClass).toEqual({ tailwindClass: "px-[16px]", exact: false });
    expect(result.yClass).toEqual({ tailwindClass: "py-[8px]", exact: false });
  });

  it("returns null for 0px axis without theme", () => {
    const result = axisBoxToTailwind("margin", "0px", "16px");
    expect(result.xClass).toBeNull();
    expect(result.yClass).toEqual({ tailwindClass: "my-[16px]", exact: false });
  });
});

describe("uniformRadiusToTailwind", () => {
  it("falls back to arbitrary without theme", () => {
    expect(uniformRadiusToTailwind("8px")).toEqual({ tailwindClass: "rounded-[8px]", exact: false });
  });

  it("returns null for 0px without theme", () => {
    expect(uniformRadiusToTailwind("0px")).toBeNull();
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
  boxShadow: [],
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

  it("falls back to arbitrary for spacing not in custom theme", () => {
    // 24px is NOT in our custom theme — arbitrary
    expect(computedToTailwindClass("padding-top", "24px", customTheme)).toEqual({
      tailwindClass: "pt-[24px]", exact: false,
    });
  });

  it("maps custom spacing scale", () => {
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

  it("falls back to arbitrary when theme is null for scale properties", () => {
    expect(computedToTailwindClass("font-size", "16px", null)).toEqual({
      tailwindClass: "text-[16px]", exact: false,
    });
    expect(computedToTailwindClass("padding-top", "16px", null)).toEqual({
      tailwindClass: "pt-[16px]", exact: false,
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

  it("falls back to arbitrary for non-custom-scale value", () => {
    expect(uniformBoxToTailwind("padding", "12px", customTheme)).toEqual({
      tailwindClass: "p-[12px]", exact: false,
    });
  });

  it("falls back to arbitrary when theme is null", () => {
    expect(uniformBoxToTailwind("padding", "16px", null)).toEqual({
      tailwindClass: "p-[16px]", exact: false,
    });
  });
});

describe("axisBoxToTailwind with custom theme", () => {
  it("maps custom spacing for both axes", () => {
    const result = axisBoxToTailwind("padding", "4px", "16px", customTheme);
    expect(result.xClass).toEqual({ tailwindClass: "px-sm", exact: true });
    expect(result.yClass).toEqual({ tailwindClass: "py-lg", exact: true });
  });

  it("falls back to arbitrary when theme is null", () => {
    const result = axisBoxToTailwind("padding", "16px", "8px", null);
    expect(result.xClass).toEqual({ tailwindClass: "px-[16px]", exact: false });
    expect(result.yClass).toEqual({ tailwindClass: "py-[8px]", exact: false });
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

  it("falls back to arbitrary when theme is null", () => {
    expect(uniformRadiusToTailwind("8px", null)).toEqual({
      tailwindClass: "rounded-[8px]", exact: false,
    });
  });
});
