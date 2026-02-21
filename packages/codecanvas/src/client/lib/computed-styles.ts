/**
 * Framework-agnostic computed style categorization.
 * Organizes raw getComputedStyle() values into visual editing categories,
 * filtering out defaults and detecting inherited values.
 *
 * Also provides a "unified" property model that merges class-parsed data
 * (from tailwind-parser) with computed styles, giving classes precedence.
 */
import {
  parseClasses,
  type ParsedProperty,
} from "../../shared/tailwind-parser.js";
import {
  matchValueToToken,
  computedToTailwindClass,
  type TokenMatch,
} from "../../shared/tailwind-map.js";

export type ComputedCategory =
  | "layout"
  | "spacing"
  | "size"
  | "typography"
  | "color"
  | "border"
  | "effects";

export interface ComputedProperty {
  /** CSS property name (kebab-case), e.g. "font-size" */
  property: string;
  /** Human label, e.g. "Font Size" */
  label: string;
  /** The computed value from getComputedStyle() */
  value: string;
  /** Category for UI grouping */
  category: ComputedCategory;
  /** Whether this value is inherited from the parent (same as parent's computed value) */
  inherited: boolean;
  /** The type of control to render */
  controlType: "color" | "length" | "keyword" | "text" | "readonly";
}

export interface CategorizedStyles {
  layout: ComputedProperty[];
  spacing: ComputedProperty[];
  size: ComputedProperty[];
  typography: ComputedProperty[];
  color: ComputedProperty[];
  border: ComputedProperty[];
  effects: ComputedProperty[];
}

/** Property definitions: which CSS properties we care about, organized by category. */
interface PropDef {
  property: string;
  label: string;
  category: ComputedCategory;
  controlType: ComputedProperty["controlType"];
  /** If true, always show this property regardless of default detection */
  alwaysShow?: boolean;
}

