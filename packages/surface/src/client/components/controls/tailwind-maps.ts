/**
 * Tailwind CSS property → prefix and scale mappings.
 * Shared by ScaleInput, ColorControl, and other controls.
 */
import {
  FONT_SIZE_SCALE,
  FONT_WEIGHT_SCALE,
  LINE_HEIGHT_SCALE,
  LETTER_SPACING_SCALE,
  SPACING_SCALE,
  RADIUS_SCALE,
  BORDER_WIDTH_SCALE,
  OPACITY_SCALE,
} from "../../../shared/tailwind-parser.js";
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
  "height": "h",
  "border-top-left-radius": "rounded-tl",
  "border-top-right-radius": "rounded-tr",
  "border-bottom-right-radius": "rounded-br",
  "border-bottom-left-radius": "rounded-bl",
  "color": "text",
  "background-color": "bg",
  "border-color": "border",
};

export const CSS_PROP_TO_TW_SCALE: Record<string, { scale: readonly string[]; prefix: string }> = {
  "font-size": { scale: FONT_SIZE_SCALE, prefix: "text" },
  "font-weight": { scale: FONT_WEIGHT_SCALE, prefix: "font" },
  "line-height": { scale: LINE_HEIGHT_SCALE, prefix: "leading" },
  "letter-spacing": { scale: LETTER_SPACING_SCALE, prefix: "tracking" },
  "gap": { scale: SPACING_SCALE, prefix: "gap" },
  "row-gap": { scale: SPACING_SCALE, prefix: "gap-y" },
  "column-gap": { scale: SPACING_SCALE, prefix: "gap-x" },
  "padding-top": { scale: SPACING_SCALE, prefix: "pt" },
  "padding-right": { scale: SPACING_SCALE, prefix: "pr" },
  "padding-bottom": { scale: SPACING_SCALE, prefix: "pb" },
  "padding-left": { scale: SPACING_SCALE, prefix: "pl" },
  "margin-top": { scale: SPACING_SCALE, prefix: "mt" },
  "margin-right": { scale: SPACING_SCALE, prefix: "mr" },
  "margin-bottom": { scale: SPACING_SCALE, prefix: "mb" },
  "margin-left": { scale: SPACING_SCALE, prefix: "ml" },
  "width": { scale: SPACING_SCALE, prefix: "w" },
  "height": { scale: SPACING_SCALE, prefix: "h" },
};

/** Theme-aware scale maps. Returns per-scale arrays, falling back to defaults when theme is null or a scale is empty. */
export interface TwScales {
  spacing: readonly string[];
  fontSize: readonly string[];
  fontWeight: readonly string[];
  lineHeight: readonly string[];
  letterSpacing: readonly string[];
  borderRadius: readonly string[];
  borderWidth: readonly string[];
  opacity: readonly string[];
  /** CSS_PROP_TO_TW_SCALE with theme overrides applied */
  propToScale: Record<string, { scale: readonly string[]; prefix: string }>;
}

export function getTwScales(theme: ResolvedTailwindTheme | null | undefined): TwScales {
  const themeSpacingKeys = new Set(theme?.spacing?.map((e) => e.key) ?? []);
  const spacing = theme?.spacing?.length
    ? [...theme.spacing.map((e) => e.key), ...SPACING_SCALE.filter((s) => !themeSpacingKeys.has(s))]
    : SPACING_SCALE;
  const fontSize = theme?.fontSize?.length ? theme.fontSize.map((e) => e.key) : FONT_SIZE_SCALE;
  const fontWeight = theme?.fontWeight?.length ? theme.fontWeight.map((e) => e.key) : FONT_WEIGHT_SCALE;
  const lineHeight = theme?.lineHeight?.length ? theme.lineHeight.map((e) => e.key) : LINE_HEIGHT_SCALE;
  const letterSpacing = theme?.letterSpacing?.length ? theme.letterSpacing.map((e) => e.key) : LETTER_SPACING_SCALE;
  const borderRadius = theme?.borderRadius?.length ? theme.borderRadius.map((e) => e.key) : RADIUS_SCALE;
  const borderWidth = theme?.borderWidth?.length ? theme.borderWidth.map((e) => e.key) : BORDER_WIDTH_SCALE;
  const opacity = theme?.opacity?.length ? theme.opacity.map((e) => e.key) : OPACITY_SCALE;

  const propToScale: Record<string, { scale: readonly string[]; prefix: string }> = {
    "font-size": { scale: fontSize, prefix: "text" },
    "font-weight": { scale: fontWeight, prefix: "font" },
    "line-height": { scale: lineHeight, prefix: "leading" },
    "letter-spacing": { scale: letterSpacing, prefix: "tracking" },
    "gap": { scale: spacing, prefix: "gap" },
    "row-gap": { scale: spacing, prefix: "gap-y" },
    "column-gap": { scale: spacing, prefix: "gap-x" },
    "padding-top": { scale: spacing, prefix: "pt" },
    "padding-right": { scale: spacing, prefix: "pr" },
    "padding-bottom": { scale: spacing, prefix: "pb" },
    "padding-left": { scale: spacing, prefix: "pl" },
    "margin-top": { scale: spacing, prefix: "mt" },
    "margin-right": { scale: spacing, prefix: "mr" },
    "margin-bottom": { scale: spacing, prefix: "mb" },
    "margin-left": { scale: spacing, prefix: "ml" },
    "width": { scale: spacing, prefix: "w" },
    "height": { scale: spacing, prefix: "h" },
  };

  return { spacing, fontSize, fontWeight, lineHeight, letterSpacing, borderRadius, borderWidth, opacity, propToScale };
}
