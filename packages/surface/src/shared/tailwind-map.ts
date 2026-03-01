/**
 * Maps computed CSS values back to Tailwind classes.
 * Uses a static reverse lookup table with arbitrary value fallback.
 *
 * Tier 1: Token match (handled externally by checking scan data)
 * Tier 2: Tailwind scale match (this module)
 * Tier 3: Arbitrary value fallback (this module)
 */

/** Reverse lookup: CSS property → { computed value → Tailwind class } */
const REVERSE_MAP: Record<string, Record<string, string>> = {
  // Font size
  "font-size": {
    "12px": "text-xs", "0.75rem": "text-xs",
    "14px": "text-sm", "0.875rem": "text-sm",
    "16px": "text-base", "1rem": "text-base",
    "18px": "text-lg", "1.125rem": "text-lg",
    "20px": "text-xl", "1.25rem": "text-xl",
    "24px": "text-2xl", "1.5rem": "text-2xl",
    "30px": "text-3xl", "1.875rem": "text-3xl",
    "36px": "text-4xl", "2.25rem": "text-4xl",
    "48px": "text-5xl", "3rem": "text-5xl",
    "60px": "text-6xl", "3.75rem": "text-6xl",
    "72px": "text-7xl", "4.5rem": "text-7xl",
    "96px": "text-8xl", "6rem": "text-8xl",
    "128px": "text-9xl", "8rem": "text-9xl",
  },

  // Font weight
  "font-weight": {
    "100": "font-thin",
    "200": "font-extralight",
    "300": "font-light",
    "400": "font-normal",
    "500": "font-medium",
    "600": "font-semibold",
    "700": "font-bold",
    "800": "font-extrabold",
    "900": "font-black",
  },

  // Line height
  "line-height": {
    "1": "leading-none",
    "1.25": "leading-tight",
    "1.375": "leading-snug",
    "1.5": "leading-normal",
    "1.625": "leading-relaxed",
    "2": "leading-loose",
  },

  // Letter spacing
  "letter-spacing": {
    "-0.05em": "tracking-tighter",
    "-0.025em": "tracking-tight",
    "0em": "tracking-normal", "0px": "tracking-normal",
    "0.025em": "tracking-wide",
    "0.05em": "tracking-wider",
    "0.1em": "tracking-widest",
  },

  // Text align
  "text-align": {
    "left": "text-left", "start": "text-left",
    "center": "text-center",
    "right": "text-right", "end": "text-right",
    "justify": "text-justify",
  },

  // Text transform
  "text-transform": {
    "uppercase": "uppercase",
    "lowercase": "lowercase",
    "capitalize": "capitalize",
    "none": "normal-case",
  },

  // Display
  "display": {
    "block": "block",
    "inline-block": "inline-block",
    "inline": "inline",
    "flex": "flex",
    "inline-flex": "inline-flex",
    "grid": "grid",
    "inline-grid": "inline-grid",
    "none": "hidden",
  },

  // Position
  "position": {
    "static": "static",
    "relative": "relative",
    "absolute": "absolute",
    "fixed": "fixed",
    "sticky": "sticky",
  },

  // Flex direction
  "flex-direction": {
    "row": "flex-row",
    "row-reverse": "flex-row-reverse",
    "column": "flex-col",
    "column-reverse": "flex-col-reverse",
  },

  // Flex wrap
  "flex-wrap": {
    "wrap": "flex-wrap",
    "nowrap": "flex-nowrap",
    "wrap-reverse": "flex-wrap-reverse",
  },

  // Justify content
  "justify-content": {
    "flex-start": "justify-start", "start": "justify-start",
    "flex-end": "justify-end", "end": "justify-end",
    "center": "justify-center",
    "space-between": "justify-between",
    "space-around": "justify-around",
    "space-evenly": "justify-evenly",
  },

  // Align items
  "align-items": {
    "flex-start": "items-start", "start": "items-start",
    "flex-end": "items-end", "end": "items-end",
    "center": "items-center",
    "baseline": "items-baseline",
    "stretch": "items-stretch",
  },

  // Align self
  "align-self": {
    "auto": "self-auto",
    "flex-start": "self-start", "start": "self-start",
    "flex-end": "self-end", "end": "self-end",
    "center": "self-center",
    "stretch": "self-stretch",
  },

  // Overflow
  "overflow": {
    "visible": "overflow-visible",
    "hidden": "overflow-hidden",
    "scroll": "overflow-scroll",
    "auto": "overflow-auto",
  },

  // Opacity
  "opacity": {
    "0": "opacity-0",
    "0.05": "opacity-5",
    "0.1": "opacity-10",
    "0.15": "opacity-15",
    "0.2": "opacity-20",
    "0.25": "opacity-25",
    "0.3": "opacity-30",
    "0.35": "opacity-35",
    "0.4": "opacity-40",
    "0.45": "opacity-45",
    "0.5": "opacity-50",
    "0.55": "opacity-55",
    "0.6": "opacity-60",
    "0.65": "opacity-65",
    "0.7": "opacity-70",
    "0.75": "opacity-75",
    "0.8": "opacity-80",
    "0.85": "opacity-85",
    "0.9": "opacity-90",
    "0.95": "opacity-95",
    "1": "opacity-100",
  },
};

