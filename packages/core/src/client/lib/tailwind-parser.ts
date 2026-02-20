/**
 * Bidirectional Tailwind class parser.
 * Parses class strings into structured properties and writes changes back.
 */

export interface ParsedProperty {
  category: PropertyCategory;
  property: string;
  label: string;
  value: string;
  fullClass: string;
  prefix?: string;
}

export type PropertyCategory =
  | "color"
  | "spacing"
  | "shape"
  | "typography"
  | "layout"
  | "size"
  | "other";

export interface StructuredProperties {
  color: ParsedProperty[];
  spacing: ParsedProperty[];
  shape: ParsedProperty[];
  typography: ParsedProperty[];
  layout: ParsedProperty[];
  size: ParsedProperty[];
  other: ParsedProperty[];
}

interface ClassPattern {
  regex: RegExp;
  category: PropertyCategory;
  property: string;
  label: string;
  extractValue: (match: RegExpMatchArray) => string;
}

const CLASS_PATTERNS: ClassPattern[] = [
  // Colors
  { regex: /^bg-([\w-]+(?:\/\d+)?)$/, category: "color", property: "backgroundColor", label: "Background", extractValue: (m) => m[1] },
  { regex: /^text-([\w-]+(?:\/\d+)?)$/, category: "color", property: "textColor", label: "Text", extractValue: (m) => m[1] },
  { regex: /^border-([\w-]+(?:\/\d+)?)$/, category: "color", property: "borderColor", label: "Border", extractValue: (m) => m[1] },
  { regex: /^ring-([\w-]+(?:\/\d+)?)$/, category: "color", property: "ringColor", label: "Ring", extractValue: (m) => m[1] },
  { regex: /^outline-([\w-]+(?:\/\d+)?)$/, category: "color", property: "outlineColor", label: "Outline", extractValue: (m) => m[1] },

  // Spacing
  { regex: /^p-([\d.]+|px)$/, category: "spacing", property: "padding", label: "Padding", extractValue: (m) => m[1] },
  { regex: /^px-([\d.]+|px)$/, category: "spacing", property: "paddingX", label: "Padding X", extractValue: (m) => m[1] },
  { regex: /^py-([\d.]+|px)$/, category: "spacing", property: "paddingY", label: "Padding Y", extractValue: (m) => m[1] },
  { regex: /^pt-([\d.]+|px)$/, category: "spacing", property: "paddingTop", label: "Padding Top", extractValue: (m) => m[1] },
  { regex: /^pr-([\d.]+|px)$/, category: "spacing", property: "paddingRight", label: "Padding Right", extractValue: (m) => m[1] },
  { regex: /^pb-([\d.]+|px)$/, category: "spacing", property: "paddingBottom", label: "Padding Bottom", extractValue: (m) => m[1] },
  { regex: /^pl-([\d.]+|px)$/, category: "spacing", property: "paddingLeft", label: "Padding Left", extractValue: (m) => m[1] },
  { regex: /^m-([\d.]+|px|auto)$/, category: "spacing", property: "margin", label: "Margin", extractValue: (m) => m[1] },
  { regex: /^mx-([\d.]+|px|auto)$/, category: "spacing", property: "marginX", label: "Margin X", extractValue: (m) => m[1] },
  { regex: /^my-([\d.]+|px|auto)$/, category: "spacing", property: "marginY", label: "Margin Y", extractValue: (m) => m[1] },
  { regex: /^mt-([\d.]+|px|auto)$/, category: "spacing", property: "marginTop", label: "Margin Top", extractValue: (m) => m[1] },
  { regex: /^mr-([\d.]+|px|auto)$/, category: "spacing", property: "marginRight", label: "Margin Right", extractValue: (m) => m[1] },
  { regex: /^mb-([\d.]+|px|auto)$/, category: "spacing", property: "marginBottom", label: "Margin Bottom", extractValue: (m) => m[1] },
  { regex: /^ml-([\d.]+|px|auto)$/, category: "spacing", property: "marginLeft", label: "Margin Left", extractValue: (m) => m[1] },
  { regex: /^gap-([\d.]+|px)$/, category: "spacing", property: "gap", label: "Gap", extractValue: (m) => m[1] },
  { regex: /^gap-x-([\d.]+|px)$/, category: "spacing", property: "gapX", label: "Gap X", extractValue: (m) => m[1] },
  { regex: /^gap-y-([\d.]+|px)$/, category: "spacing", property: "gapY", label: "Gap Y", extractValue: (m) => m[1] },
  { regex: /^space-x-([\d.]+)$/, category: "spacing", property: "spaceX", label: "Space X", extractValue: (m) => m[1] },
  { regex: /^space-y-([\d.]+)$/, category: "spacing", property: "spaceY", label: "Space Y", extractValue: (m) => m[1] },

  // Shape
  { regex: /^rounded$/, category: "shape", property: "borderRadius", label: "Radius", extractValue: () => "DEFAULT" },
  { regex: /^rounded-(none|sm|md|lg|xl|2xl|3xl|full)$/, category: "shape", property: "borderRadius", label: "Radius", extractValue: (m) => m[1] },
  { regex: /^border$/, category: "shape", property: "borderWidth", label: "Border Width", extractValue: () => "1" },
  { regex: /^border-(0|2|4|8)$/, category: "shape", property: "borderWidth", label: "Border Width", extractValue: (m) => m[1] },

  // Typography
  { regex: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/, category: "typography", property: "fontSize", label: "Font Size", extractValue: (m) => m[1] },
  { regex: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/, category: "typography", property: "fontWeight", label: "Font Weight", extractValue: (m) => m[1] },
  { regex: /^leading-(none|tight|snug|normal|relaxed|loose)$/, category: "typography", property: "lineHeight", label: "Line Height", extractValue: (m) => m[1] },
  { regex: /^tracking-(tighter|tight|normal|wide|wider|widest)$/, category: "typography", property: "letterSpacing", label: "Letter Spacing", extractValue: (m) => m[1] },
  { regex: /^font-(sans|serif|mono)$/, category: "typography", property: "fontFamily", label: "Font Family", extractValue: (m) => m[1] },
  { regex: /^text-(left|center|right|justify)$/, category: "typography", property: "textAlign", label: "Text Align", extractValue: (m) => m[1] },
  { regex: /^(uppercase|lowercase|capitalize|normal-case)$/, category: "typography", property: "textTransform", label: "Text Transform", extractValue: (m) => m[1] },
  { regex: /^(underline|overline|line-through|no-underline)$/, category: "typography", property: "textDecoration", label: "Text Decoration", extractValue: (m) => m[1] },
  { regex: /^(truncate|whitespace-nowrap|whitespace-normal)$/, category: "typography", property: "overflow", label: "Overflow", extractValue: (m) => m[1] },

  // Layout
  { regex: /^(flex|inline-flex|grid|inline-grid|block|inline-block|inline|hidden)$/, category: "layout", property: "display", label: "Display", extractValue: (m) => m[1] },
  { regex: /^(flex-row|flex-col|flex-row-reverse|flex-col-reverse)$/, category: "layout", property: "flexDirection", label: "Direction", extractValue: (m) => m[1] },
  { regex: /^(flex-wrap|flex-nowrap|flex-wrap-reverse)$/, category: "layout", property: "flexWrap", label: "Wrap", extractValue: (m) => m[1] },
  { regex: /^items-(start|end|center|baseline|stretch)$/, category: "layout", property: "alignItems", label: "Align Items", extractValue: (m) => m[1] },
  { regex: /^justify-(start|end|center|between|around|evenly)$/, category: "layout", property: "justifyContent", label: "Justify", extractValue: (m) => m[1] },
  { regex: /^(self-auto|self-start|self-end|self-center|self-stretch)$/, category: "layout", property: "alignSelf", label: "Align Self", extractValue: (m) => m[1] },
  { regex: /^grid-cols-(\d+|none)$/, category: "layout", property: "gridCols", label: "Grid Columns", extractValue: (m) => m[1] },
  { regex: /^grid-rows-(\d+|none)$/, category: "layout", property: "gridRows", label: "Grid Rows", extractValue: (m) => m[1] },
  { regex: /^col-span-(\d+|full)$/, category: "layout", property: "colSpan", label: "Column Span", extractValue: (m) => m[1] },
  { regex: /^row-span-(\d+)$/, category: "layout", property: "rowSpan", label: "Row Span", extractValue: (m) => m[1] },
  { regex: /^(relative|absolute|fixed|sticky)$/, category: "layout", property: "position", label: "Position", extractValue: (m) => m[1] },
  { regex: /^(overflow-hidden|overflow-auto|overflow-scroll|overflow-visible)$/, category: "layout", property: "overflow", label: "Overflow", extractValue: (m) => m[1] },

  // Size
  { regex: /^w-([\d.]+|full|screen|auto|min|max|fit|px)$/, category: "size", property: "width", label: "Width", extractValue: (m) => m[1] },
  { regex: /^h-([\d.]+|full|screen|auto|min|max|fit|px)$/, category: "size", property: "height", label: "Height", extractValue: (m) => m[1] },
  { regex: /^min-w-([\d.]+|full|min|max|fit|0)$/, category: "size", property: "minWidth", label: "Min Width", extractValue: (m) => m[1] },
  { regex: /^min-h-([\d.]+|full|screen|min|max|fit|0)$/, category: "size", property: "minHeight", label: "Min Height", extractValue: (m) => m[1] },
  { regex: /^max-w-([\w.]+)$/, category: "size", property: "maxWidth", label: "Max Width", extractValue: (m) => m[1] },
  { regex: /^max-h-([\w.]+)$/, category: "size", property: "maxHeight", label: "Max Height", extractValue: (m) => m[1] },
  { regex: /^size-([\d.]+|full|auto|px)$/, category: "size", property: "size", label: "Size", extractValue: (m) => m[1] },
  { regex: /^(flex-1|flex-auto|flex-initial|flex-none)$/, category: "size", property: "flex", label: "Flex", extractValue: (m) => m[1] },
  { regex: /^(grow|grow-0|shrink|shrink-0)$/, category: "size", property: "flexGrowShrink", label: "Grow/Shrink", extractValue: (m) => m[1] },

  // Arbitrary values — must come after named patterns so named values match first
  // Typography
  { regex: /^text-\[(-?[\w.%]+)\]$/, category: "typography", property: "fontSize", label: "Font Size", extractValue: (m) => `[${m[1]}]` },
  { regex: /^leading-\[(-?[\w.%]+)\]$/, category: "typography", property: "lineHeight", label: "Line Height", extractValue: (m) => `[${m[1]}]` },
  { regex: /^tracking-\[(-?[\w.%]+)\]$/, category: "typography", property: "letterSpacing", label: "Letter Spacing", extractValue: (m) => `[${m[1]}]` },
  { regex: /^font-\[(-?[\w.%]+)\]$/, category: "typography", property: "fontWeight", label: "Font Weight", extractValue: (m) => `[${m[1]}]` },
  // Spacing
  { regex: /^p-\[(-?[\w.%]+)\]$/, category: "spacing", property: "padding", label: "Padding", extractValue: (m) => `[${m[1]}]` },
  { regex: /^px-\[(-?[\w.%]+)\]$/, category: "spacing", property: "paddingX", label: "Padding X", extractValue: (m) => `[${m[1]}]` },
  { regex: /^py-\[(-?[\w.%]+)\]$/, category: "spacing", property: "paddingY", label: "Padding Y", extractValue: (m) => `[${m[1]}]` },
  { regex: /^pt-\[(-?[\w.%]+)\]$/, category: "spacing", property: "paddingTop", label: "Padding Top", extractValue: (m) => `[${m[1]}]` },
  { regex: /^pr-\[(-?[\w.%]+)\]$/, category: "spacing", property: "paddingRight", label: "Padding Right", extractValue: (m) => `[${m[1]}]` },
  { regex: /^pb-\[(-?[\w.%]+)\]$/, category: "spacing", property: "paddingBottom", label: "Padding Bottom", extractValue: (m) => `[${m[1]}]` },
  { regex: /^pl-\[(-?[\w.%]+)\]$/, category: "spacing", property: "paddingLeft", label: "Padding Left", extractValue: (m) => `[${m[1]}]` },
  { regex: /^m-\[(-?[\w.%]+)\]$/, category: "spacing", property: "margin", label: "Margin", extractValue: (m) => `[${m[1]}]` },
  { regex: /^mx-\[(-?[\w.%]+)\]$/, category: "spacing", property: "marginX", label: "Margin X", extractValue: (m) => `[${m[1]}]` },
  { regex: /^my-\[(-?[\w.%]+)\]$/, category: "spacing", property: "marginY", label: "Margin Y", extractValue: (m) => `[${m[1]}]` },
  { regex: /^mt-\[(-?[\w.%]+)\]$/, category: "spacing", property: "marginTop", label: "Margin Top", extractValue: (m) => `[${m[1]}]` },
  { regex: /^mr-\[(-?[\w.%]+)\]$/, category: "spacing", property: "marginRight", label: "Margin Right", extractValue: (m) => `[${m[1]}]` },
  { regex: /^mb-\[(-?[\w.%]+)\]$/, category: "spacing", property: "marginBottom", label: "Margin Bottom", extractValue: (m) => `[${m[1]}]` },
  { regex: /^ml-\[(-?[\w.%]+)\]$/, category: "spacing", property: "marginLeft", label: "Margin Left", extractValue: (m) => `[${m[1]}]` },
  { regex: /^gap-\[(-?[\w.%]+)\]$/, category: "spacing", property: "gap", label: "Gap", extractValue: (m) => `[${m[1]}]` },
  { regex: /^gap-x-\[(-?[\w.%]+)\]$/, category: "spacing", property: "gapX", label: "Gap X", extractValue: (m) => `[${m[1]}]` },
  { regex: /^gap-y-\[(-?[\w.%]+)\]$/, category: "spacing", property: "gapY", label: "Gap Y", extractValue: (m) => `[${m[1]}]` },
  // Size
  { regex: /^w-\[(-?[\w.%]+)\]$/, category: "size", property: "width", label: "Width", extractValue: (m) => `[${m[1]}]` },
  { regex: /^h-\[(-?[\w.%]+)\]$/, category: "size", property: "height", label: "Height", extractValue: (m) => `[${m[1]}]` },
  { regex: /^min-w-\[(-?[\w.%]+)\]$/, category: "size", property: "minWidth", label: "Min Width", extractValue: (m) => `[${m[1]}]` },
  { regex: /^min-h-\[(-?[\w.%]+)\]$/, category: "size", property: "minHeight", label: "Min Height", extractValue: (m) => `[${m[1]}]` },
  { regex: /^max-w-\[(-?[\w.%]+)\]$/, category: "size", property: "maxWidth", label: "Max Width", extractValue: (m) => `[${m[1]}]` },
  { regex: /^max-h-\[(-?[\w.%]+)\]$/, category: "size", property: "maxHeight", label: "Max Height", extractValue: (m) => `[${m[1]}]` },
  // Shape
  { regex: /^rounded-\[(-?[\w.%]+)\]$/, category: "shape", property: "borderRadius", label: "Radius", extractValue: (m) => `[${m[1]}]` },
];

