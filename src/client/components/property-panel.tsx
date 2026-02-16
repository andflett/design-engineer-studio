import { useState, useRef } from "react";
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
import { ColorPopover } from "./color-popover.js";
import {
  buildClass,
  parseClasses,
  SPACING_SCALE,
  RADIUS_SCALE,
  FONT_SIZE_SCALE,
  FONT_WEIGHT_SCALE,
  type ParsedProperty,
  type PropertyCategory,
} from "../lib/tailwind-parser.js";

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

  // Flat mode: render all properties inline without section wrappers
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
  const [collapsed, setCollapsed] = useState(false);

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

// --- Label above, control below pattern (like Figma) ---

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

// --- Layout: label above, icon segmented controls below ---

const DISPLAY_OPTIONS = [
  { value: "flex", icon: RowsIcon, label: "Flex" },
  { value: "grid", icon: GridIcon, label: "Grid" },
  { value: "block", icon: ColumnsIcon, label: "Block" },
  { value: "hidden", icon: null, label: "None" },
];

const ALIGN_OPTIONS = [
  { value: "start", icon: AlignTopIcon, label: "Start" },
  { value: "center", icon: AlignCenterVerticallyIcon, label: "Center" },
  { value: "end", icon: AlignBottomIcon, label: "End" },
  { value: "stretch", icon: null, label: "Stretch" },
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

function SegmentedIcons({
  options,
  value,
  onChange,
}: {
  options: { value: string; icon: any; label?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="studio-segmented" style={{ width: "100%" }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={value === opt.value ? "active" : ""}
          title={opt.label || opt.value}
          style={{ flex: 1 }}
        >
          {opt.icon ? <opt.icon style={{ width: 14, height: 14 }} /> : (
            <span style={{ fontSize: 10 }}>{opt.label || opt.value}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// --- Color: label above, swatch + dropdown below ---

function ColorRows({
  properties,
  onClassChange,
  tokenGroups,
}: {
  properties: ParsedProperty[];
  onClassChange: (oldClass: string, newClass: string) => void;
  tokenGroups: Record<string, any[]>;
}) {
  const colorTokens: string[] = [];
  const tokenValues: Record<string, string> = {};
  for (const [_, tokens] of Object.entries(tokenGroups)) {
    for (const t of tokens as any[]) {
      if (t.category === "color") {
        const name = t.name.replace(/^--/, "");
        if (!colorTokens.includes(name)) colorTokens.push(name);
        if (!tokenValues[name]) tokenValues[name] = t.lightValue || "";
      }
    }
  }

  const [openPopover, setOpenPopover] = useState<string | null>(null);

  return (
    <>
      {properties.map((prop) => (
        <ColorRow
          key={prop.fullClass}
          prop={prop}
          colorTokens={colorTokens}
          tokenValues={tokenValues}
          isOpen={openPopover === prop.fullClass}
          onOpen={() => setOpenPopover(prop.fullClass)}
          onClose={() => setOpenPopover(null)}
          onClassChange={onClassChange}
        />
      ))}
    </>
  );
}

function ColorRow({
  prop,
  colorTokens,
  tokenValues,
  isOpen,
  onOpen,
  onClose,
  onClassChange,
}: {
  prop: ParsedProperty;
  colorTokens: string[];
  tokenValues: Record<string, string>;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onClassChange: (oldClass: string, newClass: string) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const resolvedColor = tokenValues[prop.value.split("/")[0]] || "";

  return (
    <div>
      <PropLabel label={prop.label} prefix={prop.prefix} />
      <button
        ref={triggerRef}
        onClick={onOpen}
        className="studio-color-trigger"
      >
        <div
          className="studio-swatch"
          style={{
            "--swatch-color": resolvedColor,
          } as React.CSSProperties}
        />
        <span className="flex-1 truncate text-left">{prop.value}</span>
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <ColorPopover
          anchorRef={triggerRef}
          currentValue={prop.value}
          availableTokens={colorTokens}
          tokenValues={tokenValues}
          onSelect={(token) => {
            const newClass = buildClass(prop.property, token, prop.prefix);
            onClassChange(prop.fullClass, newClass);
            onClose();
          }}
          onClose={onClose}
        />
      )}
    </div>
  );
}

// --- Spacing: 2-col grid like Figma's Dimensions (W/H side by side) ---

function SpacingRows({
  properties,
  onClassChange,
}: {
  properties: ParsedProperty[];
  onClassChange: (oldClass: string, newClass: string) => void;
}) {
  // Group X/Y pairs
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
  return (
    <div>
      <PropLabel label={label} prefix={prefix} />
      <select
        value={prop.value}
        onChange={(e) => {
          const newClass = buildClass(prop.property, e.target.value, prop.prefix);
          onClassChange(prop.fullClass, newClass);
        }}
        className="studio-select w-full"
      >
        {!SPACING_SCALE.includes(prop.value) && (
          <option value={prop.value}>{prop.value}</option>
        )}
        {SPACING_SCALE.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    </div>
  );
}

// --- Generic rows for shape/typography/size ---

function GenericRows({
  properties,
  category,
  onClassChange,
}: {
  properties: ParsedProperty[];
  category: PropertyCategory;
  onClassChange: (oldClass: string, newClass: string) => void;
}) {
  // For typography, pair font size + weight side by side
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

  // For size, pair W + H side by side
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

  return (
    <div>
      <PropLabel label={property.label} prefix={property.prefix} />
      {options.length > 0 ? (
        <select
          value={property.value}
          onChange={(e) => {
            const newClass = buildClass(property.property, e.target.value, property.prefix);
            onClassChange(property.fullClass, newClass);
          }}
          className="studio-select w-full"
        >
          {!options.includes(property.value) && (
            <option value={property.value}>{property.value}</option>
          )}
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
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
