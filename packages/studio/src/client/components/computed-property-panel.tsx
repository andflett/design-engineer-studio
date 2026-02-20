/**
 * Unified property panel driven by classes (precedence) + computed styles (fallback).
 * Shows categorized CSS properties with Figma-style controls:
 *   - ScaleInput: composite icon + scale dropdown OR arbitrary text input + toggle
 *   - ScrubInput: icon-inside-input with drag-to-scrub for numeric values
 *   - SegmentedIcons: icon toggle groups for text-align, decoration, transform
 *   - Always-visible sections with "add" affordance for unset properties
 *   - Descriptive tooltips on layout/alignment controls
 */
import { useState, useRef, useEffect, type PointerEvent as ReactPointerEvent } from "react";
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
  WidthIcon,
  HeightIcon,
  PaddingIcon,
  MarginIcon,
  FontSizeIcon,
  FontBoldIcon,
  LineHeightIcon,
  LetterSpacingIcon,
  CornersIcon,
  CornerTopLeftIcon,
  CornerTopRightIcon,
  CornerBottomLeftIcon,
  CornerBottomRightIcon,
  OpacityIcon,
  LayersIcon,
  MoveIcon,
  EyeNoneIcon,
  FontFamilyIcon,
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
  ShadowIcon,
  ColumnSpacingIcon,
  RowSpacingIcon,
  BorderWidthIcon,
  TextNoneIcon,
  BoxModelIcon,
} from "@radix-ui/react-icons";
import {
  buildUnifiedProperties,
  getUniformBoxValue,
  getAxisBoxValues,
  type UnifiedProperty,
  type ComputedCategory,
} from "@designtools/core/client/lib/computed-styles";
import {
  computedToTailwindClass,
  uniformBoxToTailwind,
  axisBoxToTailwind,
  uniformRadiusToTailwind,
} from "@designtools/core/client/lib/computed-to-tailwind";
import {
  FONT_SIZE_SCALE,
  FONT_WEIGHT_SCALE,
  LINE_HEIGHT_SCALE,
  LETTER_SPACING_SCALE,
  SPACING_SCALE,
  RADIUS_SCALE,
  OPACITY_SCALE,
} from "@designtools/core/client/lib/tailwind-parser";
import { ColorPopover } from "./color-popover.js";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ComputedPropertyPanelProps {
  tag: string;
  className: string;
  computedStyles: Record<string, string>;
  parentComputedStyles: Record<string, string>;
  tokenGroups: Record<string, any[]>;
  onPreviewInlineStyle: (property: string, value: string) => void;
  onRevertInlineStyles: () => void;
  onCommitClass: (tailwindClass: string, oldClass?: string) => void;
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function ComputedPropertyPanel({
  tag,
  className,
  computedStyles,
  parentComputedStyles,
  tokenGroups,
  onPreviewInlineStyle,
  onRevertInlineStyles,
  onCommitClass,
}: ComputedPropertyPanelProps) {
  const categorized = buildUnifiedProperties(
    tag, className, computedStyles, parentComputedStyles, tokenGroups,
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
          displayValue={displayValue}
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
  displayValue,
  onPreviewInlineStyle,
  onRevertInlineStyles,
  onCommitClass,
}: {
  category: ComputedCategory;
  label: string;
  properties: UnifiedProperty[];
  computedStyles: Record<string, string>;
  tokenGroups: Record<string, any[]>;
  displayValue: string;
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
        <div className="flex flex-col gap-1.5 pb-2 px-4">
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

          {/* Addable rows — layout/spacing/border/size/typography handle their own */}
          {!["layout", "spacing", "border", "size", "typography"].includes(category) && addableProps.length > 0 && (
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
  { value: "flex", icon: RowsIcon, label: "Flex", tooltip: "Flex — arrange children in a row or column" },
  { value: "grid", icon: GridIcon, label: "Grid", tooltip: "Grid — arrange children in a 2D grid" },
  { value: "block", icon: ColumnsIcon, label: "Block", tooltip: "Block — stack vertically, full width" },
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
  const alignProp = properties.find((p) => p.cssProperty === "align-items");
  const justifyProp = properties.find((p) => p.cssProperty === "justify-content");
  const otherProps = properties.filter(
    (p) => !["display", "align-items", "justify-content"].includes(p.cssProperty) && p.hasValue && !p.flexGridOnly
  );
  const flexGridActiveProps = properties.filter(
    (p) => !["display", "align-items", "justify-content"].includes(p.cssProperty) && p.hasValue && p.flexGridOnly
  );
  const flexGridAddableProps = properties.filter(
    (p) => !["display", "align-items", "justify-content"].includes(p.cssProperty) && !p.hasValue && p.flexGridOnly
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
  const [paddingExpanded, setPaddingExpanded] = useState(false);
  const [marginExpanded, setMarginExpanded] = useState(false);

  const activeProps = properties.filter((p) => p.hasValue);
  const paddingProps = activeProps.filter((p) => p.cssProperty.startsWith("padding-"));
  const marginProps = activeProps.filter((p) => p.cssProperty.startsWith("margin-"));
  const addableProps = properties.filter((p) => !p.hasValue);

  const uniformPadding = getUniformBoxValue(computedStyles, "padding");
  const uniformMargin = getUniformBoxValue(computedStyles, "margin");
  const axisPadding = !uniformPadding ? getAxisBoxValues(computedStyles, "padding") : null;
  const axisMargin = !uniformMargin ? getAxisBoxValues(computedStyles, "margin") : null;

  // Compute summary for collapsed view — show computed values, "—" for zero defaults
  const formatSpacingValue = (p: UnifiedProperty) => {
    const v = p.computedValue;
    if (!p.tailwindValue && (v === "0px" || v === "0")) return "—";
    return v;
  };

  const paddingSummary = uniformPadding
    ? null  // will use ScaleInput with the uniform value
    : axisPadding
    ? `${axisPadding.y} ${axisPadding.x}`
    : paddingProps.length > 0
    ? paddingProps.map(formatSpacingValue).join(" ")
    : null;

  const marginSummary = uniformMargin
    ? null
    : axisMargin
    ? `${axisMargin.y} ${axisMargin.x}`
    : marginProps.length > 0
    ? marginProps.map(formatSpacingValue).join(" ")
    : null;

  // Find individual side props from all properties (including addable ones)
  const findProp = (cssProp: string) => properties.find((p) => p.cssProperty === cssProp);

  return (
    <>
      {/* Padding */}
      {paddingProps.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <SubSectionLabel label="Padding" />
            <button
              onClick={() => setPaddingExpanded(!paddingExpanded)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--studio-text-dimmed)",
                padding: "2px",
                display: "flex",
                alignItems: "center",
              }}
              title={paddingExpanded ? "Collapse to shorthand" : "Expand individual sides"}
            >
              <BoxModelIcon style={{ width: 12, height: 12, opacity: paddingExpanded ? 1 : 0.5 }} />
            </button>
          </div>
          {!paddingExpanded ? (
            /* Collapsed: single shorthand input */
            uniformPadding ? (
              <ScaleInput
                icon={PaddingIcon}
                value={paddingProps[0]?.tailwindValue || (uniformPadding === "0px" || uniformPadding === "0" ? "—" : uniformPadding)}
                computedValue={uniformPadding || "0"}
                currentClass={paddingProps[0]?.fullClass || null}
                scale={SPACING_SCALE as string[]}
                prefix="p"
                cssProp="padding"
                onPreview={(v) => onPreviewInlineStyle("padding", v)}
                onCommitClass={onCommitClass}
                onCommitValue={(v) => {
                  const match = uniformBoxToTailwind("padding", v);
                  if (match) onCommitClass(match.tailwindClass);
                }}
              />
            ) : axisPadding ? (
              <div className="grid grid-cols-2 gap-1.5">
                <ScaleInput
                  icon={PaddingIcon}
                  label="X"
                  value={axisPadding.x}
                  computedValue={axisPadding.x}
                  currentClass={null}
                  scale={SPACING_SCALE as string[]}
                  prefix="px"
                  cssProp="padding-left"
                  onPreview={(v) => {
                    onPreviewInlineStyle("padding-left", v);
                    onPreviewInlineStyle("padding-right", v);
                  }}
                  onCommitClass={onCommitClass}
                  onCommitValue={(v) => {
                    const { xClass } = axisBoxToTailwind("padding", v, axisPadding.y);
                    if (xClass) onCommitClass(xClass.tailwindClass);
                  }}
                />
                <ScaleInput
                  icon={PaddingIcon}
                  label="Y"
                  value={axisPadding.y}
                  computedValue={axisPadding.y}
                  currentClass={null}
                  scale={SPACING_SCALE as string[]}
                  prefix="py"
                  cssProp="padding-top"
                  onPreview={(v) => {
                    onPreviewInlineStyle("padding-top", v);
                    onPreviewInlineStyle("padding-bottom", v);
                  }}
                  onCommitClass={onCommitClass}
                  onCommitValue={(v) => {
                    const { yClass } = axisBoxToTailwind("padding", axisPadding.x, v);
                    if (yClass) onCommitClass(yClass.tailwindClass);
                  }}
                />
              </div>
            ) : (
              <ScrubInput
                icon={PaddingIcon}
                value={paddingSummary || "mixed"}
                cssProp="padding"
                onPreview={(v) => onPreviewInlineStyle("padding", v)}
                onCommit={(v) => {
                  const match = uniformBoxToTailwind("padding", v);
                  if (match) onCommitClass(match.tailwindClass);
                }}
              />
            )
          ) : (
            /* Expanded: 4 individual side inputs in 2x2 grid */
            <div className="grid grid-cols-2 gap-1.5">
              {(["padding-top", "padding-right", "padding-bottom", "padding-left"] as const).map((side) => {
                const prop = findProp(side);
                const sideLabel = side.replace("padding-", "")[0].toUpperCase();
                const sidePrefix = `p${side.replace("padding-", "")[0]}`;
                return (
                  <ScaleInput
                    key={side}
                    label={sideLabel}
                    value={prop?.tailwindValue || prop?.computedValue || "0"}
                    computedValue={prop?.computedValue || "0"}
                    currentClass={prop?.fullClass || null}
                    scale={SPACING_SCALE as string[]}
                    prefix={sidePrefix}
                    cssProp={side}
                    onPreview={(v) => onPreviewInlineStyle(side, v)}
                    onCommitClass={onCommitClass}
                    onCommitValue={(v) => {
                      const match = computedToTailwindClass(side, v);
                      if (match) onCommitClass(match.tailwindClass);
                    }}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Margin */}
      {marginProps.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <SubSectionLabel label="Margin" />
            <button
              onClick={() => setMarginExpanded(!marginExpanded)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--studio-text-dimmed)",
                padding: "2px",
                display: "flex",
                alignItems: "center",
              }}
              title={marginExpanded ? "Collapse to shorthand" : "Expand individual sides"}
            >
              <BoxModelIcon style={{ width: 12, height: 12, opacity: marginExpanded ? 1 : 0.5 }} />
            </button>
          </div>
          {!marginExpanded ? (
            uniformMargin ? (
              <ScaleInput
                icon={MarginIcon}
                value={marginProps[0]?.tailwindValue || (uniformMargin === "0px" || uniformMargin === "0" ? "—" : uniformMargin)}
                computedValue={uniformMargin || "0"}
                currentClass={marginProps[0]?.fullClass || null}
                scale={SPACING_SCALE as string[]}
                prefix="m"
                cssProp="margin"
                onPreview={(v) => onPreviewInlineStyle("margin", v)}
                onCommitClass={onCommitClass}
                onCommitValue={(v) => {
                  const match = uniformBoxToTailwind("margin", v);
                  if (match) onCommitClass(match.tailwindClass);
                }}
              />
            ) : axisMargin ? (
              <div className="grid grid-cols-2 gap-1.5">
                <ScaleInput
                  icon={MarginIcon}
                  label="X"
                  value={axisMargin.x}
                  computedValue={axisMargin.x}
                  currentClass={null}
                  scale={SPACING_SCALE as string[]}
                  prefix="mx"
                  cssProp="margin-left"
                  onPreview={(v) => {
                    onPreviewInlineStyle("margin-left", v);
                    onPreviewInlineStyle("margin-right", v);
                  }}
                  onCommitClass={onCommitClass}
                  onCommitValue={(v) => {
                    const { xClass } = axisBoxToTailwind("margin", v, axisMargin.y);
                    if (xClass) onCommitClass(xClass.tailwindClass);
                  }}
                />
                <ScaleInput
                  icon={MarginIcon}
                  label="Y"
                  value={axisMargin.y}
                  computedValue={axisMargin.y}
                  currentClass={null}
                  scale={SPACING_SCALE as string[]}
                  prefix="my"
                  cssProp="margin-top"
                  onPreview={(v) => {
                    onPreviewInlineStyle("margin-top", v);
                    onPreviewInlineStyle("margin-bottom", v);
                  }}
                  onCommitClass={onCommitClass}
                  onCommitValue={(v) => {
                    const { yClass } = axisBoxToTailwind("margin", axisMargin.x, v);
                    if (yClass) onCommitClass(yClass.tailwindClass);
                  }}
                />
              </div>
            ) : (
              <ScrubInput
                icon={MarginIcon}
                value={marginSummary || "mixed"}
                cssProp="margin"
                onPreview={(v) => onPreviewInlineStyle("margin", v)}
                onCommit={(v) => {
                  const match = uniformBoxToTailwind("margin", v);
                  if (match) onCommitClass(match.tailwindClass);
                }}
              />
            )
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {(["margin-top", "margin-right", "margin-bottom", "margin-left"] as const).map((side) => {
                const prop = findProp(side);
                const sideLabel = side.replace("margin-", "")[0].toUpperCase();
                const sidePrefix = `m${side.replace("margin-", "")[0]}`;
                return (
                  <ScaleInput
                    key={side}
                    label={sideLabel}
                    value={prop?.tailwindValue || prop?.computedValue || "0"}
                    computedValue={prop?.computedValue || "0"}
                    currentClass={prop?.fullClass || null}
                    scale={SPACING_SCALE as string[]}
                    prefix={sidePrefix}
                    cssProp={side}
                    onPreview={(v) => onPreviewInlineStyle(side, v)}
                    onCommitClass={onCommitClass}
                    onCommitValue={(v) => {
                      const match = computedToTailwindClass(side, v);
                      if (match) onCommitClass(match.tailwindClass);
                    }}
                  />
                );
              })}
            </div>
          )}
        </>
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
            onCommitValue={(v) => {
              const match = computedToTailwindClass("font-family", v);
              if (match) onCommitClass(match.tailwindClass);
            }}
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
                onCommitValue={(v) => {
                  const match = computedToTailwindClass("font-size", v);
                  if (match) onCommitClass(match.tailwindClass);
                }}
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
                onCommitValue={(v) => {
                  const match = computedToTailwindClass("font-weight", v);
                  if (match) onCommitClass(match.tailwindClass);
                }}
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
                onCommitValue={(v) => {
                  const match = computedToTailwindClass("line-height", v);
                  if (match) onCommitClass(match.tailwindClass);
                }}
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
                onCommitValue={(v) => {
                  const match = computedToTailwindClass("letter-spacing", v);
                  if (match) onCommitClass(match.tailwindClass);
                }}
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
  const radiusProps = active.filter((p) => p.cssProperty.includes("radius"));
  const widthProps = active.filter((p) => p.cssProperty.includes("width"));
  const otherProps = active.filter(
    (p) => !p.cssProperty.includes("radius") && !p.cssProperty.includes("width")
  );

  const uniformRadius = getUniformBoxValue(computedStyles, "border-radius");
  const uniformBorderWidth = getUniformBoxValue(computedStyles, "border-width");

  return (
    <>
      {radiusProps.length > 0 && (
        <>
          <SubSectionLabel label="Radius" />
          {uniformRadius ? (
            <ScaleInput
              icon={CornersIcon}
              value={radiusProps[0]?.tailwindValue || uniformRadius}
              computedValue={uniformRadius || "0"}
              currentClass={radiusProps[0]?.fullClass || null}
              scale={RADIUS_SCALE as string[]}
              prefix="rounded"
              cssProp="border-radius"
              onPreview={(v) => onPreviewInlineStyle("border-radius", v)}
              onCommitClass={onCommitClass}
              onCommitValue={(v) => {
                const match = uniformRadiusToTailwind(v);
                if (match) onCommitClass(match.tailwindClass);
              }}
            />
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {radiusProps.map((prop) => (
                <UnifiedControl
                  key={prop.cssProperty}
                  prop={prop}
                  tokenGroups={tokenGroups}
                  onPreviewInlineStyle={onPreviewInlineStyle}
                  onRevertInlineStyles={onRevertInlineStyles}
                  onCommitClass={onCommitClass}
                />
              ))}
            </div>
          )}
        </>
      )}

      {widthProps.length > 0 && (
        <>
          <SubSectionLabel label="Width" />
          {uniformBorderWidth ? (
            <ScrubInput
              icon={BorderWidthIcon}
              value={uniformBorderWidth}
              cssProp="border-width"
              onPreview={(v) => onPreviewInlineStyle("border-width", v)}
              onCommit={(v) => {
                const match = computedToTailwindClass("border-width", v);
                if (match) onCommitClass(match.tailwindClass);
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
        </>
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
            title={`Add ${prop.label}`}
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
// Tailwind scale mapping — maps CSS properties to their Tailwind scale values
// ---------------------------------------------------------------------------

const CSS_PROP_TO_TW_SCALE: Record<string, { scale: readonly string[]; prefix: string }> = {
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
    return (
      <ColorControl
        prop={prop}
        tokenGroups={tokenGroups}
        onPreviewInlineStyle={onPreviewInlineStyle}
        onCommitClass={onCommitClass}
      />
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
            <div className="studio-scrub-icon" title={prop.cssProperty}>
              <Icon style={{ width: 12, height: 12 }} />
            </div>
          )}
          <div
            className="studio-scrub-value"
            style={{ color: "var(--studio-text)", cursor: "default" }}
            title={prop.computedValue}
          >
            {prop.computedValue}
          </div>
        </div>
      </div>
    );
  }

  // 3. Design token match
  if (prop.tokenMatch) {
    return (
      <div>
        <PropLabel label={prop.label} inherited={prop.inherited} />
        <TokenPickerControl
          prop={prop}
          onPreviewInlineStyle={onPreviewInlineStyle}
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
        <SliderInput
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
          onCommitValue={(v) => {
            const match = computedToTailwindClass(prop.cssProperty, v);
            if (match) onCommitClass(match.tailwindClass);
          }}
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
        cssProp={prop.cssProperty}
        onPreview={(v) => onPreviewInlineStyle(prop.cssProperty, v)}
        onCommit={(v) => {
          const match = computedToTailwindClass(prop.cssProperty, v);
          if (match) onCommitClass(match.tailwindClass);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScaleInput — composite icon + scale dropdown OR arbitrary text + toggle
// ┌──────┬──────────────────────┬────┐
// │ icon │ text-base         ▾  │ <> │  ← scale mode
// ├──────┼──────────────────────┼────┤
// │ icon │ 16px                 │ <> │  ← arbitrary mode
// └──────┴──────────────────────┴────┘
// ---------------------------------------------------------------------------

function ScaleInput({
  icon: Icon,
  label,
  value,
  computedValue,
  currentClass,
  scale,
  prefix,
  cssProp,
  onPreview,
  onCommitClass,
  onCommitValue,
}: {
  icon?: React.ComponentType<{ style?: React.CSSProperties }>;
  label?: string;
  /** Display value — the scale suffix (e.g. "2xl") or "—" for zero defaults */
  value: string;
  /** Raw CSS computed value (e.g. "30px", "700") — shown in arbitrary/CSS mode */
  computedValue: string;
  /** The actual Tailwind class on this element (e.g. "text-2xl"), if any */
  currentClass: string | null;
  scale: string[];
  prefix: string;
  cssProp: string;
  onPreview?: (v: string) => void;
  onCommitClass: (c: string, oldClass?: string) => void;
  onCommitValue?: (v: string) => void;
}) {
  // Strip prefix from value if present (e.g. "text-base" → "base", "font-bold" → "bold")
  const normalizedValue = value.startsWith(prefix + "-")
    ? value.slice(prefix.length + 1)
    : value;
  const isInScale = scale.includes(normalizedValue);
  const isDash = normalizedValue === "—" || normalizedValue === "";
  const [arbitraryMode, setArbitraryMode] = useState(!isInScale && !isDash && normalizedValue !== "0" && normalizedValue !== "0px");
  const [draft, setDraft] = useState(arbitraryMode ? computedValue : normalizedValue);
  const [focused, setFocused] = useState(false);
  // Track what class we last wrote so subsequent changes replace the correct one
  const lastWrittenClassRef = useRef<string | null>(currentClass);

  // Keep ref in sync with prop when element re-selects
  useEffect(() => {
    lastWrittenClassRef.current = currentClass;
  }, [currentClass]);

  // Sync draft when the external value changes (e.g. element re-selected)
  const prevNormalizedRef = useRef(normalizedValue);
  useEffect(() => {
    if (!focused) {
      setDraft(arbitraryMode ? computedValue : normalizedValue);
    }
    // Only auto-switch back to scale mode when the value ACTUALLY changes externally
    if (prevNormalizedRef.current !== normalizedValue) {
      prevNormalizedRef.current = normalizedValue;
      if (scale.includes(normalizedValue)) {
        setArbitraryMode(false);
      }
    }
  }, [normalizedValue, computedValue, focused, scale, arbitraryMode]);

  // Get the old class to replace — use our tracked ref, fall back to currentClass prop
  const getOldClass = (): string | undefined => {
    return lastWrittenClassRef.current || currentClass || undefined;
  };

  const handleScaleChange = (selected: string) => {
    if (selected === "__custom__") {
      setArbitraryMode(true);
      setDraft(computedValue);
      return;
    }
    const newClass = `${prefix}-${selected}`;
    const oldClass = getOldClass();
    onCommitClass(newClass, oldClass);
    lastWrittenClassRef.current = newClass;
  };

  const handleArbitraryCommit = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed) return;
    const oldClass = getOldClass();
    // Check if the entered value matches a scale value
    if (scale.includes(trimmed)) {
      const newClass = `${prefix}-${trimmed}`;
      onCommitClass(newClass, oldClass);
      lastWrittenClassRef.current = newClass;
      setArbitraryMode(false);
      return;
    }
    // Try as arbitrary value: prefix-[value]
    const newClass = `${prefix}-[${trimmed}]`;
    onCommitClass(newClass, oldClass);
    lastWrittenClassRef.current = newClass;
  };

  return (
    <div
      className="studio-scale-input"
      style={arbitraryMode ? { borderLeft: "2px solid var(--studio-accent)" } : undefined}
    >
      {Icon && (
        <div className="studio-scrub-icon" title={label || cssProp}>
          <Icon style={{ width: 12, height: 12 }} />
        </div>
      )}
      {!Icon && label && (
        <div className="studio-scrub-label" title={cssProp}>
          {label}
        </div>
      )}

      {!arbitraryMode ? (
        <select
          value={isInScale ? normalizedValue : "__custom__"}
          onChange={(e) => handleScaleChange(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            color: "var(--studio-text)",
            fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
            fontSize: "11px",
            padding: "6px 8px",
            outline: "none",
            cursor: "pointer",
            WebkitAppearance: "none" as any,
          }}
        >
          {!isInScale && (
            <option value="__custom__">
              {normalizedValue || "—"}
            </option>
          )}
          {scale.map((val) => (
            <option key={val} value={val}>
              {val}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={focused ? draft : computedValue}
          placeholder="e.g. 16px"
          onChange={(e) => {
            setDraft(e.target.value);
            if (onPreview) onPreview(e.target.value);
          }}
          onFocus={() => {
            setDraft(computedValue);
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
            const trimmed = draft.trim();
            if (trimmed && trimmed !== computedValue) {
              if (onCommitValue) onCommitValue(trimmed);
              else handleArbitraryCommit(trimmed);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setDraft(computedValue);
              setFocused(false);
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            color: "var(--studio-text)",
            fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
            fontSize: "11px",
            padding: "6px 8px",
            outline: "none",
          }}
        />
      )}

      <button
        onClick={() => {
          setArbitraryMode(!arbitraryMode);
          if (!arbitraryMode) setDraft(computedValue);
        }}
        className="studio-scale-toggle"
        title={arbitraryMode ? "Custom CSS value — click for token scale" : "Token scale — click for custom CSS"}
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.02em",
          fontFamily: '"SF Mono", "Fira Code", monospace',
        }}
      >
        {arbitraryMode ? "CSS" : "Token"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScrubInput — Figma-style input with icon and drag-to-scrub
// ---------------------------------------------------------------------------

function ScrubInput({
  icon: Icon,
  label,
  value,
  cssProp,
  onPreview,
  onCommit,
}: {
  icon?: React.ComponentType<{ style?: React.CSSProperties }>;
  label?: string;
  value: string;
  cssProp: string;
  onPreview: (v: string) => void;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const scrubRef = useRef<{ startX: number; startVal: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  const displayValue = focused ? draft : value;

  const parseNumeric = (v: string): { num: number; unit: string } | null => {
    const match = v.match(/^(-?[\d.]+)\s*(px|rem|em|%|vh|vw|pt)?$/);
    if (match) return { num: parseFloat(match[1]), unit: match[2] || "px" };
    const num = parseFloat(v);
    if (!isNaN(num)) return { num, unit: "" };
    return null;
  };

  const getStep = (unit: string): number => {
    if (unit === "rem" || unit === "em") return 0.0625;
    if (unit === "%") return 1;
    return 1;
  };

  const handlePointerDown = (e: ReactPointerEvent) => {
    const parsed = parseNumeric(displayValue);
    if (!parsed) return;

    e.preventDefault();
    scrubRef.current = { startX: e.clientX, startVal: parsed.num };

    const handleMove = (me: globalThis.PointerEvent) => {
      if (!scrubRef.current) return;
      const parsed = parseNumeric(displayValue);
      if (!parsed) return;

      const step = getStep(parsed.unit);
      const multiplier = me.shiftKey ? 10 : 1;
      const delta = Math.round((me.clientX - scrubRef.current.startX) / 2);
      const newVal = scrubRef.current.startVal + delta * step * multiplier;
      const formatted = parsed.unit
        ? `${parseFloat(newVal.toFixed(4))}${parsed.unit}`
        : `${Math.round(newVal)}`;
      setDraft(formatted);
      onPreview(formatted);
    };

    const handleUp = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      if (scrubRef.current) {
        onCommit(draft);
        scrubRef.current = null;
      }
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  };

  return (
    <div className="studio-scrub-input">
      {Icon && (
        <div
          className="studio-scrub-icon"
          onPointerDown={handlePointerDown}
          title={label || cssProp}
        >
          <Icon style={{ width: 12, height: 12 }} />
        </div>
      )}
      {!Icon && label && (
        <div
          className="studio-scrub-label"
          onPointerDown={handlePointerDown}
          title={cssProp}
        >
          {label}
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        placeholder={cssProp}
        onChange={(e) => {
          setDraft(e.target.value);
          onPreview(e.target.value);
        }}
        onFocus={() => {
          setDraft(value);
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
          const trimmed = draft.trim();
          if (trimmed && trimmed !== value) {
            onCommit(trimmed);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value);
            setFocused(false);
          }
        }}
        className="studio-scrub-value"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SliderInput — range slider for opacity (0–100)
// ---------------------------------------------------------------------------

function SliderInput({
  value,
  onPreview,
  onCommitClass,
}: {
  value: string;
  onPreview: (v: string) => void;
  onCommitClass: (c: string, oldClass?: string) => void;
}) {
  // Parse current opacity: could be "1", "0.5", "50%", etc.
  const parseOpacity = (v: string): number => {
    const n = parseFloat(v);
    if (isNaN(n)) return 100;
    // If value looks like 0-1 range (e.g. "0.5"), convert to percentage
    return n <= 1 && v !== "100" ? Math.round(n * 100) : Math.round(n);
  };

  const [sliderValue, setSliderValue] = useState(() => parseOpacity(value));

  useEffect(() => {
    setSliderValue(parseOpacity(value));
  }, [value]);

  const commitValue = (pct: number) => {
    // Find closest value in OPACITY_SCALE
    const closest = OPACITY_SCALE.reduce((prev, curr) =>
      Math.abs(parseInt(curr) - pct) < Math.abs(parseInt(prev) - pct) ? curr : prev
    );
    onCommitClass(`opacity-${closest}`);
  };

  return (
    <div className="studio-scrub-input" style={{ gap: 6 }}>
      <div className="studio-scrub-icon" title="Opacity">
        <OpacityIcon style={{ width: 12, height: 12 }} />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={sliderValue}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          setSliderValue(v);
          onPreview(`${v / 100}`);
        }}
        onMouseUp={() => commitValue(sliderValue)}
        onKeyUp={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") commitValue(sliderValue);
        }}
        style={{
          flex: 1,
          accentColor: "var(--studio-accent)",
          cursor: "pointer",
          height: 14,
        }}
      />
      <span
        className="studio-scrub-value"
        style={{
          width: 32,
          textAlign: "right",
          fontSize: 11,
          fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
          color: "var(--studio-text)",
          flexShrink: 0,
        }}
      >
        {sliderValue}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Property icon mapping — complete for all properties
// ---------------------------------------------------------------------------

function getPropertyIcon(cssProp: string): React.ComponentType<{ style?: React.CSSProperties }> | undefined {
  const map: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
    "width": WidthIcon,
    "height": HeightIcon,
    "min-width": WidthIcon,
    "min-height": HeightIcon,
    "max-width": WidthIcon,
    "max-height": HeightIcon,
    "padding-top": PaddingIcon,
    "padding-right": PaddingIcon,
    "padding-bottom": PaddingIcon,
    "padding-left": PaddingIcon,
    "margin-top": MarginIcon,
    "margin-right": MarginIcon,
    "margin-bottom": MarginIcon,
    "margin-left": MarginIcon,
    "gap": ColumnSpacingIcon,
    "row-gap": RowSpacingIcon,
    "column-gap": ColumnSpacingIcon,
    "font-family": FontFamilyIcon,
    "font-size": FontSizeIcon,
    "font-weight": FontBoldIcon,
    "line-height": LineHeightIcon,
    "letter-spacing": LetterSpacingIcon,
    "text-align": TextAlignLeftIcon,
    "text-decoration": UnderlineIcon,
    "text-transform": LetterCaseUppercaseIcon,
    "border-top-width": BorderWidthIcon,
    "border-right-width": BorderWidthIcon,
    "border-bottom-width": BorderWidthIcon,
    "border-left-width": BorderWidthIcon,
    "border-top-left-radius": CornerTopLeftIcon,
    "border-top-right-radius": CornerTopRightIcon,
    "border-bottom-left-radius": CornerBottomLeftIcon,
    "border-bottom-right-radius": CornerBottomRightIcon,
    "opacity": OpacityIcon,
    "box-shadow": ShadowIcon,
    "z-index": LayersIcon,
    "top": MoveIcon,
    "right": MoveIcon,
    "bottom": MoveIcon,
    "left": MoveIcon,
  };
  return map[cssProp];
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function PropLabel({ label, inherited }: { label: string; inherited?: boolean }) {
  return (
    <div
      className="text-[11px] font-medium mb-0.5"
      style={{
        color: "var(--studio-text-dimmed)",
        letterSpacing: "0.03em",
        opacity: inherited ? 0.6 : 1,
      }}
    >
      {label}
      {inherited && (
        <span className="ml-1 text-[10px] italic" style={{ color: "var(--studio-text-dimmed)" }}>
          inherited
        </span>
      )}
    </div>
  );
}

function SubSectionLabel({ label }: { label: string }) {
  return (
    <div
      className="text-[11px] font-medium uppercase tracking-wider mt-1 mb-0.5"
      style={{ color: "var(--studio-text-dimmed)" }}
    >
      {label}
    </div>
  );
}

function SegmentedIcons({
  options,
  value,
  onChange,
}: {
  options: { value: string; icon: any; label?: string; tooltip?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className="studio-segmented" style={{ width: "100%" }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => {
            setLocalValue(opt.value);
            onChange(opt.value);
          }}
          className={localValue === opt.value ? "active" : ""}
          title={opt.tooltip || opt.label || opt.value}
          style={{ flex: 1, cursor: "pointer" }}
        >
          {opt.icon ? (
            <opt.icon style={{ width: 14, height: 14 }} />
          ) : (
            <span style={{ fontSize: 10 }}>{opt.label || opt.value}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Token picker
// ---------------------------------------------------------------------------

function TokenPickerControl({
  prop,
  onPreviewInlineStyle,
  onCommitClass,
}: {
  prop: UnifiedProperty;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onCommitClass: (c: string, oldClass?: string) => void;
}) {
  const tokenMatch = prop.tokenMatch!;
  const twPrefix = CSS_PROP_TO_TW_PREFIX[prop.cssProperty] || "";

  return (
    <div className="flex items-center gap-1">
      <div
        className="shrink-0 w-1.5 h-4 rounded-sm"
        style={{ background: "var(--studio-accent)" }}
        title="Design token"
      />
      <select
        value={tokenMatch.tokenName}
        onChange={(e) => {
          const selected = e.target.value;
          const selectedToken = tokenMatch.groupTokens.find((t) => t.name === selected);
          if (selectedToken) {
            onPreviewInlineStyle(prop.cssProperty, selectedToken.value);
          }
          if (twPrefix) {
            onCommitClass(`${twPrefix}-${selected}`);
          }
        }}
        className="studio-select w-full"
        style={{ cursor: "pointer" }}
      >
        {tokenMatch.groupTokens.map((t) => (
          <option key={t.name} value={t.name}>
            {t.name} ({t.value})
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color controls
// ---------------------------------------------------------------------------

function ColorControl({
  prop,
  tokenGroups,
  onPreviewInlineStyle: _onPreview,
  onCommitClass,
}: {
  prop: UnifiedProperty;
  tokenGroups: Record<string, any[]>;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onCommitClass: (c: string, oldClass?: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const colorTokens: string[] = [];
  const tokenValues: Record<string, string> = {};
  for (const [, tokens] of Object.entries(tokenGroups)) {
    for (const t of tokens as any[]) {
      if (t.category === "color") {
        const name = t.name.replace(/^--/, "");
        if (!colorTokens.includes(name)) colorTokens.push(name);
        if (!tokenValues[name]) tokenValues[name] = t.lightValue || "";
      }
    }
  }

  const twPrefix = prop.cssProperty === "color" ? "text"
    : prop.cssProperty === "background-color" ? "bg"
    : "border";

  const hasToken = !!prop.tokenMatch;

  return (
    <div>
      <PropLabel label={prop.label} inherited={prop.inherited} />
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(true)}
        className="studio-color-trigger"
        style={{ cursor: "pointer" }}
      >
        <div
          className="studio-swatch"
          style={{
            "--swatch-color": prop.computedValue,
            ...(hasToken ? { boxShadow: "0 0 0 2px var(--studio-accent)" } : {}),
          } as React.CSSProperties}
          title={hasToken ? "Design token" : undefined}
        />
        <span className="flex-1 truncate text-left font-mono text-[11px]">
          {hasToken ? prop.tokenMatch!.tokenName : (prop.tailwindValue || prop.computedValue)}
        </span>
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <ColorPopover
          anchorRef={triggerRef}
          currentValue={hasToken ? prop.tokenMatch!.tokenName : ""}
          availableTokens={colorTokens}
          tokenValues={tokenValues}
          onSelect={(token) => {
            onCommitClass(`${twPrefix}-${token}`);
            setIsOpen(false);
          }}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Keyword control
// ---------------------------------------------------------------------------

function KeywordControl({
  prop,
  onPreviewInlineStyle,
  onCommitClass,
}: {
  prop: UnifiedProperty;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onCommitClass: (c: string, oldClass?: string) => void;
}) {
  const options = getKeywordOptions(prop.cssProperty);

  if (options.length === 0) {
    return (
      <div
        className="text-[11px] font-mono truncate"
        style={{ color: "var(--studio-text)" }}
      >
        {prop.computedValue}
      </div>
    );
  }

  return (
    <select
      value={prop.computedValue}
      onChange={(e) => {
        onPreviewInlineStyle(prop.cssProperty, e.target.value);
        const match = computedToTailwindClass(prop.cssProperty, e.target.value);
        if (match) onCommitClass(match.tailwindClass);
      }}
      className="studio-select w-full"
      style={{ cursor: "pointer" }}
    >
      {!options.includes(prop.computedValue) && (
        <option value={prop.computedValue}>{prop.computedValue}</option>
      )}
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// CSS prop → Tailwind prefix mapping
// ---------------------------------------------------------------------------

const CSS_PROP_TO_TW_PREFIX: Record<string, string> = {
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

// ---------------------------------------------------------------------------
// Keyword options per property
// ---------------------------------------------------------------------------

function getKeywordOptions(property: string): string[] {
  switch (property) {
    case "display":
      return ["block", "inline-block", "inline", "flex", "inline-flex", "grid", "inline-grid", "none"];
    case "position":
      return ["static", "relative", "absolute", "fixed", "sticky"];
    case "flex-direction":
      return ["row", "row-reverse", "column", "column-reverse"];
    case "flex-wrap":
      return ["nowrap", "wrap", "wrap-reverse"];
    case "justify-content":
      return ["flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly"];
    case "align-items":
      return ["flex-start", "flex-end", "center", "baseline", "stretch"];
    case "align-self":
      return ["auto", "flex-start", "flex-end", "center", "stretch"];
    case "overflow":
      return ["visible", "hidden", "scroll", "auto"];
    case "text-align":
      return ["left", "center", "right", "justify"];
    case "text-transform":
      return ["none", "uppercase", "lowercase", "capitalize"];
    case "text-decoration":
      return ["none", "underline", "overline", "line-through"];
    case "white-space":
      return ["normal", "nowrap", "pre", "pre-wrap", "pre-line"];
    default:
      return [];
  }
}
