import { describe, it, expect } from "vitest";
import {
  parseClasses,
  replaceClass,
  addClass,
  removeClass,
  buildClass,
  isArbitraryValue,
  unwrapArbitrary,
  wrapArbitrary,
} from "./tailwind-parser.js";

describe("parseClasses", () => {
  it("parses color classes", () => {
    const result = parseClasses("bg-red-500 text-blue-200 border-gray-300");
    expect(result.color).toHaveLength(3);
    expect(result.color[0]).toMatchObject({ property: "backgroundColor", value: "red-500", fullClass: "bg-red-500" });
    expect(result.color[1]).toMatchObject({ property: "textColor", value: "blue-200" });
    expect(result.color[2]).toMatchObject({ property: "borderColor", value: "gray-300" });
  });

  it("parses spacing classes", () => {
    const result = parseClasses("p-4 mx-2 gap-6");
    expect(result.spacing).toHaveLength(3);
    expect(result.spacing[0]).toMatchObject({ property: "padding", value: "4" });
    expect(result.spacing[1]).toMatchObject({ property: "marginX", value: "2" });
    expect(result.spacing[2]).toMatchObject({ property: "gap", value: "6" });
  });

  it("parses named spacing tokens (px-sm, py-md, p-2xl, m-lg)", () => {
    const result = parseClasses("px-sm py-md p-2xl m-lg gap-xs");
    expect(result.spacing).toHaveLength(5);
    expect(result.spacing[0]).toMatchObject({ property: "paddingX", value: "sm" });
    expect(result.spacing[1]).toMatchObject({ property: "paddingY", value: "md" });
    expect(result.spacing[2]).toMatchObject({ property: "padding", value: "2xl" });
    expect(result.spacing[3]).toMatchObject({ property: "margin", value: "lg" });
    expect(result.spacing[4]).toMatchObject({ property: "gap", value: "xs" });
  });

  it("parses shape classes", () => {
    const result = parseClasses("rounded-lg border-2");
    expect(result.shape).toHaveLength(2);
    expect(result.shape[0]).toMatchObject({ property: "borderRadius", value: "lg" });
    expect(result.shape[1]).toMatchObject({ property: "borderWidth", value: "2" });
  });

  it("parses bare rounded as DEFAULT", () => {
    const result = parseClasses("rounded");
    expect(result.shape[0]).toMatchObject({ property: "borderRadius", value: "DEFAULT" });
  });

  it("parses typography classes", () => {
    const result = parseClasses("text-lg font-bold leading-tight tracking-wide");
    expect(result.typography).toHaveLength(4);
    expect(result.typography[0]).toMatchObject({ property: "fontSize", value: "lg" });
    expect(result.typography[1]).toMatchObject({ property: "fontWeight", value: "bold" });
    expect(result.typography[2]).toMatchObject({ property: "lineHeight", value: "tight" });
    expect(result.typography[3]).toMatchObject({ property: "letterSpacing", value: "wide" });
  });

  it("parses layout classes", () => {
    const result = parseClasses("flex flex-col items-center justify-between");
    expect(result.layout).toHaveLength(4);
    expect(result.layout[0]).toMatchObject({ property: "display", value: "flex" });
    expect(result.layout[1]).toMatchObject({ property: "flexDirection", value: "flex-col" });
    expect(result.layout[2]).toMatchObject({ property: "alignItems", value: "center" });
    expect(result.layout[3]).toMatchObject({ property: "justifyContent", value: "between" });
  });

  it("parses size classes", () => {
    const result = parseClasses("w-full h-screen");
    expect(result.size).toHaveLength(2);
    expect(result.size[0]).toMatchObject({ property: "width", value: "full" });
    expect(result.size[1]).toMatchObject({ property: "height", value: "screen" });
  });

  it("puts unknown classes in other", () => {
    const result = parseClasses("custom-class");
    expect(result.other).toHaveLength(1);
    expect(result.other[0]).toMatchObject({ value: "custom-class", property: "unknown" });
  });

  it("handles prefixed classes (responsive, state)", () => {
    const result = parseClasses("hover:bg-red-500 md:p-4");
    expect(result.color[0]).toMatchObject({ value: "red-500", prefix: "hover:" });
    expect(result.spacing[0]).toMatchObject({ value: "4", prefix: "md:" });
  });

  it("disambiguates text-lg (font-size) from text-blue (color)", () => {
    const result = parseClasses("text-lg text-blue-500");
    expect(result.typography).toHaveLength(1);
    expect(result.typography[0].property).toBe("fontSize");
    expect(result.color).toHaveLength(1);
    expect(result.color[0].property).toBe("textColor");
  });

  it("disambiguates border-2 (width) from border-red (color)", () => {
    const result = parseClasses("border-2 border-red-500");
    expect(result.shape).toHaveLength(1);
    expect(result.color).toHaveLength(1);
  });

  it("parses arbitrary value classes", () => {
    const result = parseClasses("p-[20px] w-[50%] text-[14px]");
    expect(result.spacing[0]).toMatchObject({ property: "padding", value: "[20px]" });
    expect(result.size[0]).toMatchObject({ property: "width", value: "[50%]" });
    expect(result.typography[0]).toMatchObject({ property: "fontSize", value: "[14px]" });
  });

  it("handles empty string", () => {
    const result = parseClasses("");
    for (const cat of Object.values(result)) {
      expect(cat).toHaveLength(0);
    }
  });
});

