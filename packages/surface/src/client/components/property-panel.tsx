import { useState } from "react";
import { SegmentedIcons, ScaleInput, BoxSpacingControl, BoxRadiusControl } from "./controls/index.js";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  RowsIcon,
  GridIcon,
  ColumnsIcon,
  AlignLeftIcon,
  AlignCenterHorizontallyIcon,
  AlignRightIcon,
  SpaceBetweenHorizontallyIcon,
  SpaceEvenlyHorizontallyIcon,
  AlignTopIcon,
  AlignCenterVerticallyIcon,
  AlignBottomIcon,
  PaddingIcon,
  MarginIcon,
  WidthIcon,
  HeightIcon,
  FontSizeIcon,
  FontBoldIcon,
  CornersIcon,
  ColumnSpacingIcon,
} from "@radix-ui/react-icons";
import {
  Maximize,
} from "lucide-react";
import { ColorInput } from "./controls/color-input.js";
import type { UnifiedProperty } from "../lib/computed-styles.js";
import {
  buildClass,
  parseClasses,
  isArbitraryValue,
  unwrapArbitrary,
  wrapArbitrary,
  SPACING_SCALE,
  RADIUS_SCALE,
  FONT_SIZE_SCALE,
  FONT_WEIGHT_SCALE,
  type ParsedProperty,
  type PropertyCategory,
} from "../../shared/tailwind-parser.js";
import type { ResolvedTailwindTheme } from "../../shared/tailwind-theme.js";
import { getTwScales } from "./controls/tailwind-maps.js";

// ---------------------------------------------------------------------------
// Tailwind property → CSS longhand expansion (mirrors TW_PROP_TO_CSS)
// ---------------------------------------------------------------------------

const TW_TO_CSS_LONGHANDS: Record<string, string[]> = {
  padding: ["padding-top", "padding-right", "padding-bottom", "padding-left"],
  paddingX: ["padding-left", "padding-right"],
  paddingY: ["padding-top", "padding-bottom"],
  paddingTop: ["padding-top"],
  paddingRight: ["padding-right"],
  paddingBottom: ["padding-bottom"],
  paddingLeft: ["padding-left"],
  margin: ["margin-top", "margin-right", "margin-bottom", "margin-left"],
  marginX: ["margin-left", "margin-right"],
  marginY: ["margin-top", "margin-bottom"],
  marginTop: ["margin-top"],
  marginRight: ["margin-right"],
  marginBottom: ["margin-bottom"],
  marginLeft: ["margin-left"],
  borderRadius: ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"],
};

/**
 * Build synthetic computedStyles + UnifiedProperty[] from parsed Tailwind classes,
 * so we can render BoxSpacingControl / BoxRadiusControl with their existing logic.
 *
 * The "computed values" are the Tailwind scale values (e.g. "4", "md") — not real
 * CSS values — but they work for equality checks (uniform/axis detection).
 */