const PROP_DEFS: PropDef[] = [
  // Layout
  { property: "display", label: "Display", category: "layout", controlType: "keyword", alwaysShow: true },
  { property: "position", label: "Position", category: "layout", controlType: "keyword" },
  { property: "top", label: "Top", category: "layout", controlType: "length" },
  { property: "right", label: "Right", category: "layout", controlType: "length" },
  { property: "bottom", label: "Bottom", category: "layout", controlType: "length" },
  { property: "left", label: "Left", category: "layout", controlType: "length" },
  { property: "z-index", label: "Z-Index", category: "layout", controlType: "text" },
  { property: "overflow", label: "Overflow", category: "layout", controlType: "keyword" },
  // Flexbox / Grid (only shown when display is flex/grid)
  { property: "flex-direction", label: "Direction", category: "layout", controlType: "keyword" },
  { property: "flex-wrap", label: "Wrap", category: "layout", controlType: "keyword" },
  { property: "justify-content", label: "Justify", category: "layout", controlType: "keyword" },
  { property: "align-items", label: "Align Items", category: "layout", controlType: "keyword" },
  { property: "align-self", label: "Align Self", category: "layout", controlType: "keyword" },
  { property: "gap", label: "Gap", category: "layout", controlType: "length" },
  { property: "row-gap", label: "Row Gap", category: "layout", controlType: "length" },
  { property: "column-gap", label: "Column Gap", category: "layout", controlType: "length" },

  // Size
  { property: "width", label: "Width", category: "size", controlType: "length" },
  { property: "height", label: "Height", category: "size", controlType: "length" },
  { property: "min-width", label: "Min W", category: "size", controlType: "length" },
  { property: "min-height", label: "Min H", category: "size", controlType: "length" },
  { property: "max-width", label: "Max W", category: "size", controlType: "length" },
  { property: "max-height", label: "Max H", category: "size", controlType: "length" },

  // Spacing (always visible — user can add padding/margin to any element)
  { property: "padding-top", label: "Top", category: "spacing", controlType: "length", alwaysShow: true },
  { property: "padding-right", label: "Right", category: "spacing", controlType: "length", alwaysShow: true },
  { property: "padding-bottom", label: "Bottom", category: "spacing", controlType: "length", alwaysShow: true },
  { property: "padding-left", label: "Left", category: "spacing", controlType: "length", alwaysShow: true },
  { property: "margin-top", label: "Top", category: "spacing", controlType: "length", alwaysShow: true },
  { property: "margin-right", label: "Right", category: "spacing", controlType: "length", alwaysShow: true },
  { property: "margin-bottom", label: "Bottom", category: "spacing", controlType: "length", alwaysShow: true },
  { property: "margin-left", label: "Left", category: "spacing", controlType: "length", alwaysShow: true },

  // Typography
  { property: "font-family", label: "Font", category: "typography", controlType: "text", alwaysShow: true },
  { property: "font-size", label: "Size", category: "typography", controlType: "length", alwaysShow: true },
  { property: "font-weight", label: "Weight", category: "typography", controlType: "keyword", alwaysShow: true },
  { property: "line-height", label: "Leading", category: "typography", controlType: "length", alwaysShow: true },
  { property: "letter-spacing", label: "Tracking", category: "typography", controlType: "length", alwaysShow: true },
  { property: "text-align", label: "Align", category: "typography", controlType: "keyword", alwaysShow: true },
  { property: "text-decoration", label: "Decoration", category: "typography", controlType: "keyword", alwaysShow: true },
  { property: "text-transform", label: "Transform", category: "typography", controlType: "keyword", alwaysShow: true },

  // Color
  { property: "color", label: "Text", category: "color", controlType: "color", alwaysShow: true },
  { property: "background-color", label: "Background", category: "color", controlType: "color", alwaysShow: true },

  // Border
  { property: "border-top-width", label: "Top", category: "border", controlType: "length" },
  { property: "border-right-width", label: "Right", category: "border", controlType: "length" },
  { property: "border-bottom-width", label: "Bottom", category: "border", controlType: "length" },
  { property: "border-left-width", label: "Left", category: "border", controlType: "length" },
  { property: "border-color", label: "Color", category: "border", controlType: "color", alwaysShow: true },
  { property: "border-top-left-radius", label: "TL", category: "border", controlType: "length", alwaysShow: true },
  { property: "border-top-right-radius", label: "TR", category: "border", controlType: "length", alwaysShow: true },
  { property: "border-bottom-right-radius", label: "BR", category: "border", controlType: "length", alwaysShow: true },
  { property: "border-bottom-left-radius", label: "BL", category: "border", controlType: "length", alwaysShow: true },

  // Effects
  { property: "opacity", label: "Opacity", category: "effects", controlType: "text", alwaysShow: true },
  { property: "box-shadow", label: "Shadow", category: "effects", controlType: "readonly" },
  { property: "transform", label: "Transform", category: "effects", controlType: "readonly" },
];

/**
 * Properties to HIDE when they have these "unset" values.
 * We only hide properties that are clearly at their zero/none/unset state.
 * The curated PROP_DEFS list is already our filter — we show most properties
 * since seeing actual computed values is the whole point of this panel.
 */
const HIDE_WHEN_VALUES: Record<string, string[]> = {
  // Position offsets: hide when "auto" (not positioned)
  "top": ["auto"],
  "right": ["auto"],
  "bottom": ["auto"],
  "left": ["auto"],
  "z-index": ["auto"],
  // Position: hide when static (the default, uninteresting)
  "position": ["static"],
  // Overflow: hide when visible (default)
  "overflow": ["visible"],
  // Spacing: hide when 0 (no explicit padding/margin set)
  "padding-top": ["0px"],
  "padding-right": ["0px"],
  "padding-bottom": ["0px"],
  "padding-left": ["0px"],
  "margin-top": ["0px"],
  "margin-right": ["0px"],
  "margin-bottom": ["0px"],
  "margin-left": ["0px"],
  // Size constraints: hide when not set
  "min-width": ["0px"],
  "min-height": ["0px"],
  "max-width": ["none"],
  "max-height": ["none"],
  // Border: hide when no border
  "border-top-width": ["0px"],
  "border-right-width": ["0px"],
  "border-bottom-width": ["0px"],
  "border-left-width": ["0px"],
  // Effects: hide only shadow/transform when at default (opacity is alwaysShow)
  "box-shadow": ["none"],
  "transform": ["none"],
  // Align self: hide when auto (follows parent)
  "align-self": ["auto"],
};