function stripPrefix(cls: string): { prefix: string | undefined; core: string } {
  const parts = cls.split(":");
  if (parts.length === 1) return { prefix: undefined, core: cls };
  const core = parts.pop()!;
  const prefix = parts.join(":") + ":";
  return { prefix, core };
}

export function parseClasses(classString: string): StructuredProperties {
  const result: StructuredProperties = {
    color: [],
    spacing: [],
    shape: [],
    typography: [],
    layout: [],
    size: [],
    other: [],
  };

  const classes = classString.split(/\s+/).filter(Boolean);

  for (const cls of classes) {
    const { prefix, core } = stripPrefix(cls);
    let matched = false;

    for (const pattern of CLASS_PATTERNS) {
      const match = core.match(pattern.regex);
      if (match) {
        if (pattern.property === "textColor") {
          const sizeValues = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"];
          if (sizeValues.includes(match[1])) continue;
          const alignValues = ["left", "center", "right", "justify"];
          if (alignValues.includes(match[1])) continue;
        }

        if (pattern.property === "borderColor") {
          const widthValues = ["0", "2", "4", "8"];
          if (widthValues.includes(match[1])) continue;
        }

        result[pattern.category].push({
          category: pattern.category,
          property: pattern.property,
          label: pattern.label,
          value: pattern.extractValue(match),
          fullClass: cls,
          prefix,
        });
        matched = true;
        break;
      }
    }

    if (!matched) {
      result.other.push({
        category: "other",
        property: "unknown",
        label: cls,
        value: cls,
        fullClass: cls,
        prefix,
      });
    }
  }

  return result;
}

