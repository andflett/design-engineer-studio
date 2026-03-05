/**
 * Tailwind CSS property → prefix and scale mappings.
 * Shared by ScaleInput, ColorControl, and other controls.
 */
import type { ResolvedTailwindTheme } from "../../../shared/tailwind-theme.js";

export const CSS_PROP_TO_TW_PREFIX: Record<string, string> = {
  "font-size": "text",
  "font-weight": "font",
  "font-family": "font",
  "line-height": "leading",
  "letter-spacing": "tracking",
  "padding-top": "pt",
  "padding-right": "pr",
  "padding-bottom": "pb",
  "padding-left": "pl",
  "margin-top": "mt",
  "margin-right": "mr",
  "margin-bottom": "mb",
  "margin-left": "ml",
  "gap": "gap",
  "row-gap": "gap-y",
  "column-gap": "gap-x",
  "width": "w",
  "min-width": "min-w",
  "max-width": "max-w",
  "height": "h",
  "min-height": "min-h",
  "max-height": "max-h",
  "border-top-left-radius": "rounded-tl",
  "border-top-right-radius": "rounded-tr",
  "border-bottom-right-radius": "rounded-br",
  "border-bottom-left-radius": "rounded-bl",
  "color": "text",
  "background-color": "bg",
  "border-color": "border",
};

/** Theme-aware scale maps. Returns per-scale arrays from the resolved theme (empty when no theme). */
export interface TwScales {
  spacing: readonly string[];
  fontSize: readonly string[];
  fontWeight: readonly string[];
  lineHeight: readonly string[];
  letterSpacing: readonly string[];
  borderRadius: readonly string[];
  borderWidth: readonly string[];
  opacity: readonly string[];
  boxShadow: readonly string[];
  /** CSS property → { scale keys, TW prefix, optional CSS var prefix } */
  propToScale: Record<string, { scale: readonly string[]; prefix: string; varPrefix?: string }>;
}

export function getTwScales(theme: ResolvedTailwindTheme | null | undefined): TwScales {
  const spacing = theme?.spacing?.length ? theme.spacing.map((e) => e.key) : [];
  const fontSize = theme?.fontSize?.length ? theme.fontSize.map((e) => e.key) : [];
  const fontWeight = theme?.fontWeight?.length ? theme.fontWeight.map((e) => e.key) : [];
  const lineHeight = theme?.lineHeight?.length ? theme.lineHeight.map((e) => e.key) : [];
  const letterSpacing = theme?.letterSpacing?.length ? theme.letterSpacing.map((e) => e.key) : [];
  const borderRadius = theme?.borderRadius?.length ? theme.borderRadius.map((e) => e.key) : [];
  const borderWidth = theme?.borderWidth?.length ? theme.borderWidth.map((e) => e.key) : [];
  const opacity = theme?.opacity?.length ? theme.opacity.map((e) => e.key) : [];
  const boxShadow = theme?.boxShadow?.length ? theme.boxShadow.map((e) => e.key) : [];

  // CSS variable prefixes from classified theme (only for CSS-var-derived themes)
  const vp = theme?.varPrefixes;
  const spacingVarPrefix = vp?.spacing;
  const fontSizeVarPrefix = vp?.fontSize;
  const fontWeightVarPrefix = vp?.fontWeight;
  const lineHeightVarPrefix = vp?.lineHeight;
  const letterSpacingVarPrefix = vp?.letterSpacing;

  const propToScale: Record<string, { scale: readonly string[]; prefix: string; varPrefix?: string }> = {
    "font-size": { scale: fontSize, prefix: "text", varPrefix: fontSizeVarPrefix },
    "font-weight": { scale: fontWeight, prefix: "font", varPrefix: fontWeightVarPrefix },
    "line-height": { scale: lineHeight, prefix: "leading", varPrefix: lineHeightVarPrefix },
    "letter-spacing": { scale: letterSpacing, prefix: "tracking", varPrefix: letterSpacingVarPrefix },
    "gap": { scale: spacing, prefix: "gap", varPrefix: spacingVarPrefix },
    "row-gap": { scale: spacing, prefix: "gap-y", varPrefix: spacingVarPrefix },
    "column-gap": { scale: spacing, prefix: "gap-x", varPrefix: spacingVarPrefix },
    "padding-top": { scale: spacing, prefix: "pt", varPrefix: spacingVarPrefix },
    "padding-right": { scale: spacing, prefix: "pr", varPrefix: spacingVarPrefix },
    "padding-bottom": { scale: spacing, prefix: "pb", varPrefix: spacingVarPrefix },
    "padding-left": { scale: spacing, prefix: "pl", varPrefix: spacingVarPrefix },
    "margin-top": { scale: spacing, prefix: "mt", varPrefix: spacingVarPrefix },
    "margin-right": { scale: spacing, prefix: "mr", varPrefix: spacingVarPrefix },
    "margin-bottom": { scale: spacing, prefix: "mb", varPrefix: spacingVarPrefix },
    "margin-left": { scale: spacing, prefix: "ml", varPrefix: spacingVarPrefix },
    "width": { scale: spacing, prefix: "w", varPrefix: spacingVarPrefix },
    "min-width": { scale: spacing, prefix: "min-w", varPrefix: spacingVarPrefix },
    "max-width": { scale: spacing, prefix: "max-w", varPrefix: spacingVarPrefix },
    "height": { scale: spacing, prefix: "h", varPrefix: spacingVarPrefix },
    "min-height": { scale: spacing, prefix: "min-h", varPrefix: spacingVarPrefix },
    "max-height": { scale: spacing, prefix: "max-h", varPrefix: spacingVarPrefix },
  };

  return { spacing, fontSize, fontWeight, lineHeight, letterSpacing, borderRadius, borderWidth, opacity, boxShadow, propToScale };
}