/** Spacing reverse lookup: maps computed px values to Tailwind spacing scale numbers. */
const SPACING_PX_MAP: Record<string, string> = {
  "0px": "0",
  "1px": "px",
  "2px": "0.5",
  "4px": "1",
  "6px": "1.5",
  "8px": "2",
  "10px": "2.5",
  "12px": "3",
  "14px": "3.5",
  "16px": "4",
  "20px": "5",
  "24px": "6",
  "28px": "7",
  "32px": "8",
  "36px": "9",
  "40px": "10",
  "44px": "11",
  "48px": "12",
  "56px": "14",
  "64px": "16",
  "80px": "20",
  "96px": "24",
  "112px": "28",
  "128px": "32",
  "144px": "36",
  "160px": "40",
  "176px": "44",
  "192px": "48",
  "208px": "52",
  "224px": "56",
  "240px": "60",
  "256px": "64",
  "288px": "72",
  "320px": "80",
  "384px": "96",
};

/** Border radius reverse lookup */
const RADIUS_MAP: Record<string, string> = {
  "0px": "rounded-none",
  "2px": "rounded-sm", "0.125rem": "rounded-sm",
  "4px": "rounded", "0.25rem": "rounded",
  "6px": "rounded-md", "0.375rem": "rounded-md",
  "8px": "rounded-lg", "0.5rem": "rounded-lg",
  "12px": "rounded-xl", "0.75rem": "rounded-xl",
  "16px": "rounded-2xl", "1rem": "rounded-2xl",
  "24px": "rounded-3xl", "1.5rem": "rounded-3xl",
  "9999px": "rounded-full",
};

/** Maps CSS property name to the Tailwind prefix for that property. */
const CSS_TO_TW_PREFIX: Record<string, string> = {
  "padding-top": "pt", "padding-right": "pr", "padding-bottom": "pb", "padding-left": "pl",
  "margin-top": "mt", "margin-right": "mr", "margin-bottom": "mb", "margin-left": "ml",
  "gap": "gap", "row-gap": "gap-y", "column-gap": "gap-x",
  "width": "w", "height": "h",
  "min-width": "min-w", "min-height": "min-h",
  "max-width": "max-w", "max-height": "max-h",
  "top": "top", "right": "right", "bottom": "bottom", "left": "left",
  "border-top-width": "border-t", "border-right-width": "border-r",
  "border-bottom-width": "border-b", "border-left-width": "border-l",
  "border-top-left-radius": "rounded-tl", "border-top-right-radius": "rounded-tr",
  "border-bottom-right-radius": "rounded-br", "border-bottom-left-radius": "rounded-bl",
  "font-size": "text", "font-weight": "font",
  "line-height": "leading", "letter-spacing": "tracking",
  "opacity": "opacity",
  "color": "text", "background-color": "bg", "border-color": "border",
};