export function replaceClass(
  classString: string,
  oldClass: string,
  newClass: string
): string {
  const classes = classString.split(/\s+/);
  const idx = classes.indexOf(oldClass);
  if (idx === -1) return classString;
  classes[idx] = newClass;
  return classes.join(" ");
}

export function addClass(classString: string, newClass: string): string {
  const classes = classString.split(/\s+/).filter(Boolean);
  if (classes.includes(newClass)) return classString;
  classes.push(newClass);
  return classes.join(" ");
}

export function removeClass(classString: string, targetClass: string): string {
  return classString
    .split(/\s+/)
    .filter((c) => c !== targetClass)
    .join(" ");
}

export function buildClass(
  property: string,
  newValue: string,
  prefix?: string
): string {
  const classMap: Record<string, (v: string) => string> = {
    backgroundColor: (v) => `bg-${v}`,
    textColor: (v) => `text-${v}`,
    borderColor: (v) => `border-${v}`,
    ringColor: (v) => `ring-${v}`,
    padding: (v) => `p-${v}`,
    paddingX: (v) => `px-${v}`,
    paddingY: (v) => `py-${v}`,
    paddingTop: (v) => `pt-${v}`,
    paddingRight: (v) => `pr-${v}`,
    paddingBottom: (v) => `pb-${v}`,
    paddingLeft: (v) => `pl-${v}`,
    margin: (v) => `m-${v}`,
    marginX: (v) => `mx-${v}`,
    marginY: (v) => `my-${v}`,
    marginTop: (v) => `mt-${v}`,
    marginRight: (v) => `mr-${v}`,
    marginBottom: (v) => `mb-${v}`,
    marginLeft: (v) => `ml-${v}`,
    gap: (v) => `gap-${v}`,
    gapX: (v) => `gap-x-${v}`,
    gapY: (v) => `gap-y-${v}`,
    borderRadius: (v) => v === "DEFAULT" ? "rounded" : `rounded-${v}`,
    borderWidth: (v) => v === "1" ? "border" : `border-${v}`,
    fontSize: (v) => `text-${v}`,
    fontWeight: (v) => `font-${v}`,
    lineHeight: (v) => `leading-${v}`,
    letterSpacing: (v) => `tracking-${v}`,
    fontFamily: (v) => `font-${v}`,
    textAlign: (v) => `text-${v}`,
    display: (v) => v,
    flexDirection: (v) => v,
    alignItems: (v) => `items-${v}`,
    justifyContent: (v) => `justify-${v}`,
    gridCols: (v) => `grid-cols-${v}`,
    gridRows: (v) => `grid-rows-${v}`,
    width: (v) => `w-${v}`,
    height: (v) => `h-${v}`,
    size: (v) => `size-${v}`,
  };

  const builder = classMap[property];
  if (!builder) return newValue;

  const core = builder(newValue);
  return prefix ? `${prefix}${core}` : core;
}

