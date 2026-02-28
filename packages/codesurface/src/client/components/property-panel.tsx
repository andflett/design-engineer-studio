import { useState } from "react";
import { SegmentedIcons, StudioSelect } from "./controls/index.js";
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
} from "@radix-ui/react-icons";
import { ColorInput } from "./controls/color-input.js";
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

interface PropertyPanelProps {
  classes: string;
  onClassChange: (oldClass: string, newClass: string) => void;
  tokenGroups: Record<string, any[]>;
  flat?: boolean;
}

export function PropertyPanel({
  classes,
  onClassChange,
  tokenGroups,
  flat = false,
}: PropertyPanelProps) {
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

function CategoryContent({
  category,
  properties,
  onClassChange,
  tokenGroups,
}: {
  category: PropertyCategory;
  properties: ParsedProperty[];
  onClassChange: (oldClass: string, newClass: string) => void;
  tokenGroups?: Record<string, any[]>;
}) {
  return (
    <>
      {category === "layout" ? (
        <LayoutRows properties={properties} onClassChange={onClassChange} />
      ) : category === "color" ? (
        <ColorRows
          properties={properties}
          onClassChange={onClassChange}
          tokenGroups={tokenGroups || {}}
        />
      ) : category === "spacing" ? (
        <SpacingRows properties={properties} onClassChange={onClassChange} />
      ) : (
        <GenericRows
          properties={properties}
          category={category}
          onClassChange={onClassChange}
        />
      )}
    </>
  );
}

function CategorySection({
  category,
  label,
  properties,
  onClassChange,
  tokenGroups,
}: {
  category: PropertyCategory;
  label: string;
  properties: ParsedProperty[];
  onClassChange: (oldClass: string, newClass: string) => void;
  tokenGroups: Record<string, any[]>;
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
          />
        </div>
      )}
    </div>
  );
}

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
        <GenericRow key={prop.fullClass} property={prop} category="layout" onClassChange={onClassChange} />
      ))}
    </>
  );
}

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

function SpacingRows({
  properties,
  onClassChange,
}: {
  properties: ParsedProperty[];
  onClassChange: (oldClass: string, newClass: string) => void;
}) {
  const px = properties.find((p) => p.label === "PX" || p.label === "Pad X" || p.label === "Padding X");
  const py = properties.find((p) => p.label === "PY" || p.label === "Pad Y" || p.label === "Padding Y");
  const mx = properties.find((p) => p.label === "MX" || p.label === "Margin X");
  const my = properties.find((p) => p.label === "MY" || p.label === "Margin Y");
  const gap = properties.find((p) => p.label === "Gap");
  const others = properties.filter(
    (p) => p !== px && p !== py && p !== mx && p !== my && p !== gap
  );

  return (
    <>
      {(px || py) && (
        <div className="studio-two-col">
          {px && <SpacingCell label="Padding X" prefix={px.prefix} prop={px} onClassChange={onClassChange} />}
          {py && <SpacingCell label="Padding Y" prefix={py.prefix} prop={py} onClassChange={onClassChange} />}
        </div>
      )}
      {(mx || my) && (
        <div className="studio-two-col">
          {mx && <SpacingCell label="Margin X" prefix={mx.prefix} prop={mx} onClassChange={onClassChange} />}
          {my && <SpacingCell label="Margin Y" prefix={my.prefix} prop={my} onClassChange={onClassChange} />}
        </div>
      )}
      {gap && (
        <SpacingCell label="Gap" prefix={gap.prefix} prop={gap} onClassChange={onClassChange} />
      )}
      {others.map((prop) => (
        <SpacingCell key={prop.fullClass} label={prop.label} prefix={prop.prefix} prop={prop} onClassChange={onClassChange} />
      ))}
    </>
  );
}