const SPACING_PROPS = new Set([
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "gap", "row-gap", "column-gap",
  "top", "right", "bottom", "left",
  "width", "height", "min-width", "min-height", "max-width", "max-height",
]);

const RADIUS_PROPS = new Set([
  "border-top-left-radius", "border-top-right-radius",
  "border-bottom-right-radius", "border-bottom-left-radius",
]);

export interface TailwindMatch {
  tailwindClass: string;
  exact: boolean;
}

export function computedToTailwindClass(
  cssProp: string,
  computedValue: string
): TailwindMatch | null {
  const directMap = REVERSE_MAP[cssProp];
  if (directMap?.[computedValue]) {
    return { tailwindClass: directMap[computedValue], exact: true };
  }

  if (SPACING_PROPS.has(cssProp)) {
    const scaleVal = SPACING_PX_MAP[computedValue];
    const prefix = CSS_TO_TW_PREFIX[cssProp];
    if (scaleVal && prefix) {
      return { tailwindClass: `${prefix}-${scaleVal}`, exact: true };
    }
    if (prefix && computedValue !== "auto" && computedValue !== "none") {
      return { tailwindClass: `${prefix}-[${computedValue}]`, exact: false };
    }
  }

  if (RADIUS_PROPS.has(cssProp)) {
    const radiusClass = RADIUS_MAP[computedValue];
    if (radiusClass) {
      const prefix = CSS_TO_TW_PREFIX[cssProp];
      if (prefix) {
        const suffix = radiusClass.replace("rounded", "");
        return { tailwindClass: `${prefix}${suffix || ""}`, exact: true };
      }
      return { tailwindClass: radiusClass, exact: true };
    }
    const prefix = CSS_TO_TW_PREFIX[cssProp];
    if (prefix && computedValue !== "0px") {
      return { tailwindClass: `${prefix}-[${computedValue}]`, exact: false };
    }
  }

  const prefix = CSS_TO_TW_PREFIX[cssProp];
  if (prefix) {
    return { tailwindClass: `${prefix}-[${computedValue}]`, exact: false };
  }

  return null;
}

export function uniformBoxToTailwind(
  type: "padding" | "margin",
  value: string
): TailwindMatch | null {
  const prefix = type === "padding" ? "p" : "m";
  const scaleVal = SPACING_PX_MAP[value];
  if (scaleVal) {
    return { tailwindClass: `${prefix}-${scaleVal}`, exact: true };
  }
  if (value !== "0px" && value !== "auto") {
    return { tailwindClass: `${prefix}-[${value}]`, exact: false };
  }
  return null;
}

export function axisBoxToTailwind(
  type: "padding" | "margin",
  x: string,
  y: string
): { xClass: TailwindMatch | null; yClass: TailwindMatch | null } {
  const xPrefix = type === "padding" ? "px" : "mx";
  const yPrefix = type === "padding" ? "py" : "my";

  const xScale = SPACING_PX_MAP[x];
  const yScale = SPACING_PX_MAP[y];

  return {
    xClass: xScale
      ? { tailwindClass: `${xPrefix}-${xScale}`, exact: true }
      : x !== "0px" ? { tailwindClass: `${xPrefix}-[${x}]`, exact: false } : null,
    yClass: yScale
      ? { tailwindClass: `${yPrefix}-${yScale}`, exact: true }
      : y !== "0px" ? { tailwindClass: `${yPrefix}-[${y}]`, exact: false } : null,
  };
}

export function uniformRadiusToTailwind(value: string): TailwindMatch | null {
  const cls = RADIUS_MAP[value];
  if (cls) return { tailwindClass: cls, exact: true };
  if (value !== "0px") return { tailwindClass: `rounded-[${value}]`, exact: false };
  return null;
}

