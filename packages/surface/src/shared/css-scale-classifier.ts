/**
 * Classify CSS custom properties into theme scales.
 * Takes flat {name, value}[] from iframe stylesheets and groups
 * them into a ResolvedTailwindTheme structure for scale controls.
 */

import type { ResolvedTailwindTheme, ScaleEntry, ThemeScaleKey } from "./tailwind-theme.js";

/** Variable prefix → theme scale key */
const PREFIX_TO_SCALE: Record<string, ThemeScaleKey> = {
  "--spacing": "spacing",
  "--space": "spacing",
  "--text": "fontSize",
  "--font-size": "fontSize",
  "--font-weight": "fontWeight",
  "--leading": "lineHeight",
  "--line-height": "lineHeight",
  "--tracking": "letterSpacing",
  "--letter-spacing": "letterSpacing",
  "--radius": "borderRadius",
  "--border-radius": "borderRadius",
  "--border-width": "borderWidth",
  "--border": "borderWidth",
  "--opacity": "opacity",
  "--shadow": "boxShadow",
};

/** Sorted prefixes (longest first) for matching */
const SORTED_PREFIXES = Object.keys(PREFIX_TO_SCALE).sort((a, b) => b.length - a.length);

/** Check if a CSS value looks like a color */
function isColorValue(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v.startsWith("#")) return true;
  if (v.startsWith("rgb")) return true;
  if (v.startsWith("hsl")) return true;
  if (v.startsWith("oklch")) return true;
  if (v.startsWith("oklab")) return true;
  if (v.startsWith("lch")) return true;
  if (v.startsWith("lab")) return true;
  if (v.startsWith("color(")) return true;
  return false;
}

/**
 * Classify a single CSS custom property name into a scale + key + prefix.
 */
function classifyProperty(name: string): { scale: ThemeScaleKey; key: string; prefix: string } | null {
  for (const prefix of SORTED_PREFIXES) {
    if (name.startsWith(prefix + "-")) {
      const key = name.slice(prefix.length + 1);
      // Skip companion entries like --text-sm--line-height
      if (key.includes("--")) return null;
      return { scale: PREFIX_TO_SCALE[prefix], key, prefix };
    }
  }
  return null;
}

/**
 * Classify an array of CSS custom properties into a ResolvedTailwindTheme.
 * Filters out:
 * - Properties that don't match any known prefix
 * - --text-shadow-* entries (multi-value shadow, not a dimension)
 * - Companion entries (--text-*--line-height)
 * - Groups where all values are colors
 * - Groups with only one entry (not a scale)
 */
export function classifyCssProperties(
  properties: { name: string; value: string }[],
): ResolvedTailwindTheme | null {
  // Accumulate entries per scale + track the CSS var prefix per scale
  const groups: Record<string, ScaleEntry[]> = {
    spacing: [],
    fontSize: [],
    fontWeight: [],
    lineHeight: [],
    letterSpacing: [],
    borderRadius: [],
    borderWidth: [],
    opacity: [],
    boxShadow: [],
  };

  const prefixes: Record<string, string> = {};

  for (const { name, value } of properties) {
    // Skip --text-shadow-* entries
    if (name.startsWith("--text-shadow")) continue;

    const classified = classifyProperty(name);
    if (!classified) continue;

    groups[classified.scale].push({ key: classified.key, value });
    // Track the first prefix seen for each scale
    if (!prefixes[classified.scale]) {
      prefixes[classified.scale] = classified.prefix;
    }
  }

  // Filter out groups that are all colors or have < 2 entries
  const theme: ResolvedTailwindTheme = {
    spacing: [],
    fontSize: [],
    fontWeight: [],
    lineHeight: [],
    letterSpacing: [],
    borderRadius: [],
    borderWidth: [],
    opacity: [],
    boxShadow: [],
  };

  const varPrefixes: Record<string, string> = {};
  let hasAnyScale = false;

  for (const [scale, entries] of Object.entries(groups)) {
    if (entries.length < 2) continue;

    // Skip if all values are colors
    const allColors = entries.every((e) => isColorValue(e.value));
    if (allColors) continue;

    (theme as any)[scale] = entries;
    if (prefixes[scale]) {
      varPrefixes[scale] = prefixes[scale];
    }
    hasAnyScale = true;
  }

  if (!hasAnyScale) return null;

  theme.varPrefixes = varPrefixes;
  return theme;
}