function synthesizeBoxProps(
  properties: ParsedProperty[],
  box: "padding" | "margin" | "border-radius",
): {
  computedStyles: Record<string, string>;
  activeProps: UnifiedProperty[];
  allProperties: UnifiedProperty[];
  /** Map from CSS longhand → original ParsedProperty (for routing class changes) */
  classMap: Map<string, ParsedProperty>;
} {
  const computedStyles: Record<string, string> = {};
  const classMap = new Map<string, ParsedProperty>();
  const propMap = new Map<string, UnifiedProperty>();

  for (const pp of properties) {
    const longhands = TW_TO_CSS_LONGHANDS[pp.property];
    if (!longhands) continue;

    for (const cssProp of longhands) {
      // Use TW value as synthetic computed value (for uniform/axis equality checks)
      computedStyles[cssProp] = pp.value;
      classMap.set(cssProp, pp);
      if (!propMap.has(cssProp)) {
        propMap.set(cssProp, {
          cssProperty: cssProp,
          label: cssProp,
          category: box === "border-radius" ? "border" : "spacing",
          controlType: "length",
          source: "class",
          tailwindValue: pp.value,
          fullClass: pp.fullClass,
          computedValue: pp.value,
          inherited: false,
          tokenMatch: null,
          hasValue: true,
          flexGridOnly: false,
        });
      }
    }
  }

  const allCssProps = box === "padding"
    ? ["padding-top", "padding-right", "padding-bottom", "padding-left"]
    : box === "margin"
    ? ["margin-top", "margin-right", "margin-bottom", "margin-left"]
    : ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"];

  // Ensure all longhands exist (even if "0") so uniform/axis checks work
  for (const cssProp of allCssProps) {
    if (!computedStyles[cssProp]) computedStyles[cssProp] = "0";
  }

  const activeProps = allCssProps
    .map((cp) => propMap.get(cp))
    .filter((p): p is UnifiedProperty => !!p);

  const allProperties = allCssProps.map((cp) =>
    propMap.get(cp) || {
      cssProperty: cp,
      label: cp,
      category: (box === "border-radius" ? "border" : "spacing") as UnifiedProperty["category"],
      controlType: "length" as const,
      source: "none" as const,
      tailwindValue: null,
      fullClass: null,
      computedValue: "0",
      inherited: false,
      tokenMatch: null,
      hasValue: false,
      flexGridOnly: false,
    },
  );

  return { computedStyles, activeProps, allProperties, classMap };
}

