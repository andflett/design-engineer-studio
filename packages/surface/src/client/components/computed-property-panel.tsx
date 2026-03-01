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
  ChevronRightIcon,
  ChevronDownIcon,
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
} from "@radix-ui/react-icons";
import { Crosshair, Pin } from "lucide-react";
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
import {
  FONT_SIZE_SCALE,
  FONT_WEIGHT_SCALE,
  LINE_HEIGHT_SCALE,
  LETTER_SPACING_SCALE,
  RADIUS_SCALE,
  BORDER_WIDTH_SCALE,
} from "../../shared/tailwind-parser.js";
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
  CSS_PROP_TO_TW_SCALE,
} from "./controls/index.js";
import { ColorInput } from "./controls/color-input.js";
import { useTokens, useShadows, useGradients } from "../lib/scan-hooks.js";

interface ComputedPropertyPanelProps {
  tag: string;
  className: string;
  computedStyles: Record<string, string>;
  parentComputedStyles: Record<string, string>;
  onPreviewInlineStyle: (property: string, value: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (tailwindClass: string, oldClass?: string) => void;
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function ComputedPropertyPanel({
  tag,
  className: elementClassName,
  computedStyles,
  parentComputedStyles,
  onPreviewInlineStyle,
  onRevertInlineStyles,
  onCommitClass,
}: ComputedPropertyPanelProps) {
  const tokenData = useTokens();
  const shadowData = useShadows();
  const gradientData = useGradients();
  const tokenGroups = tokenData?.groups || {};
  const shadows: ShadowItem[] | undefined = shadowData?.shadows;
  const gradients: GradientItem[] | undefined = gradientData?.gradients;
  const categorized = buildUnifiedProperties(
    tag, elementClassName, computedStyles, parentComputedStyles, tokenGroups,
  );

  const sections: { key: ComputedCategory; label: string }[] = [
    { key: "layout", label: "Layout" },
    { key: "size", label: "Size" },
    { key: "spacing", label: "Spacing" },
    { key: "typography", label: "Typography" },
    { key: "color", label: "Color" },
    { key: "border", label: "Border" },
    { key: "effects", label: "Effects" },
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

  return (
    <div>
      {nonEmpty.map((section) => (
        <UnifiedSection
          key={section.key}
          category={section.key}
          label={section.label}
          properties={categorized[section.key]}
          computedStyles={computedStyles}
          tokenGroups={tokenGroups}
          shadows={shadows}
          gradients={gradients}
          displayValue={displayValue}
          elementClassName={elementClassName}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onRevertInlineStyles={onRevertInlineStyles}
          onCommitClass={onCommitClass}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function UnifiedSection({
  category,
  label,
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
}: {
  category: ComputedCategory;
  label: string;
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
        {collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
        {label}
        {count > 0 && <span className="count">{count}</span>}
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
            />
          ) : category === "spacing" ? (
            <SpacingSection
              properties={properties}
              computedStyles={computedStyles}
              tokenGroups={tokenGroups}
              onPreviewInlineStyle={onPreviewInlineStyle}
              onRevertInlineStyles={onRevertInlineStyles}
              onCommitClass={onCommitClass}
            />
          ) : category === "border" ? (
            <BorderSection
              properties={properties}
              computedStyles={computedStyles}
              tokenGroups={tokenGroups}
              onPreviewInlineStyle={onPreviewInlineStyle}
              onRevertInlineStyles={onRevertInlineStyles}
              onCommitClass={onCommitClass}
            />
          ) : category === "size" ? (
            <SizeSection
              properties={properties}
              tokenGroups={tokenGroups}
              onPreviewInlineStyle={onPreviewInlineStyle}
              onRevertInlineStyles={onRevertInlineStyles}
              onCommitClass={onCommitClass}
            />
          ) : category === "typography" ? (
            <TypographySection
              properties={properties}
              tokenGroups={tokenGroups}
              onPreviewInlineStyle={onPreviewInlineStyle}
              onRevertInlineStyles={onRevertInlineStyles}
              onCommitClass={onCommitClass}
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

function LayoutSection({
  properties,
  displayValue,
  tokenGroups,
  onPreviewInlineStyle,
  onRevertInlineStyles,
  onCommitClass,
}: {
  properties: UnifiedProperty[];
  displayValue: string;
  tokenGroups: Record<string, any[]>;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (c: string, oldClass?: string) => void;
}) {
  const displayProp = properties.find((p) => p.cssProperty === "display");
  const positionProp = properties.find((p) => p.cssProperty === "position");
  const alignProp = properties.find((p) => p.cssProperty === "align-items");
  const justifyProp = properties.find((p) => p.cssProperty === "justify-content");
  const otherProps = properties.filter(
    (p) => !["display", "position", "align-items", "justify-content"].includes(p.cssProperty) && p.hasValue && !p.flexGridOnly
  );
  const flexGridActiveProps = properties.filter(
    (p) => !["display", "position", "align-items", "justify-content"].includes(p.cssProperty) && p.hasValue && p.flexGridOnly
  );
  const flexGridAddableProps = properties.filter(
    (p) => !["display", "position", "align-items", "justify-content"].includes(p.cssProperty) && !p.hasValue && p.flexGridOnly
  );

  const isFlexGrid = displayValue.includes("flex") || displayValue.includes("grid");

  const handleSegmentedChange = (cssProp: string, cssValue: string) => {
    onPreviewInlineStyle(cssProp, cssValue);
    const match = computedToTailwindClass(cssProp, cssValue);
    if (match) {
      const prop = properties.find((p) => p.cssProperty === cssProp);
      const oldClass = prop?.fullClass || undefined;
      onCommitClass(match.tailwindClass, oldClass);
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
      {isFlexGrid && justifyProp && (
        <div>
          <PropLabel label="Justify" inherited={justifyProp.inherited} />
          <SegmentedIcons
            options={JUSTIFY_OPTIONS}
            value={justifyProp.computedValue}
            onChange={(v) => handleSegmentedChange("justify-content", v)}
          />
        </div>
      )}
      {isFlexGrid && flexGridActiveProps.map((prop) => (
        <UnifiedControl
          key={prop.cssProperty}
          prop={prop}
          tokenGroups={tokenGroups}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onRevertInlineStyles={onRevertInlineStyles}
          onCommitClass={onCommitClass}
        />
      ))}
      {isFlexGrid && flexGridAddableProps.length > 0 && (
        <AddableRows
          properties={flexGridAddableProps}
          tokenGroups={tokenGroups}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onRevertInlineStyles={onRevertInlineStyles}
          onCommitClass={onCommitClass}
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
}: {
  properties: UnifiedProperty[];
  tokenGroups: Record<string, any[]>;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (c: string, oldClass?: string) => void;
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
            />
          )}
          {heightProp && (
            <UnifiedControl
              prop={heightProp}
              tokenGroups={tokenGroups}
              onPreviewInlineStyle={onPreviewInlineStyle}
              onRevertInlineStyles={onRevertInlineStyles}
              onCommitClass={onCommitClass}
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
}: {
  properties: UnifiedProperty[];
  computedStyles: Record<string, string>;
  tokenGroups: Record<string, any[]>;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (c: string, oldClass?: string) => void;
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
        />
      )}

      {addableProps.length > 0 && (
        <AddableRows
          properties={addableProps}
          tokenGroups={tokenGroups}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onRevertInlineStyles={onRevertInlineStyles}
          onCommitClass={onCommitClass}
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
}: {
  properties: UnifiedProperty[];
  tokenGroups: Record<string, any[]>;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (c: string, oldClass?: string) => void;
}) {
  const findProp = (cssProp: string) => properties.find((p) => p.cssProperty === cssProp);

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
    const match = computedToTailwindClass(cssProp, cssValue);
    if (match) {
      // Find the old class to replace (from the prop's current fullClass)
      const prop = findProp(cssProp);
      const oldClass = prop?.fullClass || undefined;
      onCommitClass(match.tailwindClass, oldClass);
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
            value={fontFamily.tailwindValue || fontFamily.computedValue}
            computedValue={fontFamily.computedValue}
            currentClass={fontFamily.fullClass}
            scale={FONT_FAMILY_SCALE}
            prefix="font"
            cssProp="font-family"
            onPreview={(v) => onPreviewInlineStyle("font-family", v)}
            onCommitClass={onCommitClass}
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
                value={fontSize.tailwindValue || fontSize.computedValue}
                computedValue={fontSize.computedValue}
                currentClass={fontSize.fullClass}
                scale={FONT_SIZE_SCALE as string[]}
                prefix="text"
                cssProp="font-size"
                onPreview={(v) => onPreviewInlineStyle("font-size", v)}
                onCommitClass={onCommitClass}
              />
            </div>
          )}
          {fontWeight && (
            <div>
              <PropLabel label="Weight" inherited={fontWeight.inherited} />
              <ScaleInput
                icon={FontBoldIcon}
                value={fontWeight.tailwindValue || fontWeight.computedValue}
                computedValue={fontWeight.computedValue}
                currentClass={fontWeight.fullClass}
                scale={FONT_WEIGHT_SCALE as string[]}
                prefix="font"
                cssProp="font-weight"
                onPreview={(v) => onPreviewInlineStyle("font-weight", v)}
                onCommitClass={onCommitClass}
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
                value={lineHeight.tailwindValue || lineHeight.computedValue}
                computedValue={lineHeight.computedValue}
                currentClass={lineHeight.fullClass}
                scale={LINE_HEIGHT_SCALE as string[]}
                prefix="leading"
                cssProp="line-height"
                onPreview={(v) => onPreviewInlineStyle("line-height", v)}
                onCommitClass={onCommitClass}
              />
            </div>
          )}
          {letterSpacing && (
            <div>
              <PropLabel label="Tracking" inherited={letterSpacing.inherited} />
              <ScaleInput
                icon={LetterSpacingIcon}
                value={letterSpacing.tailwindValue || letterSpacing.computedValue}
                computedValue={letterSpacing.computedValue}
                currentClass={letterSpacing.fullClass}
                scale={LETTER_SPACING_SCALE as string[]}
                prefix="tracking"
                cssProp="letter-spacing"
                onPreview={(v) => onPreviewInlineStyle("letter-spacing", v)}
                onCommitClass={onCommitClass}
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
        />
      ))}

      {addableProps.length > 0 && (
        <AddableRows
          properties={addableProps}
          tokenGroups={tokenGroups}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onRevertInlineStyles={onRevertInlineStyles}
          onCommitClass={onCommitClass}
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
}: {
  properties: UnifiedProperty[];
  computedStyles: Record<string, string>;
  tokenGroups: Record<string, any[]>;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (c: string, oldClass?: string) => void;
}) {
  const active = properties.filter((p) => p.hasValue);
  const allRadiusProps = properties.filter((p) => p.cssProperty.includes("radius"));
  const radiusProps = active.filter((p) => p.cssProperty.includes("radius"));
  const widthProps = active.filter((p) => p.cssProperty.includes("width"));
  const otherProps = active.filter(
    (p) => !p.cssProperty.includes("radius") && !p.cssProperty.includes("width")
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
        />
      )}

      <div>
        <PropLabel label="Width" />
        {uniformBorderWidth || widthProps.length === 0 ? (
          <ScaleInput
            icon={BorderWidthIcon}
            value={
              widthProps[0]?.tailwindValue ||
              (!uniformBorderWidth ||
              uniformBorderWidth === "0px" ||
              uniformBorderWidth === "0"
                ? "—"
                : uniformBorderWidth)
            }
            computedValue={uniformBorderWidth || "0px"}
            currentClass={widthProps[0]?.fullClass || null}
            scale={BORDER_WIDTH_SCALE as string[]}
            prefix="border"
            cssProp="border-width"
            onPreview={(v) => onPreviewInlineStyle("border-width", v)}
            onCommitClass={(cls, oldClass) => {
              // "border-1" is not a valid Tailwind class — "border" (no suffix) = 1px
              const fixedClass = cls === "border-1" ? "border" : cls;
              onCommitClass(fixedClass, oldClass);
            }}
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
            />
          ))
        )}
      </div>

      {otherProps.map((prop) => (
        <UnifiedControl
          key={prop.cssProperty}
          prop={prop}
          tokenGroups={tokenGroups}
          onPreviewInlineStyle={onPreviewInlineStyle}
          onRevertInlineStyles={onRevertInlineStyles}
          onCommitClass={onCommitClass}
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
}: {
  properties: UnifiedProperty[];
  tokenGroups: Record<string, any[]>;
  shadows?: ShadowItem[];
  gradients?: GradientItem[];
  elementClassName: string;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (c: string, oldClass?: string) => void;
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
            onPreview={(v) => onPreviewInlineStyle("opacity", v)}
            onCommitClass={onCommitClass}
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
            elementClassName={elementClassName}
            onPreviewInlineStyle={onPreviewInlineStyle}
            onCommitClass={onCommitClass}
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
}: {
  properties: UnifiedProperty[];
  tokenGroups: Record<string, any[]>;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (c: string, oldClass?: string) => void;
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
// Unified control — handles tiered rendering
// Priority: color → design token → tailwind scale → keyword → scrub input
// ---------------------------------------------------------------------------

function UnifiedControl({
  prop,
  tokenGroups,
  onPreviewInlineStyle,
  onRevertInlineStyles: _revert,
  onCommitClass,
}: {
  prop: UnifiedProperty;
  tokenGroups: Record<string, any[]>;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (c: string, oldClass?: string) => void;
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
    const displayLabel = hasToken ? prop.tokenMatch!.tokenName : (prop.tailwindValue || prop.computedValue);

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
            onCommitClass(`${twPrefix}-${token}`);
          }}
          onChange={(c) => onPreviewInlineStyle(prop.cssProperty, c)}
          onCommit={(c) => {
            const oldClass = prop.fullClass || undefined;
            onCommitClass(`${twPrefix}-[${c.replace(/\s+/g, "_")}]`, oldClass);
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

  // 3. Design token match → use ScaleInput with token group as scale
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
          onPreview={(v) => onPreviewInlineStyle("opacity", v)}
          onCommitClass={onCommitClass}
        />
      </div>
    );
  }

  // 4. Tailwind scale → ScaleInput
  const twScale = CSS_PROP_TO_TW_SCALE[prop.cssProperty];
  if (twScale) {
    // Show "—" for zero/default computed values when no explicit class exists
    const isZeroDefault = !prop.tailwindValue && (prop.computedValue === "0px" || prop.computedValue === "0");
    const displayValue = isZeroDefault ? "—" : (prop.tailwindValue || prop.computedValue);
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
          const match = computedToTailwindClass(prop.cssProperty, v);
          if (match) onCommitClass(match.tailwindClass);
        }}
      />
    </div>
  );
}