/** Properties that inherit from parent by default. */
const INHERITABLE_PROPS = new Set([
  "color", "font-family", "font-size", "font-weight", "line-height",
  "letter-spacing", "text-align", "text-transform", "white-space",
  "text-decoration",
]);

/** Flex/grid-only properties: hide when display is not flex/grid. */
const FLEX_GRID_PROPS = new Set([
  "flex-direction", "flex-wrap", "justify-content", "align-items",
  "gap", "row-gap", "column-gap",
]);

/**
 * Check if a property should be hidden because it's at a clearly unset/zero state.
 * Only hides properties with explicitly boring values — everything else shows.
 */
function shouldHide(prop: string, value: string): boolean {
  const hideValues = HIDE_WHEN_VALUES[prop];
  if (!hideValues) return false;
  return hideValues.some((hv) => value === hv || value.startsWith(hv));
}

/** Sensible default for alwaysShow properties when getComputedStyle returns empty. */
const DEFAULT_VALUES: Record<string, string> = {
  "display": "block",
  "font-family": "sans-serif",
  "font-size": "16px",
  "font-weight": "400",
  "line-height": "normal",
  "letter-spacing": "normal",
  "text-align": "left",
  "text-decoration": "none",
  "text-transform": "none",
  "color": "rgb(0, 0, 0)",
  "background-color": "transparent",
  "border-color": "rgb(0, 0, 0)",
  "border-top-left-radius": "0px",
  "border-top-right-radius": "0px",
  "border-bottom-right-radius": "0px",
  "border-bottom-left-radius": "0px",
  "opacity": "1",
  "padding-top": "0px",
  "padding-right": "0px",
  "padding-bottom": "0px",
  "padding-left": "0px",
  "margin-top": "0px",
  "margin-right": "0px",
  "margin-bottom": "0px",
  "margin-left": "0px",
};

function getDefaultValue(prop: string): string {
  return DEFAULT_VALUES[prop] || "";
}

/**
 * Categorize computed styles into structured sections for the property panel.
 * Shows all curated properties that have meaningful values.
 * Only hides properties that are clearly at their zero/none/unset state,
 * or flex/grid-only props when display is not flex/grid.
 */
export function categorizeComputedStyles(
  _tag: string,
  computedStyles: Record<string, string>,
  parentComputedStyles?: Record<string, string>
): CategorizedStyles {
  const result: CategorizedStyles = {
    layout: [],
    spacing: [],
    size: [],
    typography: [],
    color: [],
    border: [],
    effects: [],
  };

  const display = computedStyles["display"] || "block";
  const isFlexOrGrid = display.includes("flex") || display.includes("grid");

  for (const def of PROP_DEFS) {
    const value = computedStyles[def.property];
    if (value === undefined || value === "") continue;

    // Hide flex/grid-only props when display is not flex/grid
    if (FLEX_GRID_PROPS.has(def.property) && !isFlexOrGrid) continue;

    // Hide properties at clearly unset/zero values (unless alwaysShow)
    if (!def.alwaysShow && shouldHide(def.property, value)) continue;

    // Detect inheritance
    const inherited =
      INHERITABLE_PROPS.has(def.property) &&
      !!parentComputedStyles &&
      parentComputedStyles[def.property] === value;

    result[def.category].push({
      property: def.property,
      label: def.label,
      value,
      category: def.category,
      inherited,
      controlType: def.controlType,
    });
  }

  return result;
}

/**
 * Check if all four sides of a box property have the same value.
 * Returns the shared value if uniform, null otherwise.
 */