/** Icon + scale config for single-row properties */
function getPropertyControl(prop: ParsedProperty, spacingScale: readonly string[] = SPACING_SCALE): {
  icon?: React.ComponentType<{ style?: React.CSSProperties }>;
  scale: readonly string[];
  label: string;
} {
  const SizeIcon = function SizeIcon({ style }: { style?: React.CSSProperties }) {
    return <Maximize style={style} strokeWidth={1} size={15} />;
  };
  switch (prop.property) {
    case "width": return { icon: WidthIcon, scale: spacingScale, label: "Width" };
    case "height": return { icon: HeightIcon, scale: spacingScale, label: "Height" };
    case "minWidth": return { icon: WidthIcon, scale: spacingScale, label: "Min W" };
    case "minHeight": return { icon: HeightIcon, scale: spacingScale, label: "Min H" };
    case "maxWidth": return { icon: WidthIcon, scale: spacingScale, label: "Max W" };
    case "maxHeight": return { icon: HeightIcon, scale: spacingScale, label: "Max H" };
    case "size": return { icon: SizeIcon, scale: spacingScale, label: "Size" };
    case "gap": return { icon: ColumnSpacingIcon, scale: spacingScale, label: "Gap" };
    case "gapX": return { icon: ColumnSpacingIcon, scale: spacingScale, label: "Col Gap" };
    case "gapY": return { icon: ColumnSpacingIcon, scale: spacingScale, label: "Row Gap" };
    case "fontSize": return { icon: FontSizeIcon, scale: FONT_SIZE_SCALE, label: "Size" };
    case "fontWeight": return { icon: FontBoldIcon, scale: FONT_WEIGHT_SCALE, label: "Weight" };
    case "borderWidth": return { icon: undefined, scale: ["0", "1", "2", "4", "8"], label: "Border" };
    default: return { icon: undefined, scale: [], label: prop.label };
  }
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

interface PropertyPanelProps {
  classes: string;
  onClassChange: (oldClass: string, newClass: string) => void;
  tokenGroups: Record<string, any[]>;
  tailwindTheme?: ResolvedTailwindTheme | null;
  flat?: boolean;
}

export function PropertyPanel({
  classes,
  onClassChange,
  tokenGroups,
  tailwindTheme,
  flat = false,
}: PropertyPanelProps) {
  const spacingScale = getTwScales(tailwindTheme).spacing;
  const parsed = parseClasses(classes);

  const categories: { key: PropertyCategory; label: string }[] = [
    { key: "layout", label: "Layout" },
    { key: "color", label: "Color" },
    { key: "spacing", label: "Spacing" },
    { key: "size", label: "Size" },
    { key: "typography", label: "Type" },
    { key: "shape", label: "Shape" },
  ];

  const nonEmptyCategories = categories.filter(
    (cat) => parsed[cat.key].length > 0
  );

  if (nonEmptyCategories.length === 0) {
    return (
      <div
        className="text-[11px] px-4 py-3"
        style={{ color: "var(--studio-text-dimmed)" }}
      >
        No editable properties
      </div>
    );
  }

  if (flat) {
    return (
      <div className="flex flex-col gap-2">
        {nonEmptyCategories.map((cat) => (
          <CategoryContent
            key={cat.key}
            category={cat.key}
            properties={parsed[cat.key]}
            onClassChange={onClassChange}
            tokenGroups={tokenGroups}
            spacingScale={spacingScale}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {nonEmptyCategories.map((cat) => (
        <CategorySection
          key={cat.key}
          category={cat.key}
          label={cat.label}
          properties={parsed[cat.key]}
          onClassChange={onClassChange}
          tokenGroups={tokenGroups}
          spacingScale={spacingScale}
        />
      ))}

      {parsed.other.length > 0 && (
        <div style={{ borderTop: "1px solid var(--studio-border-subtle)" }}>
          <div className="studio-section-hdr" style={{ cursor: "default" }}>
            Other
            <span className="count">{parsed.other.length}</span>
          </div>
          <div className="flex flex-wrap gap-1 px-4 pb-3">
            {parsed.other.map((prop) => (
              <span
                key={prop.fullClass}
                className="px-1.5 py-0.5 text-[10px] font-mono rounded"
                style={{
                  background: "var(--studio-input-bg)",
                  color: "var(--studio-text-dimmed)",
                }}
              >
                {prop.fullClass}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category routing
// ---------------------------------------------------------------------------

function CategoryContent({
  category,
  properties,
  onClassChange,
  tokenGroups,
  spacingScale,
}: {
  category: PropertyCategory;
  properties: ParsedProperty[];
  onClassChange: (oldClass: string, newClass: string) => void;
  tokenGroups?: Record<string, any[]>;
  spacingScale?: readonly string[];
}) {
  if (category === "layout") {
    return <LayoutRows properties={properties} onClassChange={onClassChange} />;
  }
  if (category === "color") {
    return (
      <ColorRows
        properties={properties}
        onClassChange={onClassChange}
        tokenGroups={tokenGroups || {}}
      />
    );
  }
  if (category === "spacing") {
    return <SpacingRows properties={properties} onClassChange={onClassChange} spacingScale={spacingScale} />;
  }
  if (category === "shape") {
    return <ShapeRows properties={properties} onClassChange={onClassChange} />;
  }
  // size, typography, etc.
  return <SmartRows properties={properties} onClassChange={onClassChange} spacingScale={spacingScale} />;
}

function CategorySection({
  category,
  label,
  properties,
  onClassChange,
  tokenGroups,
  spacingScale,
}: {
  category: PropertyCategory;
  label: string;
  properties: ParsedProperty[];
  onClassChange: (oldClass: string, newClass: string) => void;
  tokenGroups: Record<string, any[]>;
  spacingScale?: readonly string[];
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div style={{ borderTop: "1px solid var(--studio-border-subtle)" }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="studio-section-hdr"
      >
        {collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
        {label}
        <span className="count">{properties.length}</span>
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-2 pb-2 px-4">
          <CategoryContent
            category={category}
            properties={properties}
            onClassChange={onClassChange}
            tokenGroups={tokenGroups}
            spacingScale={spacingScale}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spacing section — uses real BoxSpacingControl
// ---------------------------------------------------------------------------

function SpacingRows({
  properties,
  onClassChange,
  spacingScale,
}: {
  properties: ParsedProperty[];
  onClassChange: (oldClass: string, newClass: string) => void;
  spacingScale?: readonly string[];
}) {
  const paddingProps = properties.filter((p) =>
    p.property.startsWith("padding")
  );
  const marginProps = properties.filter((p) =>
    p.property.startsWith("margin")
  );
  const gapProps = properties.filter(
    (p) => p.property === "gap" || p.property === "gapX" || p.property === "gapY"
  );

  return (
    <>
      {paddingProps.length > 0 && (
        <ClassBoxSpacing box="padding" properties={paddingProps} onClassChange={onClassChange} />
      )}
      {marginProps.length > 0 && (
        <ClassBoxSpacing box="margin" properties={marginProps} onClassChange={onClassChange} />
      )}
      {gapProps.map((prop) => (
        <PropertyRow key={prop.fullClass} prop={prop} onClassChange={onClassChange} spacingScale={spacingScale} />
      ))}
    </>
  );
}

/**
 * Adapter: wraps BoxSpacingControl with synthesized UnifiedProperty + computedStyles
 * from parsed Tailwind classes.
 */
function ClassBoxSpacing({
  box,
  properties,
  onClassChange,
}: {
  box: "padding" | "margin";
  properties: ParsedProperty[];
  onClassChange: (oldClass: string, newClass: string) => void;
}) {
  const { computedStyles, activeProps, allProperties, classMap } = synthesizeBoxProps(properties, box);
  const twShort = box === "padding" ? "p" : "m";

  return (
    <BoxSpacingControl
      box={box}
      icon={box === "padding" ? PaddingIcon : MarginIcon}
      activeProps={activeProps}
      allProperties={allProperties}
      computedStyles={computedStyles}
      onPreviewInlineStyle={() => {}} // no live preview for class-only editing
      onCommitClass={(newClass, _oldClass) => {
        // Route the commit back to the right original class.
        // _oldClass comes from BoxSpacingControl (the fullClass on the UnifiedProperty).
        // We need to find which original parsed class it maps to.
        // newClass might be a shorthand (p-4) or longhand (pt-4).
        // _oldClass is the fullClass from the synthetic UnifiedProperty.
        if (_oldClass) {
          // Find which original parsed property owns this class
          for (const [, pp] of classMap) {
            if (pp.fullClass === _oldClass) {
              onClassChange(pp.fullClass, newClass);
              return;
            }
          }
        }
        // Fallback: if writing a shorthand that replaces all sides, remove all existing
        // classes for this box and add the new one.
        // Detect shorthand: p-X, px-X, py-X, m-X, mx-X, my-X
        const isShorthand = new RegExp(`^${twShort}[xy]?-`).test(newClass);
        if (isShorthand && properties.length > 0) {
          // Replace the first class, the caller will handle the rest via HMR
          onClassChange(properties[0].fullClass, newClass);
        }
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Shape section — uses real BoxRadiusControl
// ---------------------------------------------------------------------------

function ShapeRows({
  properties,
  onClassChange,
}: {
  properties: ParsedProperty[];
  onClassChange: (oldClass: string, newClass: string) => void;
}) {
  const radiusProps = properties.filter((p) => p.property === "borderRadius");
  const otherProps = properties.filter((p) => p.property !== "borderRadius");

  return (
    <>
      {radiusProps.length > 0 && (
        <ClassBoxRadius properties={radiusProps} onClassChange={onClassChange} />
      )}
      {otherProps.map((prop) => (
        <PropertyRow key={prop.fullClass} prop={prop} onClassChange={onClassChange} />
      ))}
    </>
  );
}

/**
 * Adapter: wraps BoxRadiusControl with synthesized data from parsed Tailwind classes.
 */
function ClassBoxRadius({
  properties,
  onClassChange,
}: {
  properties: ParsedProperty[];
  onClassChange: (oldClass: string, newClass: string) => void;
}) {
  const { computedStyles, activeProps, allProperties } = synthesizeBoxProps(properties, "border-radius");

  return (
    <BoxRadiusControl
      activeProps={activeProps}
      allProperties={allProperties}
      computedStyles={computedStyles}
      onPreviewInlineStyle={() => {}}
      onCommitClass={(newClass, _oldClass) => {
        if (_oldClass) {
          for (const pp of properties) {
            if (pp.fullClass === _oldClass) {
              onClassChange(pp.fullClass, newClass);
              return;
            }
          }
        }
        if (properties.length > 0) {
          onClassChange(properties[0].fullClass, newClass);
        }
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Layout section — segmented icon controls
// ---------------------------------------------------------------------------

function PropLabel({ label, prefix }: { label: string; prefix?: string }) {
  return (
    <div
      className="text-[10px] font-medium mb-1"
      style={{ color: "var(--studio-text-dimmed)", letterSpacing: "0.03em" }}
    >
      {prefix && (
        <span style={{ color: "var(--studio-accent)" }}>{prefix.replace(/:$/, "")} </span>
      )}
      {label}
    </div>
  );
}

const DISPLAY_OPTIONS = [
  { value: "flex", icon: RowsIcon, label: "Flex" },
  { value: "grid", icon: GridIcon, label: "Grid" },
  { value: "block", icon: ColumnsIcon, label: "Block" },
  { value: "hidden", icon: undefined, label: "None" },
];

const ALIGN_OPTIONS = [
  { value: "start", icon: AlignTopIcon, label: "Start" },
  { value: "center", icon: AlignCenterVerticallyIcon, label: "Center" },
  { value: "end", icon: AlignBottomIcon, label: "End" },
  { value: "stretch", icon: undefined, label: "Stretch" },
];

const JUSTIFY_OPTIONS = [
  { value: "start", icon: AlignLeftIcon, label: "Start" },
  { value: "center", icon: AlignCenterHorizontallyIcon, label: "Center" },
  { value: "end", icon: AlignRightIcon, label: "End" },
  { value: "between", icon: SpaceBetweenHorizontallyIcon, label: "Between" },
  { value: "evenly", icon: SpaceEvenlyHorizontallyIcon, label: "Evenly" },
];

function LayoutRows({
  properties,
  onClassChange,
}: {
  properties: ParsedProperty[];
  onClassChange: (oldClass: string, newClass: string) => void;
}) {
  const displayProp = properties.find((p) => p.property === "display");
  const alignProp = properties.find((p) => p.property === "alignItems");
  const justifyProp = properties.find((p) => p.property === "justifyContent");
  const otherProps = properties.filter(
    (p) => !["display", "alignItems", "justifyContent"].includes(p.property)
  );

  return (
    <>
      {displayProp && (
        <div>
          <PropLabel label="Display" prefix={displayProp.prefix} />
          <SegmentedIcons
            options={DISPLAY_OPTIONS}
            value={displayProp.value}
            onChange={(v) => {
              const newClass = buildClass(displayProp.property, v, displayProp.prefix);
              onClassChange(displayProp.fullClass, newClass);
            }}
          />
        </div>
      )}
      {alignProp && (
        <div>
          <PropLabel label="Alignment" prefix={alignProp.prefix} />
          <SegmentedIcons
            options={ALIGN_OPTIONS}
            value={alignProp.value}
            onChange={(v) => {
              const newClass = buildClass(alignProp.property, v, alignProp.prefix);
              onClassChange(alignProp.fullClass, newClass);
            }}
          />
        </div>
      )}
      {justifyProp && (
        <div>
          <PropLabel label="Justify" prefix={justifyProp.prefix} />
          <SegmentedIcons
            options={JUSTIFY_OPTIONS}
            value={justifyProp.value}
            onChange={(v) => {
              const newClass = buildClass(justifyProp.property, v, justifyProp.prefix);
              onClassChange(justifyProp.fullClass, newClass);
            }}
          />
        </div>
      )}
      {otherProps.map((prop) => (
        <PropertyRow key={prop.fullClass} prop={prop} onClassChange={onClassChange} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Color section
// ---------------------------------------------------------------------------

function ColorRows({
  properties,
  onClassChange,
  tokenGroups,
}: {
  properties: ParsedProperty[];
  onClassChange: (oldClass: string, newClass: string) => void;
  tokenGroups: Record<string, any[]>;
}) {
  const colorTokens: Array<{ name: string; value: string }> = [];
  for (const [_, tokens] of Object.entries(tokenGroups)) {
    for (const t of tokens as any[]) {
      if (t.category === "color") {
        const name = t.name.replace(/^--/, "");
        if (!colorTokens.some((ct) => ct.name === name)) {
          colorTokens.push({ name, value: t.lightValue || "" });
        }
      }
    }
  }

  return (
    <>
      {properties.map((prop) => {
        const resolvedColor = colorTokens.find((t) => t.name === prop.value.split("/")[0])?.value || "";
        return (
          <div key={prop.fullClass}>
            <PropLabel label={prop.label} prefix={prop.prefix} />
            <ColorInput
              color={resolvedColor}
              label={prop.value}
              tabs="both"
              defaultTab="tokens"
              tokens={colorTokens}
              activeToken={prop.value}
              onSelectToken={(token) => {
                const newClass = buildClass(prop.property, token, prop.prefix);
                onClassChange(prop.fullClass, newClass);
              }}
            />
          </div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Smart rows — generic fallback for size, typography, etc.
// ---------------------------------------------------------------------------

function SmartRows({
  properties,
  onClassChange,
  spacingScale,
}: {
  properties: ParsedProperty[];
  onClassChange: (oldClass: string, newClass: string) => void;
  spacingScale?: readonly string[];
}) {
  const pairKeys: [string, string][] = [
    ["width", "height"],
    ["minWidth", "minHeight"],
    ["maxWidth", "maxHeight"],
    ["fontSize", "fontWeight"],
  ];

  const rendered = new Set<ParsedProperty>();
  const rows: React.ReactNode[] = [];

  for (const [a, b] of pairKeys) {
    const propA = properties.find((p) => p.property === a);
    const propB = properties.find((p) => p.property === b);
    if (propA || propB) {
      rows.push(
        <div key={`${a}-${b}`} className="grid grid-cols-2 gap-1.5">
          {propA && <PropertyRow prop={propA} onClassChange={onClassChange} spacingScale={spacingScale} />}
          {propB && <PropertyRow prop={propB} onClassChange={onClassChange} spacingScale={spacingScale} />}
        </div>
      );
      if (propA) rendered.add(propA);
      if (propB) rendered.add(propB);
    }
  }

  for (const prop of properties) {
    if (rendered.has(prop)) continue;
    rows.push(<PropertyRow key={prop.fullClass} prop={prop} onClassChange={onClassChange} spacingScale={spacingScale} />);
  }

  return <>{rows}</>;
}

// ---------------------------------------------------------------------------
// Single property row — ScaleInput with icon
// ---------------------------------------------------------------------------

function PropertyRow({
  prop,
  onClassChange,
  spacingScale,
}: {
  prop: ParsedProperty;
  onClassChange: (oldClass: string, newClass: string) => void;
  spacingScale?: readonly string[];
}) {
  const ctrl = getPropertyControl(prop, spacingScale);
  const twPrefix = prop.fullClass.replace(/-[\w[\].]+$/, "");

  if (ctrl.scale.length > 0) {
    return (
      <ScaleInput
        icon={ctrl.icon}
        value={prop.value}
        computedValue={prop.value}
        currentClass={prop.fullClass}
        scale={ctrl.scale}
        prefix={twPrefix}
        cssProp={ctrl.label}
        onCommitClass={(newClass, _oldClass) => {
          onClassChange(prop.fullClass, newClass);
        }}
      />
    );
  }

  const arbitrary = isArbitraryValue(prop.value);
  if (arbitrary) {
    return (
      <div>
        <PropLabel label={ctrl.label} prefix={prop.prefix} />
        <ArbitraryInput
          value={unwrapArbitrary(prop.value)}
          onCommit={(raw) => {
            const newClass = buildClass(prop.property, wrapArbitrary(raw), prop.prefix);
            onClassChange(prop.fullClass, newClass);
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <PropLabel label={ctrl.label} prefix={prop.prefix} />
      <div
        className="text-[11px] font-mono truncate"
        style={{ color: "var(--studio-text)" }}
      >
        {prop.value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Arbitrary text input
// ---------------------------------------------------------------------------

function ArbitraryInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (raw: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  const displayValue = focused ? draft : value;

  return (
    <input
      type="text"
      value={displayValue}
      onChange={(e) => setDraft(e.target.value)}
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
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="studio-select w-full font-mono"
      style={{ fontSize: 11 }}
    />
  );
}