/** Token categories that map to CSS property types. */
const CSS_PROP_TO_TOKEN_CATEGORY: Record<string, string> = {
  "font-size": "typography", "font-weight": "typography",
  "line-height": "typography", "letter-spacing": "typography",
  "padding-top": "spacing", "padding-right": "spacing",
  "padding-bottom": "spacing", "padding-left": "spacing",
  "margin-top": "spacing", "margin-right": "spacing",
  "margin-bottom": "spacing", "margin-left": "spacing",
  "gap": "spacing", "row-gap": "spacing", "column-gap": "spacing",
  "width": "spacing", "height": "spacing",
  "border-top-left-radius": "radius", "border-top-right-radius": "radius",
  "border-bottom-right-radius": "radius", "border-bottom-left-radius": "radius",
  "color": "color", "background-color": "color", "border-color": "color",
  "box-shadow": "shadow",
};

export interface TokenMatch {
  tokenName: string;
  tokenVar: string;
  category: string;
  groupTokens: Array<{ name: string; value: string }>;
}

export function matchValueToToken(
  cssProp: string,
  computedValue: string,
  tokenGroups: Record<string, any[]>
): TokenMatch | null {
  if (!computedValue || computedValue === "none" || computedValue === "auto") return null;

  const targetCategory = CSS_PROP_TO_TOKEN_CATEGORY[cssProp];
  if (!targetCategory) return null;

  if (targetCategory === "color") {
    const normalized = normalizeColor(computedValue);
    if (!normalized) return null;

    for (const [, tokens] of Object.entries(tokenGroups)) {
      for (const t of tokens as any[]) {
        if (t.category === "color") {
          const tokenColor = normalizeColor(t.lightValue || "");
          if (tokenColor && tokenColor === normalized) {
            const groupTokens = (tokens as any[])
              .filter((gt: any) => gt.category === "color")
              .map((gt: any) => ({ name: gt.name.replace(/^--/, ""), value: gt.lightValue || "" }));
            return {
              tokenName: t.name.replace(/^--/, ""),
              tokenVar: t.name,
              category: "color",
              groupTokens,
            };
          }
        }
      }
    }
    return null;
  }

  const normalizedComputed = normalizeLength(computedValue);

  for (const [, tokens] of Object.entries(tokenGroups)) {
    for (const t of tokens as any[]) {
      if (t.category === targetCategory) {
        const normalizedToken = normalizeLength(t.lightValue || "");
        if (normalizedToken && normalizedToken === normalizedComputed) {
          const groupTokens = (tokens as any[])
            .filter((gt: any) => gt.category === targetCategory)
            .map((gt: any) => ({ name: gt.name.replace(/^--/, ""), value: gt.lightValue || "" }));
          return {
            tokenName: t.name.replace(/^--/, ""),
            tokenVar: t.name,
            category: targetCategory,
            groupTokens,
          };
        }
      }
    }
  }
  return null;
}

export function matchColorToToken(
  computedColor: string,
  tokenGroups: Record<string, any[]>
): string | null {
  const normalized = normalizeColor(computedColor);
  if (!normalized) return null;

  for (const [, tokens] of Object.entries(tokenGroups)) {
    for (const t of tokens as any[]) {
      if (t.category === "color") {
        const tokenColor = normalizeColor(t.lightValue || "");
        if (tokenColor && tokenColor === normalized) {
          return t.name.replace(/^--/, "");
        }
      }
    }
  }
  return null;
}

function normalizeLength(value: string): string | null {
  if (!value) return null;
  return value.trim().toLowerCase();
}

function normalizeColor(color: string): string | null {
  if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return null;
  const rgbMatch = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (rgbMatch) {
    const [, r, g, b, a] = rgbMatch;
    return a !== undefined && parseFloat(a) !== 1
      ? `rgba(${r},${g},${b},${a})`
      : `rgb(${r},${g},${b})`;
  }
  return color.trim().toLowerCase();
}