export function getUniformBoxValue(
  styles: Record<string, string>,
  prefix: string // e.g. "padding" or "margin" or "border" (for widths: "border-*-width")
): string | null {
  let top: string, right: string, bottom: string, left: string;

  if (prefix === "border-width") {
    top = styles["border-top-width"] || "0px";
    right = styles["border-right-width"] || "0px";
    bottom = styles["border-bottom-width"] || "0px";
    left = styles["border-left-width"] || "0px";
  } else if (prefix === "border-radius") {
    top = styles["border-top-left-radius"] || "0px";
    right = styles["border-top-right-radius"] || "0px";
    bottom = styles["border-bottom-right-radius"] || "0px";
    left = styles["border-bottom-left-radius"] || "0px";
  } else {
    top = styles[`${prefix}-top`] || "0px";
    right = styles[`${prefix}-right`] || "0px";
    bottom = styles[`${prefix}-bottom`] || "0px";
    left = styles[`${prefix}-left`] || "0px";
  }

  if (top === right && right === bottom && bottom === left) return top;
  return null;
}

/**
 * Check if X-axis (left/right) values match and Y-axis (top/bottom) values match.
 * Returns { x, y } if symmetric, null otherwise.
 */
export function getAxisBoxValues(
  styles: Record<string, string>,
  prefix: string
): { x: string; y: string } | null {
  const top = styles[`${prefix}-top`] || "0px";
  const right = styles[`${prefix}-right`] || "0px";
  const bottom = styles[`${prefix}-bottom`] || "0px";
  const left = styles[`${prefix}-left`] || "0px";

  if (top === bottom && left === right) return { x: left, y: top };
  return null;
}

// ---------------------------------------------------------------------------
// Unified Property Model — merges class-parsed data with computed styles
// ---------------------------------------------------------------------------

export interface UnifiedProperty {
  /** CSS property name (kebab-case), e.g. "font-size" */
  cssProperty: string;
  /** Human label, e.g. "Size" */
  label: string;
  /** Category for UI grouping */
  category: ComputedCategory;
  /** The type of control to render */
  controlType: "color" | "length" | "keyword" | "text" | "readonly";
  /** Where this value came from */
  source: "class" | "computed" | "none";
  /** Tailwind token/scale value if from a class (e.g., "4", "blue-600", "sm") */
  tailwindValue: string | null;
  /** Original Tailwind class string (e.g., "text-sm", "p-4") */
  fullClass: string | null;
  /** Raw computed CSS value (e.g., "14px", "rgb(59, 130, 246)") */
  computedValue: string;
  /** Whether this value is inherited from parent */
  inherited: boolean;
  /** Token match if the value traces to a design token */
  tokenMatch: TokenMatch | null;
  /** Whether the property has any value set (false = "add" state) */
  hasValue: boolean;
  /** Whether this is a flex/grid-only property */
  flexGridOnly: boolean;
}

export interface CategorizedUnified {
  layout: UnifiedProperty[];
  spacing: UnifiedProperty[];
  size: UnifiedProperty[];
  typography: UnifiedProperty[];
  color: UnifiedProperty[];
  border: UnifiedProperty[];
  effects: UnifiedProperty[];
}

/**
 * Maps tailwind-parser camelCase property names to CSS kebab-case properties.
 * Shorthands map to arrays of longhand properties they "claim".
 */
const TW_PROP_TO_CSS: Record<string, string | string[]> = {
  // Color
  backgroundColor: "background-color",
  textColor: "color",
  borderColor: "border-color",
  ringColor: "outline-color",
  outlineColor: "outline-color",
  // Spacing — individual
  paddingTop: "padding-top",
  paddingRight: "padding-right",
  paddingBottom: "padding-bottom",
  paddingLeft: "padding-left",
  marginTop: "margin-top",
  marginRight: "margin-right",
  marginBottom: "margin-bottom",
  marginLeft: "margin-left",
  // Spacing — shorthands
  padding: ["padding-top", "padding-right", "padding-bottom", "padding-left"],
  paddingX: ["padding-left", "padding-right"],
  paddingY: ["padding-top", "padding-bottom"],
  margin: ["margin-top", "margin-right", "margin-bottom", "margin-left"],
  marginX: ["margin-left", "margin-right"],
  marginY: ["margin-top", "margin-bottom"],
  // Gap
  gap: "gap",
  gapX: "column-gap",
  gapY: "row-gap",
  // Shape
  borderRadius: ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"],
  borderWidth: ["border-top-width", "border-right-width", "border-bottom-width", "border-left-width"],
  // Typography
  fontSize: "font-size",
  fontWeight: "font-weight",
  lineHeight: "line-height",
  letterSpacing: "letter-spacing",
  fontFamily: "font-family",
  textAlign: "text-align",
  textTransform: "text-transform",
  textDecoration: "text-decoration",
  // Layout
  display: "display",
  position: "position",
  flexDirection: "flex-direction",
  flexWrap: "flex-wrap",
  alignItems: "align-items",
  justifyContent: "justify-content",
  alignSelf: "align-self",
  overflow: "overflow",
  // Size
  width: "width",
  height: "height",
  minWidth: "min-width",
  minHeight: "min-height",
  maxWidth: "max-width",
  maxHeight: "max-height",
};