describe("replaceClass", () => {
  it("replaces an existing class", () => {
    expect(replaceClass("p-4 m-2", "p-4", "p-6")).toBe("p-6 m-2");
  });

  it("returns original if class not found", () => {
    expect(replaceClass("p-4 m-2", "p-8", "p-6")).toBe("p-4 m-2");
  });
});

describe("addClass", () => {
  it("adds a class", () => {
    expect(addClass("p-4", "m-2")).toBe("p-4 m-2");
  });

  it("does not add duplicates", () => {
    expect(addClass("p-4 m-2", "m-2")).toBe("p-4 m-2");
  });
});

describe("removeClass", () => {
  it("removes a class", () => {
    expect(removeClass("p-4 m-2 gap-4", "m-2")).toBe("p-4 gap-4");
  });

  it("handles class not present", () => {
    expect(removeClass("p-4", "m-2")).toBe("p-4");
  });
});

describe("buildClass", () => {
  it("builds background color class", () => {
    expect(buildClass("backgroundColor", "red-500")).toBe("bg-red-500");
  });

  it("builds padding class", () => {
    expect(buildClass("padding", "4")).toBe("p-4");
  });

  it("builds border radius DEFAULT", () => {
    expect(buildClass("borderRadius", "DEFAULT")).toBe("rounded");
  });

  it("builds border radius with size", () => {
    expect(buildClass("borderRadius", "lg")).toBe("rounded-lg");
  });

  it("builds border width bare", () => {
    expect(buildClass("borderWidth", "1")).toBe("border");
  });

  it("applies prefix", () => {
    expect(buildClass("backgroundColor", "red-500", "hover:")).toBe("hover:bg-red-500");
  });

  it("returns value for unknown property", () => {
    expect(buildClass("unknownProp", "test")).toBe("test");
  });

  it("builds display class directly", () => {
    expect(buildClass("display", "flex")).toBe("flex");
  });
});

describe("arbitrary value helpers", () => {
  it("isArbitraryValue detects brackets", () => {
    expect(isArbitraryValue("[20px]")).toBe(true);
    expect(isArbitraryValue("20px")).toBe(false);
    expect(isArbitraryValue("[")).toBe(false);
  });

  it("unwrapArbitrary removes brackets", () => {
    expect(unwrapArbitrary("[20px]")).toBe("20px");
    expect(unwrapArbitrary("20px")).toBe("20px");
  });

  it("wrapArbitrary adds brackets", () => {
    expect(wrapArbitrary("20px")).toBe("[20px]");
    expect(wrapArbitrary("[20px]")).toBe("[20px]");
  });
});
