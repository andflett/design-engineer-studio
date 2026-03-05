/**
 * Maps computed CSS values back to Tailwind classes.
 * Uses a static reverse lookup table with arbitrary value fallback.
 * When a ResolvedTailwindTheme is provided, builds maps from the project's
 * actual theme — overriding hardcoded defaults on a per-scale basis.
 *
 * Tier 1: Token match (handled externally by checking scan data)
 * Tier 2: Tailwind scale match (this module)
 * Tier 3: Arbitrary value fallback (this module)
 */

import type { ResolvedTailwindTheme, ScaleEntry } from "./tailwind-theme.js";

/** Reverse lookup: CSS property → { computed value → Tailwind class }
 * Only contains keyword mappings (non-numeric, non-scale properties).
 * Scale properties (font-size, font-weight, line-height, letter-spacing, opacity)
 * are resolved from the project's theme — no hardcoded fallbacks. */
const REVERSE_MAP: Record<string, Record<string, string>> = {
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

// ---------------------------------------------------------------------------
// Theme-derived maps (memoized by reference)
// ---------------------------------------------------------------------------

interface ThemeMaps {
  spacingPx: Record<string, string> | null;
  radiusMap: Record<string, string> | null;
  reverseOverrides: Record<string, Record<string, string>>;
}

let cachedTheme: ResolvedTailwindTheme | null | undefined;
let cachedMaps: ThemeMaps | null = null;

/** Convert a rem value to px (× 16). */
function remToPx(value: string): string | null {
  const m = value.match(/^([\d.]+)rem$/);
  if (!m) return null;
  return `${parseFloat(m[1]) * 16}px`;
}

function buildSpacingPxMap(entries: ScaleEntry[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const { key, value } of entries) {
    // Map the raw value
    map[value] = key;
    // Also add px equivalent for rem values
    const px = remToPx(value);
    if (px && !map[px]) map[px] = key;
    // For bare numbers that could be px
    if (/^\d+px$/.test(value)) map[value] = key;
  }
  return map;
}

function buildRadiusMap(entries: ScaleEntry[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const { key, value } of entries) {
    const cls = key === "DEFAULT" ? "rounded" : `rounded-${key}`;
    map[value] = cls;
    const px = remToPx(value);
    if (px) map[px] = cls;
  }
  return map;
}

function buildReverseMap(entries: ScaleEntry[], prefix: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const { key, value } of entries) {
    const cls = `${prefix}-${key}`;
    map[value] = cls;
    const px = remToPx(value);
    if (px) map[px] = cls;
  }
  return map;
}

function getThemeMaps(theme: ResolvedTailwindTheme | null | undefined): ThemeMaps | null {
  if (theme === cachedTheme && cachedMaps) return cachedMaps;

  if (!theme) {
    cachedTheme = theme;
    cachedMaps = null;
    return null;
  }

  const maps: ThemeMaps = {
    spacingPx: theme.spacing.length > 0 ? buildSpacingPxMap(theme.spacing) : null,
    radiusMap: theme.borderRadius.length > 0 ? buildRadiusMap(theme.borderRadius) : null,
    reverseOverrides: {},
  };

  if (theme.fontSize.length > 0) {
    maps.reverseOverrides["font-size"] = buildReverseMap(theme.fontSize, "text");
  }
  if (theme.fontWeight.length > 0) {
    maps.reverseOverrides["font-weight"] = buildReverseMap(theme.fontWeight, "font");
  }
  if (theme.lineHeight.length > 0) {
    maps.reverseOverrides["line-height"] = buildReverseMap(theme.lineHeight, "leading");
  }
  if (theme.letterSpacing.length > 0) {
    maps.reverseOverrides["letter-spacing"] = buildReverseMap(theme.letterSpacing, "tracking");
  }
  if (theme.opacity.length > 0) {
    maps.reverseOverrides["opacity"] = buildReverseMap(theme.opacity, "opacity");
  }

  cachedTheme = theme;
  cachedMaps = maps;
  return maps;
}

export interface TailwindMatch {
  tailwindClass: string;
  exact: boolean;
}

export function computedToTailwindClass(
  cssProp: string,
  computedValue: string,
  theme?: ResolvedTailwindTheme | null,
): TailwindMatch | null {
  const themeMaps = getThemeMaps(theme);

  // Check theme-derived reverse overrides first (font-size, font-weight, etc.)
  if (themeMaps?.reverseOverrides[cssProp]?.[computedValue]) {
    return { tailwindClass: themeMaps.reverseOverrides[cssProp][computedValue], exact: true };
  }

  const directMap = REVERSE_MAP[cssProp];
  // Skip hardcoded maps for properties that the theme overrides
  if (!themeMaps?.reverseOverrides[cssProp] && directMap?.[computedValue]) {
    return { tailwindClass: directMap[computedValue], exact: true };
  }

  if (SPACING_PROPS.has(cssProp)) {
    const spacingMap = themeMaps?.spacingPx;
    const scaleVal = spacingMap?.[computedValue];
    const prefix = CSS_TO_TW_PREFIX[cssProp];
    if (scaleVal && prefix) {
      return { tailwindClass: `${prefix}-${scaleVal}`, exact: true };
    }
    if (prefix && computedValue !== "auto" && computedValue !== "none") {
      const safeValue = computedValue.replace(/ /g, "_");
      return { tailwindClass: `${prefix}-[${safeValue}]`, exact: false };
    }
  }

  if (RADIUS_PROPS.has(cssProp)) {
    const radiusClass = themeMaps?.radiusMap?.[computedValue];
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
      const safeValue = computedValue.replace(/ /g, "_");
      return { tailwindClass: `${prefix}-[${safeValue}]`, exact: false };
    }
  }

  const prefix = CSS_TO_TW_PREFIX[cssProp];
  if (prefix) {
    const safeValue = computedValue.replace(/ /g, "_");
    return { tailwindClass: `${prefix}-[${safeValue}]`, exact: false };
  }

  return null;
}

export function uniformBoxToTailwind(
  type: "padding" | "margin",
  value: string,
  theme?: ResolvedTailwindTheme | null,
): TailwindMatch | null {
  const prefix = type === "padding" ? "p" : "m";
  const themeMaps = getThemeMaps(theme);
  const scaleVal = themeMaps?.spacingPx?.[value];
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
  y: string,
  theme?: ResolvedTailwindTheme | null,
): { xClass: TailwindMatch | null; yClass: TailwindMatch | null } {
  const xPrefix = type === "padding" ? "px" : "mx";
  const yPrefix = type === "padding" ? "py" : "my";

  const themeMaps = getThemeMaps(theme);
  const xScale = themeMaps?.spacingPx?.[x];
  const yScale = themeMaps?.spacingPx?.[y];

  return {
    xClass: xScale
      ? { tailwindClass: `${xPrefix}-${xScale}`, exact: true }
      : x !== "0px" ? { tailwindClass: `${xPrefix}-[${x}]`, exact: false } : null,
    yClass: yScale
      ? { tailwindClass: `${yPrefix}-${yScale}`, exact: true }
      : y !== "0px" ? { tailwindClass: `${yPrefix}-[${y}]`, exact: false } : null,
  };
}

export function uniformRadiusToTailwind(
  value: string,
  theme?: ResolvedTailwindTheme | null,
): TailwindMatch | null {
  const themeMaps = getThemeMaps(theme);
  const cls = themeMaps?.radiusMap?.[value];
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