/** Tags considered text elements — get typography props recommended. */
const TEXT_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a", "label",
  "strong", "em", "b", "i", "small", "blockquote", "li", "dt", "dd",
  "figcaption", "caption", "th", "td", "legend", "summary",
]);

/** Tags considered block elements — get spacing + size props recommended. */
const BLOCK_TAGS = new Set([
  "div", "section", "article", "aside", "nav", "header", "footer", "main",
  "form", "fieldset", "figure", "details", "dialog", "ul", "ol",
]);

/** Properties recommended for text tags (shown as addable even when unset). */
const TEXT_RECOMMENDED = new Set([
  "font-size", "font-weight", "line-height", "letter-spacing",
  "text-align", "color",
]);

/** Properties recommended for block tags (shown as addable even when unset). */
const BLOCK_RECOMMENDED = new Set([
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin-top", "margin-bottom", "width", "height", "background-color",
]);

/** Check if a property is recommended for a given tag. */
function isRecommended(tag: string, cssProp: string): boolean {
  if (TEXT_TAGS.has(tag) && TEXT_RECOMMENDED.has(cssProp)) return true;
  if (BLOCK_TAGS.has(tag) && BLOCK_RECOMMENDED.has(cssProp)) return true;
  // All elements get some basics
  if (TEXT_TAGS.has(tag) && BLOCK_RECOMMENDED.has(cssProp)) return true;
  return false;
}

/**
 * Build a unified property model by merging class-parsed data with computed styles.
 * Classes take precedence: if a Tailwind class sets a property, we show the
 * Tailwind value (token/scale name) rather than the raw computed value.
 * All sections always have entries — unset properties are included with hasValue: false
 * if they're recommended for the element tag.
 */