function SpacingCell({
  label,
  prefix,
  prop,
  onClassChange,
}: {
  label: string;
  prefix?: string;
  prop: ParsedProperty;
  onClassChange: (oldClass: string, newClass: string) => void;
}) {
  const arbitrary = isArbitraryValue(prop.value);

  if (arbitrary) {
    return (
      <div>
        <PropLabel label={label} prefix={prefix} />
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
      <PropLabel label={label} prefix={prefix} />
      <StudioSelect
        value={prop.value}
        onChange={(v) => {
          const newClass = buildClass(prop.property, v, prop.prefix);
          onClassChange(prop.fullClass, newClass);
        }}
        className="studio-select w-full"
        options={[
          ...(!SPACING_SCALE.includes(prop.value) ? [{ value: prop.value }] : []),
          ...SPACING_SCALE.map((v) => ({ value: v })),
        ]}
      />
    </div>
  );
}

function GenericRows({
  properties,
  category,
  onClassChange,
}: {
  properties: ParsedProperty[];
  category: PropertyCategory;
  onClassChange: (oldClass: string, newClass: string) => void;
}) {
  if (category === "typography") {
    const fontSize = properties.find((p) => p.property === "fontSize");
    const fontWeight = properties.find((p) => p.property === "fontWeight");
    const others = properties.filter((p) => p !== fontSize && p !== fontWeight);

    return (
      <>
        {others.map((prop) => (
          <GenericRow key={prop.fullClass} property={prop} category={category} onClassChange={onClassChange} />
        ))}
        {(fontSize || fontWeight) && (
          <div className="studio-two-col">
            {fontSize && <GenericRow property={fontSize} category={category} onClassChange={onClassChange} />}
            {fontWeight && <GenericRow property={fontWeight} category={category} onClassChange={onClassChange} />}
          </div>
        )}
      </>
    );
  }

  if (category === "size") {
    const width = properties.find((p) => p.label === "Width" || p.label === "Max Width" || p.label === "Min Width");
    const height = properties.find((p) => p.label === "Height" || p.label === "Max Height" || p.label === "Min Height");
    const others = properties.filter((p) => p !== width && p !== height);

    if (width && height) {
      return (
        <>
          <div className="studio-two-col">
            <GenericRow property={width} category={category} onClassChange={onClassChange} />
            <GenericRow property={height} category={category} onClassChange={onClassChange} />
          </div>
          {others.map((prop) => (
            <GenericRow key={prop.fullClass} property={prop} category={category} onClassChange={onClassChange} />
          ))}
        </>
      );
    }
  }

  return (
    <>
      {properties.map((prop) => (
        <GenericRow
          key={prop.fullClass}
          property={prop}
          category={category}
          onClassChange={onClassChange}
        />
      ))}
    </>
  );
}

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

function GenericRow({
  property,
  category,
  onClassChange,
}: {
  property: ParsedProperty;
  category: PropertyCategory;
  onClassChange: (oldClass: string, newClass: string) => void;
}) {
  const getOptions = (): string[] => {
    switch (category) {
      case "spacing":
        return SPACING_SCALE;
      case "shape":
        if (property.property === "borderRadius") return RADIUS_SCALE;
        return ["0", "1", "2", "4", "8"];
      case "typography":
        if (property.property === "fontSize") return FONT_SIZE_SCALE;
        if (property.property === "fontWeight") return FONT_WEIGHT_SCALE;
        return [];
      case "layout":
        if (property.property === "display")
          return ["flex", "inline-flex", "grid", "block", "inline-block", "hidden"];
        if (property.property === "alignItems")
          return ["start", "end", "center", "baseline", "stretch"];
        if (property.property === "justifyContent")
          return ["start", "end", "center", "between", "around", "evenly"];
        if (property.property === "gridCols")
          return ["1", "2", "3", "4", "5", "6", "none"];
        return [];
      case "size":
        return [];
      default:
        return [];
    }
  };

  const options = getOptions();
  const arbitrary = isArbitraryValue(property.value);

  if (arbitrary) {
    return (
      <div>
        <PropLabel label={property.label} prefix={property.prefix} />
        <ArbitraryInput
          value={unwrapArbitrary(property.value)}
          onCommit={(raw) => {
            const newClass = buildClass(property.property, wrapArbitrary(raw), property.prefix);
            onClassChange(property.fullClass, newClass);
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <PropLabel label={property.label} prefix={property.prefix} />
      {options.length > 0 ? (
        <StudioSelect
          value={property.value}
          onChange={(v) => {
            const newClass = buildClass(property.property, v, property.prefix);
            onClassChange(property.fullClass, newClass);
          }}
          className="studio-select w-full"
          options={[
            ...(!options.includes(property.value) ? [{ value: property.value }] : []),
            ...options.map((opt) => ({ value: opt })),
          ]}
        />
      ) : (
        <div
          className="text-[11px] font-mono truncate"
          style={{ color: "var(--studio-text)" }}
        >
          {property.value}
        </div>
      )}
    </div>
  );
}
