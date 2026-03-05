/**
 * Resolved Tailwind theme types.
 * Extracted from project config (v3) or @theme CSS blocks (v4).
 */

export interface ScaleEntry {
  key: string;    // "4", "bold", "xl", "sm"
  value: string;  // "1rem", "700", "1.25rem"
}

/** The 9 theme scale names */
export type ThemeScaleKey = "spacing" | "fontSize" | "fontWeight" | "lineHeight"
  | "letterSpacing" | "borderRadius" | "borderWidth" | "opacity" | "boxShadow";

export interface ResolvedTailwindTheme {
  spacing: ScaleEntry[];
  fontSize: ScaleEntry[];
  fontWeight: ScaleEntry[];
  lineHeight: ScaleEntry[];
  letterSpacing: ScaleEntry[];
  borderRadius: ScaleEntry[];
  borderWidth: ScaleEntry[];
  opacity: ScaleEntry[];
  boxShadow: ScaleEntry[];
  /** Source CSS variable prefixes per scale (only for CSS-variable-derived themes).
   *  E.g. { spacing: "--space", fontSize: "--text" } */
  varPrefixes?: Partial<Record<string, string>>;
}