export function buildUnifiedProperties(
  tag: string,
  className: string,
  computedStyles: Record<string, string>,
  parentComputedStyles: Record<string, string>,
  tokenGroups: Record<string, any[]>,
): CategorizedUnified {
  const result: CategorizedUnified = {
    layout: [],
    spacing: [],
    size: [],
    typography: [],
    color: [],
    border: [],
    effects: [],
  };

  // Step 1: Parse classes and build a lookup of CSS property → ParsedProperty
  const parsed = parseClasses(className || "");
  const classClaims = new Map<string, ParsedProperty>();

  const allParsed: ParsedProperty[] = [
    ...parsed.color, ...parsed.spacing, ...parsed.shape,
    ...parsed.typography, ...parsed.layout, ...parsed.size,
    ...parsed.other,
  ];

  for (const pp of allParsed) {
    const cssMapping = TW_PROP_TO_CSS[pp.property];
    if (!cssMapping) continue;

    if (Array.isArray(cssMapping)) {
      // Shorthand: claim all longhand properties
      for (const cssProp of cssMapping) {
        if (!classClaims.has(cssProp)) {
          classClaims.set(cssProp, pp);
        }
      }
    } else {
      if (!classClaims.has(cssMapping)) {
        classClaims.set(cssMapping, pp);
      }
    }
  }

  // Step 2: Walk every PropDef and build UnifiedProperty
  for (const def of PROP_DEFS) {
    const isFlexGridProp = FLEX_GRID_PROPS.has(def.property);
    const claimed = classClaims.get(def.property);
    const computedValue = computedStyles[def.property] || "";
    const isHidden = !computedValue || shouldHide(def.property, computedValue);

    // Detect inheritance
    const inherited =
      INHERITABLE_PROPS.has(def.property) &&
      !!parentComputedStyles[def.property] &&
      parentComputedStyles[def.property] === computedValue;

    // Try token match on the computed value
    const tokenMatch = computedValue
      ? matchValueToToken(def.property, computedValue, tokenGroups)
      : null;

    // Size properties only show when explicitly set via a Tailwind class.
    // Their computed values are misleading (e.g. every element has a computed width).
    const sizeOnly = def.category === "size";

    // Layout properties are class-only EXCEPT: flex/grid sub-props (align-items,
    // justify-content, flex-direction, etc.) should appear as addable rows when
    // display is flex/grid (so the user can add them from the panel).
    const displayClaim = classClaims.get("display");
    const isFlexGridDisplay = displayClaim &&
      (displayClaim.value.includes("flex") || displayClaim.value.includes("grid"));
    const layoutOnly = def.category === "layout";

    let prop: UnifiedProperty;

    if (claimed) {
      // Source: class — Tailwind class explicitly sets this property
      prop = {
        cssProperty: def.property,
        label: def.label,
        category: def.category,
        controlType: def.controlType,
        source: "class",
        tailwindValue: claimed.value,
        fullClass: claimed.fullClass,
        computedValue,
        inherited,
        tokenMatch,
        hasValue: true,
        flexGridOnly: isFlexGridProp,
      };
    } else if (sizeOnly) {
      // Skip size properties not set via class — computed values are noise
      continue;
    } else if (layoutOnly && !def.alwaysShow) {
      // Layout: show flex/grid sub-props as addable rows when display is flex/grid
      // (alwaysShow layout props like "display" bypass this and fall through below)
      if (isFlexGridDisplay && isFlexGridProp) {
        prop = {
          cssProperty: def.property,
          label: def.label,
          category: def.category,
          controlType: def.controlType,
          source: "none",
          tailwindValue: null,
          fullClass: null,
          computedValue,
          inherited: false,
          tokenMatch: null,
          hasValue: false,
          flexGridOnly: true,
        };
      } else {
        continue;
      }
    } else if (def.alwaysShow) {
      // alwaysShow: always include, even if computed value is empty or hidden
      const displayValue = computedValue || getDefaultValue(def.property);
      const twMatch = displayValue ? computedToTailwindClass(def.property, displayValue) : null;
      // Don't show computed-to-tailwind matches for zero/default values — they're not real classes
      const isZeroDefault = (displayValue === "0px" || displayValue === "0" || displayValue === "0%");
      prop = {
        cssProperty: def.property,
        label: def.label,
        category: def.category,
        controlType: def.controlType,
        source: computedValue ? "computed" : "none",
        tailwindValue: (twMatch?.exact && !isZeroDefault) ? twMatch.tailwindClass : null,
        fullClass: null, // computed/default — not an actual class on the element
        computedValue: displayValue,
        inherited,
        tokenMatch,
        hasValue: true,
        flexGridOnly: isFlexGridProp,
      };
    } else if (!isHidden) {
      // Source: computed — has a meaningful, non-hidden computed value
      if (!computedValue) continue;
      const twMatch = computedToTailwindClass(def.property, computedValue);
      prop = {
        cssProperty: def.property,
        label: def.label,
        category: def.category,
        controlType: def.controlType,
        source: "computed",
        tailwindValue: twMatch?.exact ? twMatch.tailwindClass : null,
        fullClass: null, // computed — not an actual class on the element
        computedValue,
        inherited,
        tokenMatch,
        hasValue: true,
        flexGridOnly: isFlexGridProp,
      };
    } else if (isRecommended(tag, def.property)) {
      // Source: none — no value set, but recommended for this element tag
      prop = {
        cssProperty: def.property,
        label: def.label,
        category: def.category,
        controlType: def.controlType,
        source: "none",
        tailwindValue: null,
        fullClass: null,
        computedValue,
        inherited: false,
        tokenMatch: null,
        hasValue: false,
        flexGridOnly: isFlexGridProp,
      };
    } else {
      // Not claimed, not meaningful computed, not recommended, not alwaysShow — skip
      continue;
    }

    result[def.category].push(prop);
  }

  return result;
}
