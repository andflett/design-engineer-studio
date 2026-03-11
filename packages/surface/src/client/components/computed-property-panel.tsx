/**
 * Unified property panel driven by classes (precedence) + computed styles (fallback).
 * Shows categorized CSS properties with Figma-style controls:
 *   - ScaleInput: composite icon + scale dropdown OR arbitrary text input + toggle
 *   - ScrubInput: icon-inside-input with drag-to-scrub for numeric values
 *   - SegmentedIcons: icon toggle groups for text-align, decoration, transform
 *   - Always-visible sections with "add" affordance for unset properties
 *   - Descriptive tooltips on layout/alignment controls
 */
import { useState } from "react";
import {
  PlusIcon,
  RowsIcon,
  GridIcon,
  ColumnsIcon,
  AlignLeftIcon,
  AlignCenterHorizontallyIcon,
  AlignRightIcon,
  SpaceBetweenHorizontallyIcon,
  AlignTopIcon,
  AlignCenterVerticallyIcon,
  AlignBottomIcon,
  PaddingIcon,
  MarginIcon,
  FontFamilyIcon,
  FontSizeIcon,
  FontBoldIcon,
  LineHeightIcon,
  LetterSpacingIcon,
  CornersIcon,
  BorderWidthIcon,
  BorderStyleIcon,
  EyeNoneIcon,
  TextAlignLeftIcon,
  TextAlignCenterIcon,
  TextAlignRightIcon,
  TextAlignJustifyIcon,
  UnderlineIcon,
  StrikethroughIcon,
  LetterCaseUppercaseIcon,
  LetterCaseLowercaseIcon,
  LetterCaseCapitalizeIcon,
  StretchHorizontallyIcon,
  TextNoneIcon,
  BoxIcon,
  LayoutIcon,
  TextAlignTopIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@radix-ui/react-icons";
import { Crosshair, Pin, ArrowRight, ArrowDown, ArrowLeft, ArrowUp, WrapText, AlignJustify, Columns3, LayoutGrid, Maximize2, Move, Type, Palette, Square, Sparkles } from "lucide-react";
import {
  buildUnifiedProperties,
  getUniformBoxValue,
  type UnifiedProperty,
  type ComputedCategory,
} from "../lib/computed-styles.js";
import {
  computedToTailwindClass,
  uniformRadiusToTailwind,
} from "../../shared/tailwind-map.js";
import type { ResolvedTailwindTheme } from "../../shared/tailwind-theme.js";
import { getThemeScales, type TwScales } from "./controls/tailwind-maps.js";
import { Tooltip } from "./tooltip.js";
import {
  ScrubInput,
  SegmentedIcons,
  ScaleInput,
  PropLabel,
  SubSectionLabel,
  getPropertyIcon,
  KeywordControl,
  ShadowPicker,
  GradientPicker,
  OpacitySlider,
  BoxSpacingControl,
  BoxRadiusControl,
  type ShadowItem,
  type GradientItem,
  CSS_PROP_TO_TW_PREFIX,
} from "./controls/index.js";
import { ColorInput } from "./controls/color-input.js";
import { useTokens, useShadows, useGradients } from "../lib/scan-hooks.js";

/**
 * Extract the token key from an authored `var(--prefix-key)` reference.
 * E.g. `extractVarTokenKey("var(--space-xl)", "--space")` → `"xl"`.
 * Returns null if the authored value doesn't match the expected pattern.
 */
function extractVarTokenKey(
  authoredValue: string | null | undefined,
  varPrefix: string | null | undefined,
): string | null {
  if (!authoredValue || !varPrefix) return null;
  const match = authoredValue.match(/var\(\s*(--[\w-]+)\s*[,)]/);
  if (!match) return null;
  const varName = match[1];
  if (varName.startsWith(varPrefix + "-")) {
    return varName.slice(varPrefix.length + 1);
  }
  return null;
}

/**
 * Extract the variable name from an authored `var(--foo)` reference.
 * Returns the name without the `--` prefix.
 * E.g. `extractVarName("var(--color-primary)")` → `"color-primary"`.
 */
function extractVarName(authoredValue: string | null | undefined): string | null {
  if (!authoredValue) return null;
  const match = authoredValue.match(/var\(\s*(--[\w-]+)\s*[,)]/);
  if (!match) return null;
  return match[1].replace(/^--/, "");
}

interface ComputedPropertyPanelProps {
  tag: string;
  className: string;
  computedStyles: Record<string, string>;
  parentComputedStyles: Record<string, string>;
  /** Authored CSS values from stylesheets (may contain CSS functions like clamp(), var()) */
  authoredStyles?: Record<string, string | null>;
  /** When true, all controls are disabled and values are display-only */
  isReadOnly?: boolean;
  /** Package name shown in the read-only banner */
  readOnlyPackageName?: string;
  /** Navigate to the nearest ancestor with instanceSource */
  onSelectParentInstance?: () => void;
  onPreviewInlineStyle: (property: string, value: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (tailwindClass: string, oldClass?: string) => void;
  /** CSS mode: commit raw CSS property/value instead of Tailwind classes */
  onCommitStyle?: (cssProp: string, cssValue: string) => void;
  theme?: ResolvedTailwindTheme | null;
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function ComputedPropertyPanel({
  tag,
  className: elementClassName,
  computedStyles,
  parentComputedStyles,
  authoredStyles,
  isReadOnly,
  readOnlyPackageName,
  onSelectParentInstance,
  onPreviewInlineStyle,
  onRevertInlineStyles,
  onCommitClass,
  onCommitStyle,
  theme,
}: ComputedPropertyPanelProps) {
  const tokenData = useTokens();
  const shadowData = useShadows();
  const gradientData = useGradients();
  const tokenGroups = tokenData?.groups || {};
  const shadows: ShadowItem[] | undefined = shadowData?.shadows;
  const gradients: GradientItem[] | undefined = gradientData?.gradients;
  const categorized = buildUnifiedProperties(
    tag, elementClassName, computedStyles, parentComputedStyles, tokenGroups, authoredStyles,
  );

  const sections: { key: ComputedCategory; label: string; icon: React.ReactNode }[] = [
    { key: "layout",     label: "Layout",     icon: <LayoutGrid size={12} /> },
    { key: "size",       label: "Size",       icon: <Maximize2 size={12} /> },
    { key: "spacing",    label: "Spacing",    icon: <Move size={12} /> },
    { key: "typography", label: "Typography", icon: <Type size={12} /> },
    { key: "color",      label: "Color",      icon: <Palette size={12} /> },
    { key: "border",     label: "Border",     icon: <Square size={12} /> },
    { key: "effects",    label: "Effects",    icon: <Sparkles size={12} /> },
  ];

  const nonEmpty = sections.filter((s) => categorized[s.key].length > 0);

  if (nonEmpty.length === 0) {
    return (
      <div
        className="text-[11px] px-4 py-3"
        style={{ color: "var(--studio-text-dimmed)" }}
      >
        No styles to display
      </div>
    );
  }

  const displayValue = computedStyles["display"] || "block";
  const isCssMode = !!onCommitStyle;
  // In CSS mode, only show scales if they came from CSS variables (has varPrefixes)
  const twScales = isCssMode
    ? (theme?.varPrefixes ? getThemeScales(theme) : undefined)
    : getThemeScales(theme);

  // In read-only mode, replace callbacks with no-ops
  const effectivePreview = isReadOnly ? () => {} : onPreviewInlineStyle;
  const effectiveRevert = isReadOnly ? () => {} : onRevertInlineStyles;
  const effectiveCommitClass = isReadOnly ? () => {} : onCommitClass;
  const effectiveCommitStyle = isReadOnly ? undefined : onCommitStyle;

  return (
    <div>
      {isReadOnly && (
        <div
          className="px-4 py-2.5"
          style={{ borderBottom: "1px solid var(--studio-border-subtle)" }}
        >
          <div
            className="text-[10px] px-2.5 py-2 rounded"
            style={{
              color: "var(--studio-text-dimmed)",
              background: "var(--studio-surface-hover)",
              lineHeight: 1.5,
            }}
          >
            This element is from{" "}
            <span className="font-mono font-semibold" style={{ color: "var(--studio-text-muted)" }}>
              {readOnlyPackageName || "an external package"}
            </span>{" "}
            and cannot be edited directly.
            {onSelectParentInstance && (
              <button
                onClick={onSelectParentInstance}
                className="block mt-1.5 text-[10px] font-medium"
                style={{
                  color: "var(--studio-accent)",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                Select parent instance to override styles
              </button>
            )}
          </div>
        </div>
      )}
      <div style={isReadOnly ? { pointerEvents: "none", opacity: 0.45 } : undefined}>
      {nonEmpty.map((section) => (
        <UnifiedSection
          key={section.key}
          category={section.key}
          label={section.label}
          icon={section.icon}
          properties={categorized[section.key]}
          computedStyles={computedStyles}
          tokenGroups={tokenGroups}
          shadows={shadows}
          gradients={gradients}
          displayValue={displayValue}
          elementClassName={elementClassName}
          onPreviewInlineStyle={effectivePreview}
          onRevertInlineStyles={effectiveRevert}
          onCommitClass={effectiveCommitClass}
          onCommitStyle={effectiveCommitStyle}
          theme={theme}
          twScales={twScales}
        />
      ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function UnifiedSection({
  category,
  label,
  icon,
  properties,
  computedStyles,
  tokenGroups,
  shadows,
  gradients,
  displayValue,
  elementClassName,
  onPreviewInlineStyle,
  onRevertInlineStyles,
  onCommitClass,
  onCommitStyle,
  theme,
  twScales,
}: {
  category: ComputedCategory;
  label: string;
  icon?: React.ReactNode;
  properties: UnifiedProperty[];
  computedStyles: Record<string, string>;
  tokenGroups: Record<string, any[]>;
  shadows?: ShadowItem[];
  gradients?: GradientItem[];
  displayValue: string;
  elementClassName: string;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (c: string, oldClass?: string) => void;
  onCommitStyle?: (cssProp: string, cssValue: string) => void;
  theme?: ResolvedTailwindTheme | null;
  twScales?: TwScales;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const activeProps = properties.filter((p) => p.hasValue);
  const addableProps = properties.filter((p) => !p.hasValue);
  const count = activeProps.length;

  return (
    <div style={{ borderTop: "1px solid var(--studio-border-subtle)" }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="studio-section-hdr"
      >
        <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
        <span style={{ opacity: 0.35, display: "flex", alignItems: "center", marginLeft: "auto" }}>
          {collapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
        </span>
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-4 pb-4 px-4">
          {category === "layout" ? (
            <LayoutSection
              properties={properties}
              displayValue={displayValue}
              tokenGroups={tokenGroups}
              onPreviewInlineStyle={onPreviewInlineStyle}
              onRevertInlineStyles={onRevertInlineStyles}
              onCommitClass={onCommitClass}
              onCommitStyle={onCommitStyle}
            />
          ) : category === "spacing" ? (
            <SpacingSection
              properties={properties}
              computedStyles={computedStyles}
              tokenGroups={tokenGroups}
              onPreviewInlineStyle={onPreviewInlineStyle}
              onRevertInlineStyles={onRevertInlineStyles}
              onCommitClass={onCommitClass}
              onCommitStyle={onCommitStyle}
              spacingScale={twScales?.spacing}
              spacingVarPrefix={twScales?.propToScale?.["padding-top"]?.varPrefix}
              theme={theme}
            />
          ) : category === "border" ? (
            <BorderSection
              properties={properties}
              computedStyles={computedStyles}
              tokenGroups={tokenGroups}
              onPreviewInlineStyle={onPreviewInlineStyle}
              onRevertInlineStyles={onRevertInlineStyles}
              onCommitClass={onCommitClass}
              onCommitStyle={onCommitStyle}
              twScales={twScales}
              theme={theme}
            />
          ) : category === "size" ? (
            <SizeSection
              properties={properties}
              tokenGroups={tokenGroups}
              onPreviewInlineStyle={onPreviewInlineStyle}
              onRevertInlineStyles={onRevertInlineStyles}
              onCommitClass={onCommitClass}
              onCommitStyle={onCommitStyle}
              twScales={twScales}
            />
          ) : category === "typography" ? (
            <TypographySection
              properties={properties}
              tokenGroups={tokenGroups}
              onPreviewInlineStyle={onPreviewInlineStyle}
              onRevertInlineStyles={onRevertInlineStyles}
              onCommitClass={onCommitClass}
              onCommitStyle={onCommitStyle}
              twScales={twScales}
              theme={theme}
            />
          ) : category === "effects" ? (
            <EffectsSection
              properties={properties}
              tokenGroups={tokenGroups}
              shadows={shadows}
              gradients={gradients}
              elementClassName={elementClassName}
              onPreviewInlineStyle={onPreviewInlineStyle}
              onRevertInlineStyles={onRevertInlineStyles}
              onCommitClass={onCommitClass}
              onCommitStyle={onCommitStyle}
              twScales={twScales}
            />
          ) : (
            activeProps.map((prop) => (
              <UnifiedControl
                key={prop.cssProperty}
                prop={prop}
                tokenGroups={tokenGroups}
                onPreviewInlineStyle={onPreviewInlineStyle}
                onRevertInlineStyles={onRevertInlineStyles}
                onCommitClass={onCommitClass}
                onCommitStyle={onCommitStyle}
                twScales={twScales}
              />
            ))
          )}

          {/* Addable rows — layout/spacing/border/size/typography/effects handle their own */}
          {!["layout", "spacing", "border", "size", "typography", "effects"].includes(category) && addableProps.length > 0 && (
            <AddableRows
              properties={addableProps}
              tokenGroups={tokenGroups}
              onPreviewInlineStyle={onPreviewInlineStyle}
              onRevertInlineStyles={onRevertInlineStyles}
              onCommitClass={onCommitClass}
              onCommitStyle={onCommitStyle}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout section — icon segmented controls with tooltips
// ---------------------------------------------------------------------------

const DISPLAY_OPTIONS = [
  { value: "flex", icon: LayoutIcon, label: "Flex", tooltip: "Flex — arrange children in a row or column" },
  { value: "grid", icon: GridIcon, label: "Grid", tooltip: "Grid — arrange children in a 2D grid" },
  { value: "block", icon: BoxIcon, label: "Block", tooltip: "Block — stack vertically, full width" },
  { value: "none", icon: EyeNoneIcon, label: "None", tooltip: "Hidden — remove from layout" },
];

const ALIGN_OPTIONS = [
  { value: "flex-start", icon: AlignTopIcon, label: "Start", tooltip: "Start — align to start of cross axis" },
  { value: "center", icon: AlignCenterVerticallyIcon, label: "Center", tooltip: "Center — center on cross axis" },
  { value: "flex-end", icon: AlignBottomIcon, label: "End", tooltip: "End — align to end of cross axis" },
  { value: "stretch", icon: StretchHorizontallyIcon, label: "Stretch", tooltip: "Stretch — fill cross axis" },
];

const JUSTIFY_OPTIONS = [
  { value: "flex-start", icon: AlignLeftIcon, label: "Start", tooltip: "Start — pack to start of main axis" },
  { value: "center", icon: AlignCenterHorizontallyIcon, label: "Center", tooltip: "Center — center on main axis" },
  { value: "flex-end", icon: AlignRightIcon, label: "End", tooltip: "End — pack to end of main axis" },
  { value: "space-between", icon: SpaceBetweenHorizontallyIcon, label: "Between", tooltip: "Between — equal space between items" },
];

// Position icon wrappers (match { style?: React.CSSProperties } interface)
const StaticIcon = ({ style }: { style?: React.CSSProperties }) => (
  <svg width={style?.width ?? 14} height={style?.height ?? 14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="2" y="3" width="10" height="8" rx="1" />
    <line x1="4" y1="6" x2="10" y2="6" />
    <line x1="4" y1="8.5" x2="8" y2="8.5" />
  </svg>
);
const RelativeIcon = ({ style }: { style?: React.CSSProperties }) => (
  <svg width={style?.width ?? 14} height={style?.height ?? 14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="1.5" y="3" width="8" height="8" rx="1" strokeDasharray="2 2" />
    <rect x="4.5" y="1.5" width="8" height="8" rx="1" />
  </svg>
);
const CrosshairIcon = ({ style }: { style?: React.CSSProperties }) => (
  <Crosshair size={style?.width ?? 14} style={style} />
);
const PinIcon = ({ style }: { style?: React.CSSProperties }) => (
  <Pin size={style?.width ?? 14} style={style} />
);
const StickyIcon = ({ style }: { style?: React.CSSProperties }) => (
  <svg width={style?.width ?? 14} height={style?.height ?? 14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="2" y="1.5" width="10" height="3" rx="0.75" />
    <rect x="2" y="6" width="10" height="6.5" rx="1" strokeDasharray="2 2" />
  </svg>
);

const POSITION_OPTIONS = [
  { value: "static", icon: StaticIcon, label: "Static", tooltip: "Static — default document flow" },
  { value: "relative", icon: RelativeIcon, label: "Relative", tooltip: "Relative — offset from normal position" },
  { value: "absolute", icon: CrosshairIcon, label: "Absolute", tooltip: "Absolute — positioned relative to ancestor" },
  { value: "fixed", icon: PinIcon, label: "Fixed", tooltip: "Fixed — positioned relative to viewport" },
  { value: "sticky", icon: StickyIcon, label: "Sticky", tooltip: "Sticky — toggles between relative and fixed" },
];

// Lucide icon wrapper for SegmentedIcons (passes style with width/height)
const lc = (Icon: typeof ArrowRight) =>
  function LucideWrap({ style }: { style?: React.CSSProperties }) {
    return <Icon size={style?.width ?? 14} strokeWidth={1.5} style={style} />;
  };

const DIRECTION_OPTIONS = [
  {
    value: "row",
    icon: Columns3,
    label: "Row",
    tooltip: "Row — items flow horizontally",
  },
  {
    value: "column",
    icon: Columns3,
    iconClassName: "-rotate-90",
    label: "Column",
    tooltip: "Column — items flow vertically",
  },
  {
    value: "row-reverse",
    icon: TextAlignTopIcon,
    iconClassName: "-rotate-90",
    label: "Row Rev",
    tooltip: "Row Reverse — items flow right to left",
  },
  {
    value: "column-reverse",
    icon: TextAlignTopIcon,
    iconClassName: "relative top-[2px]",
    label: "Col Rev",
    tooltip: "Column Reverse — items flow bottom to top",
  },
];

const WRAP_OPTIONS = [
  {
    value: "wrap",
    icon: lc(WrapText),
    label: "Wrap",
    tooltip: "Wrap — items wrap to next line",
  },
  {
    value: "nowrap",
    icon: lc(AlignJustify),
    label: "No Wrap",
    tooltip: "No Wrap — all items on one line",
  },
];

function LayoutSection({
  properties,
  displayValue,
  tokenGroups,
  onPreviewInlineStyle,
  onRevertInlineStyles,
  onCommitClass,
  onCommitStyle,
}: {
  properties: UnifiedProperty[];
  displayValue: string;
  tokenGroups: Record<string, any[]>;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (c: string, oldClass?: string) => void;
  onCommitStyle?: (cssProp: string, cssValue: string) => void;
}) {
  const segmentedKeys = new Set(["display", "position", "align-items", "justify-content", "flex-direction", "flex-wrap"]);
  const displayProp = properties.find((p) => p.cssProperty === "display");
  const positionProp = properties.find((p) => p.cssProperty === "position");
  const directionProp = properties.find((p) => p.cssProperty === "flex-direction");
  const wrapProp = properties.find((p) => p.cssProperty === "flex-wrap");
  const alignProp = properties.find((p) => p.cssProperty === "align-items");
  const justifyProp = properties.find((p) => p.cssProperty === "justify-content");
  const otherProps = properties.filter(
    (p) => !segmentedKeys.has(p.cssProperty) && p.hasValue && !p.flexGridOnly
  );
  const flexGridActiveProps = properties.filter(
    (p) => !segmentedKeys.has(p.cssProperty) && p.hasValue && p.flexGridOnly
  );
  const flexGridAddableProps = properties.filter(
    (p) => !segmentedKeys.has(p.cssProperty) && !p.hasValue && p.flexGridOnly
  );

  const isFlexGrid = displayValue.includes("flex") || displayValue.includes("grid");

  const handleSegmentedChange = (cssProp: string, cssValue: string) => {
    onPreviewInlineStyle(cssProp, cssValue);
    if (onCommitStyle) {
      onCommitStyle(cssProp, cssValue);
    } else {
      const match = computedToTailwindClass(cssProp, cssValue);
      if (match) {
        const prop = properties.find((p) => p.cssProperty === cssProp);
        const oldClass = prop?.fullClass || undefined;
        onCommitClass(match.tailwindClass, oldClass);
      }
    }
  };

  return (
    <>
      {displayProp && (
        <div>
          <PropLabel label="Display" inherited={displayProp.inherited} />
          <SegmentedIcons
            options={DISPLAY_OPTIONS}
            value={displayProp.computedValue}
            onChange={(v) => handleSegmentedChange("display", v)}
          />
        </div>
      )}
      {positionProp && (
        <div>
          <PropLabel label="Position" inherited={positionProp.inherited} />
          <SegmentedIcons
            options={POSITION_OPTIONS}
            value={positionProp.computedValue}
            onChange={(v) => handleSegmentedChange("position", v)}
          />
        </div>
      )}
      {isFlexGrid && directionProp && (
        <div>
          <PropLabel
            label="Flex Direction"
            inherited={directionProp.inherited}
          />
          <SegmentedIcons
            options={DIRECTION_OPTIONS}
            value={directionProp.computedValue}
            onChange={(v) => handleSegmentedChange("flex-direction", v)}
          />
        </div>
      )}
      {isFlexGrid && justifyProp && (
        <div>
          <PropLabel
            label="Justify Content"
            inherited={justifyProp.inherited}
          />
          <SegmentedIcons
            options={JUSTIFY_OPTIONS}
            value={justifyProp.computedValue}
            onChange={(v) => handleSegmentedChange("justify-content", v)}
          />
        </div>
      )}
      {isFlexGrid && alignProp && (
        <div>
          <PropLabel label="Align Items" inherited={alignProp.inherited} />
          <SegmentedIcons
            options={ALIGN_OPTIONS}
            value={alignProp.computedValue}
            onChange={(v) => handleSegmentedChange("align-items", v)}
          />
        </div>
      )}
      {isFlexGrid && wrapProp && (
        <div>
          <PropLabel label="Wrap" inherited={wrapProp.inherited} />
          <SegmentedIcons
            options={WRAP_OPTIONS}
            value={wrapProp.computedValue}
            onChange={(v) => handleSegmentedChange("flex-wrap", v)}
          />
        </div>
      )}
      {isFlexGrid &&
        flexGridActiveProps.map((prop) => (
          <UnifiedControl
            key={prop.cssProperty}
            prop={prop}
            tokenGroups={tokenGroups}
            onPreviewInlineStyle={onPreviewInlineStyle}
            onRevertInlineStyles={onRevertInlineStyles}
            onCommitClass={onCommitClass}
            onCommitStyle={onCommitStyle}
          />
        ))}
      {isFlexGrid && flexGridAddableProps.length > 0 && (
        <AddableRows
          properties={flexGridAddableProps}
          tokenGroups={tokenGroups}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onRevertInlineStyles={onRevertInlineStyles}
          onCommitClass={onCommitClass}
          onCommitStyle={onCommitStyle}
        />
      )}
      {otherProps.map((prop) => (
        <UnifiedControl
          key={prop.cssProperty}
          prop={prop}
          tokenGroups={tokenGroups}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onRevertInlineStyles={onRevertInlineStyles}
          onCommitClass={onCommitClass}
          onCommitStyle={onCommitStyle}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Size section — paired W/H inputs (only shows when set via Tailwind class)
// ---------------------------------------------------------------------------

function SizeSection({
  properties,
  tokenGroups,
  onPreviewInlineStyle,
  onRevertInlineStyles,
  onCommitClass,
  onCommitStyle,
  twScales,
}: {
  properties: UnifiedProperty[];
  tokenGroups: Record<string, any[]>;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (c: string, oldClass?: string) => void;
  onCommitStyle?: (cssProp: string, cssValue: string) => void;
  twScales?: TwScales;
}) {
  const active = properties.filter((p) => p.hasValue);
  const widthProp = active.find((p) => p.cssProperty === "width");
  const heightProp = active.find((p) => p.cssProperty === "height");
  const others = active.filter((p) => p.cssProperty !== "width" && p.cssProperty !== "height");

  return (
    <>
      {(widthProp || heightProp) && (
        <div className="grid grid-cols-2 gap-1.5">
          {widthProp && (
            <UnifiedControl
              prop={widthProp}
              tokenGroups={tokenGroups}
              onPreviewInlineStyle={onPreviewInlineStyle}
              onRevertInlineStyles={onRevertInlineStyles}
              onCommitClass={onCommitClass}
              onCommitStyle={onCommitStyle}
              twScales={twScales}
            />
          )}
          {heightProp && (
            <UnifiedControl
              prop={heightProp}
              tokenGroups={tokenGroups}
              onPreviewInlineStyle={onPreviewInlineStyle}
              onRevertInlineStyles={onRevertInlineStyles}
              onCommitClass={onCommitClass}
              onCommitStyle={onCommitStyle}
              twScales={twScales}
            />
          )}
        </div>
      )}
      {others.map((prop) => (
        <UnifiedControl
          key={prop.cssProperty}
          prop={prop}
          tokenGroups={tokenGroups}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onRevertInlineStyles={onRevertInlineStyles}
          onCommitClass={onCommitClass}
          onCommitStyle={onCommitStyle}
          twScales={twScales}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Spacing section — single shorthand per box with expand toggle
// ---------------------------------------------------------------------------

function SpacingSection({
  properties,
  computedStyles,
  tokenGroups,
  onPreviewInlineStyle,
  onRevertInlineStyles,
  onCommitClass,
  onCommitStyle,
  spacingScale,
  spacingVarPrefix,
  theme,
}: {
  properties: UnifiedProperty[];
  computedStyles: Record<string, string>;
  tokenGroups: Record<string, any[]>;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (c: string, oldClass?: string) => void;
  onCommitStyle?: (cssProp: string, cssValue: string) => void;
  spacingScale?: readonly string[];
  spacingVarPrefix?: string;
  theme?: ResolvedTailwindTheme | null;
}) {
  const activeProps = properties.filter((p) => p.hasValue);
  const paddingProps = activeProps.filter((p) => p.cssProperty.startsWith("padding-"));
  const marginProps = activeProps.filter((p) => p.cssProperty.startsWith("margin-"));
  const addableProps = properties.filter((p) => !p.hasValue);

  return (
    <>
      {paddingProps.length > 0 && (
        <BoxSpacingControl
          box="padding"
          icon={PaddingIcon}
          activeProps={paddingProps}
          allProperties={properties}
          computedStyles={computedStyles}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onCommitClass={onCommitClass}
          onCommitStyle={onCommitStyle}
          spacingScale={spacingScale}
          spacingVarPrefix={spacingVarPrefix}
          theme={theme}
        />
      )}

      {marginProps.length > 0 && (
        <BoxSpacingControl
          box="margin"
          icon={MarginIcon}
          activeProps={marginProps}
          allProperties={properties}
          computedStyles={computedStyles}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onCommitClass={onCommitClass}
          onCommitStyle={onCommitStyle}
          spacingScale={spacingScale}
          spacingVarPrefix={spacingVarPrefix}
          theme={theme}
        />
      )}

      {addableProps.length > 0 && (
        <AddableRows
          properties={addableProps}
          tokenGroups={tokenGroups}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onRevertInlineStyles={onRevertInlineStyles}
          onCommitClass={onCommitClass}
          onCommitStyle={onCommitStyle}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Typography section — all controls always visible
// ---------------------------------------------------------------------------

const TEXT_ALIGN_OPTIONS = [
  { value: "left", icon: TextAlignLeftIcon, label: "Left", tooltip: "Left — align text to left" },
  { value: "center", icon: TextAlignCenterIcon, label: "Center", tooltip: "Center — center text" },
  { value: "right", icon: TextAlignRightIcon, label: "Right", tooltip: "Right — align text to right" },
  { value: "justify", icon: TextAlignJustifyIcon, label: "Justify", tooltip: "Justify — stretch to fill width" },
];

const TEXT_DECORATION_OPTIONS = [
  { value: "none", icon: TextNoneIcon, label: "None", tooltip: "None — no decoration" },
  { value: "underline", icon: UnderlineIcon, label: "Underline", tooltip: "Underline — line below text" },
  { value: "line-through", icon: StrikethroughIcon, label: "Strikethrough", tooltip: "Strikethrough — line through text" },
];

const TEXT_TRANSFORM_OPTIONS = [
  { value: "none", icon: TextNoneIcon, label: "None", tooltip: "None — no transform" },
  { value: "uppercase", icon: LetterCaseUppercaseIcon, label: "Uppercase", tooltip: "Uppercase — ALL CAPS" },
  { value: "lowercase", icon: LetterCaseLowercaseIcon, label: "Lowercase", tooltip: "Lowercase — all lowercase" },
  { value: "capitalize", icon: LetterCaseCapitalizeIcon, label: "Capitalize", tooltip: "Capitalize — First Letter" },
];

const FONT_FAMILY_SCALE = ["sans", "serif", "mono"];

function TypographySection({
  properties,
  tokenGroups,
  onPreviewInlineStyle,
  onRevertInlineStyles,
  onCommitClass,
  onCommitStyle,
  twScales,
  theme,
}: {
  properties: UnifiedProperty[];
  tokenGroups: Record<string, any[]>;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (c: string, oldClass?: string) => void;
  onCommitStyle?: (cssProp: string, cssValue: string) => void;
  twScales?: TwScales;
  theme?: ResolvedTailwindTheme | null;
}) {
  const isCssMode = !!onCommitStyle;
  const findProp = (cssProp: string) => properties.find((p) => p.cssProperty === cssProp);
  /**
   * Get display value for a property:
   * - Tailwind mode: return tailwindValue (e.g. "text-lg")
   * - CSS mode: extract token key from authored var() reference (e.g. "xl" from "var(--text-xl)")
   */
  const displayVal = (p: UnifiedProperty | undefined, cssProp?: string) => {
    if (!p) return null;
    if (!isCssMode) return p.tailwindValue ?? null;
    // In CSS mode, try to extract token key from authored var() reference
    const vp = cssProp ? twScales?.propToScale?.[cssProp]?.varPrefix : null;
    return extractVarTokenKey(p.authoredValue, vp);
  };

  const fontFamily = findProp("font-family");
  const fontSize = findProp("font-size");
  const fontWeight = findProp("font-weight");
  const lineHeight = findProp("line-height");
  const letterSpacing = findProp("letter-spacing");
  const textAlign = findProp("text-align");
  const textDecoration = findProp("text-decoration");
  const textTransform = findProp("text-transform");

  const handleSegmentedChange = (cssProp: string, cssValue: string) => {
    onPreviewInlineStyle(cssProp, cssValue);
    if (onCommitStyle) {
      onCommitStyle(cssProp, cssValue);
    } else {
      const match = computedToTailwindClass(cssProp, cssValue, theme);
      if (match) {
        const prop = findProp(cssProp);
        const oldClass = prop?.fullClass || undefined;
        onCommitClass(match.tailwindClass, oldClass);
      }
    }
  };

  // Addable props that aren't one of the 8 main typography controls
  const mainCssProps = ["font-family", "font-size", "font-weight", "line-height", "letter-spacing", "text-align", "text-decoration", "text-transform"];
  const otherActive = properties.filter((p) => p.hasValue && !mainCssProps.includes(p.cssProperty));
  const addableProps = properties.filter((p) => !p.hasValue && !mainCssProps.includes(p.cssProperty));

  return (
    <>
      {/* Font Family */}
      {fontFamily && (
        <div>
          <PropLabel label="Font Family" inherited={fontFamily.inherited} />
          <ScaleInput
            icon={FontFamilyIcon}
            value={displayVal(fontFamily, "font-family") || fontFamily.computedValue}
            computedValue={fontFamily.computedValue}
            currentClass={fontFamily.fullClass}
            scale={twScales ? FONT_FAMILY_SCALE : []}
            prefix="font"
            cssProp="font-family"
            onPreview={(v) => onPreviewInlineStyle("font-family", v)}
            onCommitClass={onCommitClass}
            onCommitStyle={onCommitStyle ? (v) => onCommitStyle("font-family", v) : undefined}
          />
        </div>
      )}

      {/* Font Size + Font Weight in a 2-col grid */}
      {(fontSize || fontWeight) && (
        <div className="grid grid-cols-2 gap-1.5">
          {fontSize && (
            <div>
              <PropLabel label="Size" inherited={fontSize.inherited} />
              <ScaleInput
                icon={FontSizeIcon}
                value={displayVal(fontSize, "font-size") || fontSize.computedValue}
                computedValue={fontSize.computedValue}
                currentClass={fontSize.fullClass}
                scale={(twScales?.fontSize ?? []) as string[]}
                prefix="text"
                cssProp="font-size"
                onPreview={(v) => onPreviewInlineStyle("font-size", v)}
                onCommitClass={onCommitClass}
                onCommitStyle={onCommitStyle ? (v) => onCommitStyle("font-size", v) : undefined}
                varPrefix={twScales?.propToScale?.["font-size"]?.varPrefix}
              />
            </div>
          )}
          {fontWeight && (
            <div>
              <PropLabel label="Weight" inherited={fontWeight.inherited} />
              <ScaleInput
                icon={FontBoldIcon}
                value={displayVal(fontWeight, "font-weight") || fontWeight.computedValue}
                computedValue={fontWeight.computedValue}
                currentClass={fontWeight.fullClass}
                scale={(twScales?.fontWeight ?? []) as string[]}
                prefix="font"
                cssProp="font-weight"
                onPreview={(v) => onPreviewInlineStyle("font-weight", v)}
                onCommitClass={onCommitClass}
                onCommitStyle={onCommitStyle ? (v) => onCommitStyle("font-weight", v) : undefined}
                varPrefix={twScales?.propToScale?.["font-weight"]?.varPrefix}
              />
            </div>
          )}
        </div>
      )}

      {/* Line Height + Letter Spacing in a 2-col grid */}
      {(lineHeight || letterSpacing) && (
        <div className="grid grid-cols-2 gap-1.5">
          {lineHeight && (
            <div>
              <PropLabel label="Leading" inherited={lineHeight.inherited} />
              <ScaleInput
                icon={LineHeightIcon}
                value={displayVal(lineHeight, "line-height") || lineHeight.computedValue}
                computedValue={lineHeight.computedValue}
                currentClass={lineHeight.fullClass}
                scale={(twScales?.lineHeight ?? []) as string[]}
                prefix="leading"
                cssProp="line-height"
                onPreview={(v) => onPreviewInlineStyle("line-height", v)}
                onCommitClass={onCommitClass}
                onCommitStyle={onCommitStyle ? (v) => onCommitStyle("line-height", v) : undefined}
                varPrefix={twScales?.propToScale?.["line-height"]?.varPrefix}
              />
            </div>
          )}
          {letterSpacing && (
            <div>
              <PropLabel label="Tracking" inherited={letterSpacing.inherited} />
              <ScaleInput
                icon={LetterSpacingIcon}
                value={displayVal(letterSpacing, "letter-spacing") || letterSpacing.computedValue}
                computedValue={letterSpacing.computedValue}
                currentClass={letterSpacing.fullClass}
                scale={(twScales?.letterSpacing ?? []) as string[]}
                prefix="tracking"
                cssProp="letter-spacing"
                onPreview={(v) => onPreviewInlineStyle("letter-spacing", v)}
                onCommitClass={onCommitClass}
                onCommitStyle={onCommitStyle ? (v) => onCommitStyle("letter-spacing", v) : undefined}
                varPrefix={twScales?.propToScale?.["letter-spacing"]?.varPrefix}
              />
            </div>
          )}
        </div>
      )}

      {/* Text Align — segmented icons */}
      {textAlign && (
        <div>
          <PropLabel label="Text Align" inherited={textAlign.inherited} />
          <SegmentedIcons
            options={TEXT_ALIGN_OPTIONS}
            value={textAlign.computedValue}
            onChange={(v) => handleSegmentedChange("text-align", v)}
          />
        </div>
      )}

      {/* Text Decoration — segmented icons */}
      {textDecoration && (
        <div>
          <PropLabel label="Decoration" inherited={textDecoration.inherited} />
          <SegmentedIcons
            options={TEXT_DECORATION_OPTIONS}
            value={textDecoration.computedValue}
            onChange={(v) => handleSegmentedChange("text-decoration", v)}
          />
        </div>
      )}

      {/* Text Transform — segmented icons */}
      {textTransform && (
        <div>
          <PropLabel label="Transform" inherited={textTransform.inherited} />
          <SegmentedIcons
            options={TEXT_TRANSFORM_OPTIONS}
            value={textTransform.computedValue}
            onChange={(v) => handleSegmentedChange("text-transform", v)}
          />
        </div>
      )}

      {/* Other active typography props */}
      {otherActive.map((prop) => (
        <UnifiedControl
          key={prop.cssProperty}
          prop={prop}
          tokenGroups={tokenGroups}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onRevertInlineStyles={onRevertInlineStyles}
          onCommitClass={onCommitClass}
          onCommitStyle={onCommitStyle}
        />
      ))}

      {addableProps.length > 0 && (
        <AddableRows
          properties={addableProps}
          tokenGroups={tokenGroups}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onRevertInlineStyles={onRevertInlineStyles}
          onCommitClass={onCommitClass}
          onCommitStyle={onCommitStyle}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Border section — smart shorthand for radius/width
// ---------------------------------------------------------------------------

function BorderSection({
  properties,
  computedStyles,
  tokenGroups,
  onPreviewInlineStyle,
  onRevertInlineStyles,
  onCommitClass,
  onCommitStyle,
  twScales,
  theme,
}: {
  properties: UnifiedProperty[];
  computedStyles: Record<string, string>;
  tokenGroups: Record<string, any[]>;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (c: string, oldClass?: string) => void;
  onCommitStyle?: (cssProp: string, cssValue: string) => void;
  twScales?: TwScales;
  theme?: ResolvedTailwindTheme | null;
}) {
  const active = properties.filter((p) => p.hasValue);
  const allRadiusProps = properties.filter((p) => p.cssProperty.includes("radius"));
  const radiusProps = active.filter((p) => p.cssProperty.includes("radius"));
  const widthProps = active.filter((p) => p.cssProperty.includes("width"));
  const borderStyleProp = properties.find((p) => p.cssProperty === "border-style");
  const otherProps = active.filter(
    (p) => !p.cssProperty.includes("radius") && !p.cssProperty.includes("width") && p.cssProperty !== "border-style"
  );

  const uniformBorderWidth = getUniformBoxValue(computedStyles, "border-width");

  return (
    <>
      {radiusProps.length > 0 && (
        <BoxRadiusControl
          activeProps={radiusProps}
          allProperties={allRadiusProps}
          computedStyles={computedStyles}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onCommitClass={onCommitClass}
          onCommitStyle={onCommitStyle}
          radiusScale={twScales?.borderRadius}
        />
      )}

      <div>
        <PropLabel label="Width" />
        {uniformBorderWidth || widthProps.length === 0 ? (
          <ScaleInput
            icon={BorderWidthIcon}
            value={
              (!onCommitStyle ? widthProps[0]?.tailwindValue : null) ||
              (!uniformBorderWidth ||
              uniformBorderWidth === "0px" ||
              uniformBorderWidth === "0"
                ? "—"
                : uniformBorderWidth)
            }
            computedValue={uniformBorderWidth || "0px"}
            currentClass={widthProps[0]?.fullClass || null}
            scale={(twScales?.borderWidth ?? []) as string[]}
            prefix="border"
            cssProp="border-width"
            onPreview={(v) => onPreviewInlineStyle("border-width", v)}
            onCommitClass={(cls, oldClass) => {
              // "border-1" is not a valid Tailwind class — "border" (no suffix) = 1px
              const fixedClass = cls === "border-1" ? "border" : cls;
              onCommitClass(fixedClass, oldClass);
            }}
            onCommitStyle={onCommitStyle ? (v) => onCommitStyle("border-width", v) : undefined}
            varPrefix={twScales?.propToScale?.["border-width"]?.varPrefix}
          />
        ) : (
          widthProps.map((prop) => (
            <UnifiedControl
              key={prop.cssProperty}
              prop={prop}
              tokenGroups={tokenGroups}
              onPreviewInlineStyle={onPreviewInlineStyle}
              onRevertInlineStyles={onRevertInlineStyles}
              onCommitClass={onCommitClass}
              onCommitStyle={onCommitStyle}
            />
          ))
        )}
      </div>

      {borderStyleProp && (() => {
        // Resolve var(--tw-border-style) and similar CSS variable references to the computed value
        const resolvedValue = borderStyleProp.computedValue || "none";
        // Show "—" when border-width is effectively 0 (the style is just a Tailwind default)
        const hasBorder = uniformBorderWidth && uniformBorderWidth !== "0px" && uniformBorderWidth !== "0";
        const displayValue = hasBorder ? resolvedValue : "—";
        const styleProp: UnifiedProperty = {
          ...borderStyleProp,
          computedValue: displayValue,
        };
        return (
          <div>
            <PropLabel label="Style" />
            <KeywordControl
              prop={styleProp}
              onPreviewInlineStyle={onPreviewInlineStyle}
              onCommitClass={onCommitClass}
              onCommitStyle={onCommitStyle}
            />
          </div>
        );
      })()}

      {otherProps.map((prop) => (
        <UnifiedControl
          key={prop.cssProperty}
          prop={prop}
          tokenGroups={tokenGroups}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onRevertInlineStyles={onRevertInlineStyles}
          onCommitClass={onCommitClass}
          onCommitStyle={onCommitStyle}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Effects section — opacity slider + shadow/gradient pickers
// ---------------------------------------------------------------------------

function EffectsSection({
  properties,
  tokenGroups,
  shadows,
  gradients,
  elementClassName,
  onPreviewInlineStyle,
  onRevertInlineStyles,
  onCommitClass,
  onCommitStyle,
  twScales,
}: {
  properties: UnifiedProperty[];
  tokenGroups: Record<string, any[]>;
  shadows?: ShadowItem[];
  gradients?: GradientItem[];
  elementClassName: string;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (c: string, oldClass?: string) => void;
  onCommitStyle?: (cssProp: string, cssValue: string) => void;
  twScales?: TwScales;
}) {
  const opacityProp = properties.find((p) => p.cssProperty === "opacity");
  const shadowProp = properties.find((p) => p.cssProperty === "box-shadow");
  const gradientProp = properties.find((p) => p.cssProperty === "background-image");
  const transformProp = properties.find((p) => p.cssProperty === "transform");
  const otherProps = properties.filter(
    (p) => !["opacity", "box-shadow", "background-image", "transform"].includes(p.cssProperty) && p.hasValue
  );

  return (
    <>
      {/* Opacity */}
      {opacityProp && (
        <div>
          <PropLabel label={opacityProp.label} inherited={opacityProp.inherited} />
          <OpacitySlider
            value={opacityProp.computedValue}
            scale={twScales?.opacity || []}
            onPreview={(v) => onPreviewInlineStyle("opacity", v)}
            onCommitClass={onCommitClass}
            onCommitStyle={onCommitStyle ? (v) => onCommitStyle("opacity", v) : undefined}
          />
        </div>
      )}

      {/* Shadow picker */}
      {shadowProp && (
        <div>
          <PropLabel label="Shadow" inherited={shadowProp.inherited} />
          <ShadowPicker
            prop={shadowProp}
            shadows={shadows}
            scale={twScales?.boxShadow || []}
            elementClassName={elementClassName}
            onPreviewInlineStyle={onPreviewInlineStyle}
            onCommitClass={onCommitClass}
            onCommitStyle={onCommitStyle ? (v) => onCommitStyle("box-shadow", v) : undefined}
          />
        </div>
      )}

      {/* Gradient picker */}
      {gradientProp && gradientProp.hasValue && (
        <div>
          <PropLabel label="Gradient" inherited={gradientProp.inherited} />
          <GradientPicker
            prop={gradientProp}
            gradients={gradients}
            elementClassName={elementClassName}
            onPreviewInlineStyle={onPreviewInlineStyle}
            onCommitClass={onCommitClass}
          />
        </div>
      )}
      {!gradientProp && gradients && gradients.length > 0 && (
        <div>
          <PropLabel label="Gradient" inherited={false} />
          <GradientPicker
            prop={null}
            gradients={gradients}
            elementClassName={elementClassName}
            onPreviewInlineStyle={onPreviewInlineStyle}
            onCommitClass={onCommitClass}
          />
        </div>
      )}

      {/* Transform (readonly) */}
      {transformProp && transformProp.hasValue && (
        <UnifiedControl
          prop={transformProp}
          tokenGroups={tokenGroups}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onRevertInlineStyles={onRevertInlineStyles}
          onCommitClass={onCommitClass}
          onCommitStyle={onCommitStyle}
        />
      )}

      {/* Other effects */}
      {otherProps.map((prop) => (
        <UnifiedControl
          key={prop.cssProperty}
          prop={prop}
          tokenGroups={tokenGroups}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onRevertInlineStyles={onRevertInlineStyles}
          onCommitClass={onCommitClass}
          onCommitStyle={onCommitStyle}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Addable rows — visible rows with background, clickable to add
// ---------------------------------------------------------------------------

function AddableRows({
  properties,
  tokenGroups,
  onPreviewInlineStyle,
  onRevertInlineStyles,
  onCommitClass,
  onCommitStyle,
}: {
  properties: UnifiedProperty[];
  tokenGroups: Record<string, any[]>;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (c: string, oldClass?: string) => void;
  onCommitStyle?: (cssProp: string, cssValue: string) => void;
}) {
  const [activated, setActivated] = useState<Set<string>>(new Set());

  return (
    <>
      {properties.map((prop) => {
        if (activated.has(prop.cssProperty)) {
          return (
            <UnifiedControl
              key={prop.cssProperty}
              prop={{ ...prop, hasValue: true }}
              tokenGroups={tokenGroups}
              onPreviewInlineStyle={onPreviewInlineStyle}
              onRevertInlineStyles={onRevertInlineStyles}
              onCommitClass={onCommitClass}
              onCommitStyle={onCommitStyle}
            />
          );
        }
        return (
          <button
            key={prop.cssProperty}
            onClick={() => setActivated((s) => new Set(s).add(prop.cssProperty))}
            className="studio-addable-row"
          >
            <span className="studio-addable-label">
              {prop.label}
            </span>
            <PlusIcon style={{ width: 12, height: 12, flexShrink: 0 }} />
          </button>
        );
      })}
    </>
  );
}


// ---------------------------------------------------------------------------
// FunctionRawInput — editable text input for CSS function values
// ---------------------------------------------------------------------------

function FunctionRawInput({
  prop,
  onCommitStyle,
  onCommitClass,
}: {
  prop: UnifiedProperty;
  onCommitStyle?: (cssProp: string, cssValue: string) => void;
  onCommitClass: (c: string, oldClass?: string) => void;
}) {
  const [editValue, setEditValue] = useState(prop.authoredValue || prop.computedValue);

  const commit = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed) return;
    if (onCommitStyle) {
      onCommitStyle(prop.cssProperty, trimmed);
    } else {
      const prefix = CSS_PROP_TO_TW_PREFIX[prop.cssProperty];
      if (prefix) {
        onCommitClass(`${prefix}-[${trimmed.replace(/ /g, "_")}]`, prop.fullClass || undefined);
      }
    }
  };

  return (
    <div>
      <PropLabel label={prop.label} inherited={prop.inherited} />
      <div className="studio-scrub-input">
        <input
          className="studio-input"
          style={{ flex: 1, fontSize: 11, fontFamily: "monospace" }}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.currentTarget.blur(); }
            if (e.key === "Escape") { setEditValue(prop.authoredValue || prop.computedValue); }
          }}
        />
      </div>
      {prop.authoredValue && prop.authoredValue !== prop.computedValue && (
        <div
          className="text-[10px] mt-0.5 truncate"
          style={{ color: "var(--studio-text-dimmed)", paddingLeft: 8 }}
          title={prop.computedValue}
        >
          → {prop.computedValue}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unified control — handles tiered rendering
// Priority: color → design token → tailwind scale → keyword → scrub input
// ---------------------------------------------------------------------------

function UnifiedControl({
  prop,
  tokenGroups,
  onPreviewInlineStyle,
  onRevertInlineStyles: _revert,
  onCommitClass,
  onCommitStyle,
  twScales,
}: {
  prop: UnifiedProperty;
  tokenGroups: Record<string, any[]>;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (c: string, oldClass?: string) => void;
  onCommitStyle?: (cssProp: string, cssValue: string) => void;
  twScales?: TwScales;
}) {
  // 1. Color controls
  if (prop.controlType === "color") {
    const colorTokens: Array<{ name: string; value: string }> = [];
    for (const [, tokens] of Object.entries(tokenGroups)) {
      for (const t of tokens as any[]) {
        if (t.category === "color") {
          const name = t.name.replace(/^--/, "");
          if (!colorTokens.some((ct) => ct.name === name)) {
            colorTokens.push({ name, value: t.lightValue || "" });
          }
        }
      }
    }

    const twPrefix = prop.cssProperty === "color" ? "text"
      : prop.cssProperty === "background-color" ? "bg"
      : "border";

    const hasToken = !!prop.tokenMatch;
    const authoredVarName = extractVarName(prop.authoredValue);
    const displayLabel = hasToken
      ? prop.tokenMatch!.tokenName
      : authoredVarName
        ? authoredVarName
        : (prop.tailwindValue || prop.computedValue);

    return (
      <div>
        <PropLabel label={prop.label} inherited={prop.inherited} />
        <ColorInput
          color={prop.computedValue}
          label={displayLabel}
          tabs="both"
          defaultTab="tokens"
          tokens={colorTokens}
          activeToken={hasToken ? prop.tokenMatch!.tokenName : undefined}
          onSelectToken={(token) => {
            if (onCommitStyle) {
              // In CSS mode, find the token's resolved value from colorTokens
              const t = colorTokens.find((ct) => ct.name === token);
              if (t) onCommitStyle(prop.cssProperty, `var(--${token})`);
            } else {
              onCommitClass(`${twPrefix}-${token}`);
            }
          }}
          onChange={(c) => onPreviewInlineStyle(prop.cssProperty, c)}
          onCommit={(c) => {
            if (onCommitStyle) {
              onCommitStyle(prop.cssProperty, c);
            } else {
              const oldClass = prop.fullClass || undefined;
              onCommitClass(`${twPrefix}-[${c.replace(/\s+/g, "_")}]`, oldClass);
            }
          }}
        />
      </div>
    );
  }

  // 2. Readonly
  if (prop.controlType === "readonly") {
    const Icon = getPropertyIcon(prop.cssProperty);
    return (
      <div>
        <PropLabel label={prop.label} inherited={prop.inherited} />
        <div className="studio-scrub-input">
          {Icon && (
            <Tooltip content={prop.cssProperty} side="left">
              <div className="studio-scale-icon">
                <Icon style={{ width: 12, height: 12 }} />
              </div>
            </Tooltip>
          )}
          <Tooltip content={prop.computedValue} side="bottom">
            <div
              className="studio-scrub-value"
              style={{ color: "var(--studio-text)", cursor: "default" }}
            >
              {prop.computedValue}
            </div>
          </Tooltip>
        </div>
      </div>
    );
  }

  // 3. CSS function value — show authored value, not resolved computed
  // Skip for Tailwind-claimed properties: calc() is generated output (e.g. calc(0.25rem * 10)
  // for h-10), not user-authored. Let it fall through to the Tailwind scale input instead.
  if (prop.isFunction && prop.authoredValue && !prop.tailwindValue) {
    return (
      <FunctionRawInput
        prop={prop}
        onCommitStyle={onCommitStyle}
        onCommitClass={onCommitClass}
      />
    );
  }

  // 4. Design token match → use ScaleInput with token group as scale
  if (prop.tokenMatch) {
    const tm = prop.tokenMatch;
    const twPrefix = CSS_PROP_TO_TW_PREFIX[prop.cssProperty] || "";
    return (
      <div>
        <PropLabel label={prop.label} inherited={prop.inherited} />
        <ScaleInput
          icon={getPropertyIcon(prop.cssProperty)}
          value={tm.tokenName}
          computedValue={prop.computedValue}
          currentClass={prop.fullClass}
          scale={tm.groupTokens.map((t) => t.name)}
          prefix={twPrefix}
          cssProp={prop.cssProperty}
          onPreview={(v) => onPreviewInlineStyle(prop.cssProperty, v)}
          onCommitClass={onCommitClass}
          onCommitStyle={onCommitStyle ? (v) => onCommitStyle(prop.cssProperty, v) : undefined}
        />
      </div>
    );
  }

  // 4a. Opacity → slider
  if (prop.cssProperty === "opacity") {
    return (
      <div>
        <PropLabel label={prop.label} inherited={prop.inherited} />
        <OpacitySlider
          value={prop.computedValue}
          scale={twScales?.opacity || []}
          onPreview={(v) => onPreviewInlineStyle("opacity", v)}
          onCommitClass={onCommitClass}
        />
      </div>
    );
  }

  // 4. Tailwind scale → ScaleInput
  const twScale = twScales?.propToScale?.[prop.cssProperty];
  if (twScale) {
    // In CSS mode (has varPrefix): extract token key from authored var() reference
    // In Tailwind mode: use reverse-mapped class name
    const tokenKey = twScale.varPrefix
      ? extractVarTokenKey(prop.authoredValue, twScale.varPrefix)
      : prop.tailwindValue;
    // Show "—" for zero/default computed values when no explicit class exists
    const isZeroDefault = !tokenKey && (prop.computedValue === "0px" || prop.computedValue === "0");
    const displayValue = isZeroDefault ? "—" : (tokenKey || prop.computedValue);
    return (
      <div>
        <PropLabel label={prop.label} inherited={prop.inherited} />
        <ScaleInput
          icon={getPropertyIcon(prop.cssProperty)}
          value={displayValue}
          computedValue={prop.computedValue}
          currentClass={prop.fullClass}
          scale={twScale.scale as string[]}
          prefix={twScale.prefix}
          cssProp={prop.cssProperty}
          onPreview={(v) => onPreviewInlineStyle(prop.cssProperty, v)}
          onCommitClass={onCommitClass}
          onCommitStyle={onCommitStyle ? (v) => onCommitStyle(prop.cssProperty, v) : undefined}
          varPrefix={twScale.varPrefix}
        />
      </div>
    );
  }

  // 5. Keyword dropdown
  if (prop.controlType === "keyword") {
    return (
      <div>
        <PropLabel label={prop.label} inherited={prop.inherited} />
        <KeywordControl
          prop={prop}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onCommitClass={onCommitClass}
          onCommitStyle={onCommitStyle}
        />
      </div>
    );
  }

  // 6. Fallback — ScrubInput
  return (
    <div>
      <PropLabel label={prop.label} inherited={prop.inherited} />
      <ScrubInput
        icon={getPropertyIcon(prop.cssProperty)}
        value={prop.computedValue}
        tooltip={prop.cssProperty}
        onPreview={(v) => onPreviewInlineStyle(prop.cssProperty, v)}
        onCommit={(v) => {
          if (onCommitStyle) {
            onCommitStyle(prop.cssProperty, v);
          } else {
            const match = computedToTailwindClass(prop.cssProperty, v);
            if (match) onCommitClass(match.tailwindClass);
          }
        }}
      />
    </div>
  );
}

