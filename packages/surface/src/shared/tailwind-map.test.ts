import { describe, it, expect } from "vitest";
import {
  computedToTailwindClass,
  uniformBoxToTailwind,
  axisBoxToTailwind,
  uniformRadiusToTailwind,
  matchValueToToken,
  matchColorToToken,
} from "./tailwind-map.js";

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