/** Check if a parsed value is an arbitrary value (wrapped in brackets). */
export function isArbitraryValue(value: string): boolean {
  return value.startsWith("[") && value.endsWith("]");
}

/** Extract the inner value from an arbitrary bracket value. "[1.75rem]" → "1.75rem" */
export function unwrapArbitrary(value: string): string {
  if (isArbitraryValue(value)) return value.slice(1, -1);
  return value;
}

/** Wrap a raw value in brackets for arbitrary syntax. "1.75rem" → "[1.75rem]" */
export function wrapArbitrary(value: string): string {
  if (isArbitraryValue(value)) return value;
  return `[${value}]`;
}

export const SPACING_SCALE = [
  "0", "px", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "5", "6",
  "7", "8", "9", "10", "11", "12", "14", "16", "20", "24", "28", "32",
  "36", "40", "44", "48", "52", "56", "60", "64", "72", "80", "96",
];

export const RADIUS_SCALE = ["none", "sm", "DEFAULT", "md", "lg", "xl", "2xl", "3xl", "full"];

export const FONT_SIZE_SCALE = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"];

export const FONT_WEIGHT_SCALE = ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"];

export const LINE_HEIGHT_SCALE = ["none", "tight", "snug", "normal", "relaxed", "loose"];

export const LETTER_SPACING_SCALE = ["tighter", "tight", "normal", "wide", "wider", "widest"];
