/**
 * Component isolation toolbar — shown when a component is in preview mode.
 * Displays the component name, a back button, and per-prop Radix Select
 * dropdowns to configure the preview instance/grid.
 */
import { useState, useMemo, useCallback } from "react";
import * as Select from "@radix-ui/react-select";
import {
  ArrowLeftIcon,
  Component1Icon,
  ChevronDownIcon,
  CheckIcon,
  MixerHorizontalIcon,
  MixerVerticalIcon,
  DimensionsIcon,
  ColorWheelIcon,
  EyeClosedIcon,
  ReloadIcon,
  SquareIcon,
  TextAlignCenterIcon,
  LayersIcon,
  SliderIcon,
} from "@radix-ui/react-icons";
import type { ComponentEntry, VariantDimension } from "../../server/lib/scan-components.js";
import type { PreviewCombination } from "../../shared/protocol.js";

// ---------------------------------------------------------------------------
// Icon map for common CVA prop names
// ---------------------------------------------------------------------------

type IconComponent = React.ComponentType<{ style?: React.CSSProperties }>;

const PROP_ICON_MAP: Record<string, IconComponent> = {
  variant:      MixerHorizontalIcon,
  intent:       MixerHorizontalIcon,
  appearance:   MixerHorizontalIcon,
  type:         MixerHorizontalIcon,
  kind:         MixerHorizontalIcon,
  size:         DimensionsIcon,
  scale:        DimensionsIcon,
  sizing:       DimensionsIcon,
  color:        ColorWheelIcon,
  theme:        ColorWheelIcon,
  palette:      ColorWheelIcon,
  colorScheme:  ColorWheelIcon,
  scheme:       ColorWheelIcon,
  disabled:     EyeClosedIcon,
  hidden:       EyeClosedIcon,
  loading:      ReloadIcon,
  status:       ReloadIcon,
  state:        ReloadIcon,
  shape:        SquareIcon,
  rounded:      SquareIcon,
  radius:       SquareIcon,
  align:        TextAlignCenterIcon,
  alignment:    TextAlignCenterIcon,
  justify:      TextAlignCenterIcon,
  orientation:  MixerVerticalIcon,
  direction:    MixerVerticalIcon,
  layout:       MixerVerticalIcon,
  layer:        LayersIcon,
  level:        LayersIcon,
  elevation:    LayersIcon,
};

function getPropIcon(name: string): IconComponent {
  return PROP_ICON_MAP[name] ?? PROP_ICON_MAP[name.toLowerCase()] ?? SliderIcon;
}

// ---------------------------------------------------------------------------
// Combination generation
// ---------------------------------------------------------------------------

type DimSelection = "all" | string;

/**
 * Generate preview combinations based on per-dimension selections.
 * "all" = expand that dimension across the grid (original behaviour).
 * A specific value = pin that dimension for all rows.
 */
function generateCombinationsFromSelections(
  variants: VariantDimension[],
  selections: Record<string, DimSelection>
): PreviewCombination[] {
  if (variants.length === 0) return [{ label: "Default", props: {} }];

  const expandDims = variants.filter((d) => selections[d.name] === "all");
  const baseProps: Record<string, string> = {};

  for (const dim of variants) {
    const sel = selections[dim.name];
    baseProps[dim.name] = sel === "all" ? dim.default : sel;
  }

  if (expandDims.length === 0) {
    return [{ label: "Instance", props: { ...baseProps } }];
  }

  const combinations: PreviewCombination[] = [];
  for (const dim of expandDims) {
    for (const option of dim.options) {
      combinations.push({
        label: `${dim.name}: ${option}`,
        props: { ...baseProps, [dim.name]: option },
      });
    }
  }

  // Dedupe identical prop sets
  const seen = new Set<string>();
  return combinations.filter((c) => {
    const key = JSON.stringify(c.props);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Initial combination generator (used by app.tsx before the panel mounts).
 * Expands all enabled dimensions.
 */
export function generateCombinations(
  variants: VariantDimension[],
  enabledDimensions?: Set<string>
): PreviewCombination[] {
  if (variants.length === 0) return [{ label: "Default", props: {} }];

  const defaults: Record<string, string> = {};
  for (const dim of variants) defaults[dim.name] = dim.default;

  const combinations: PreviewCombination[] = [];
  for (const dim of variants) {
    if (enabledDimensions && !enabledDimensions.has(dim.name)) continue;
    for (const option of dim.options) {
      combinations.push({ label: `${dim.name}: ${option}`, props: { ...defaults, [dim.name]: option } });
    }
  }

  const seen = new Set<string>();
  return combinations.filter((c) => {
    const key = JSON.stringify(c.props);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// IsolationView
// ---------------------------------------------------------------------------

interface IsolationViewProps {
  component: ComponentEntry;
  onBack: () => void;
  onCombinationsChange: (combinations: PreviewCombination[]) => void;
}

export function IsolationView({
  component,
  onBack,
  onCombinationsChange,
}: IsolationViewProps) {
  const [selections, setSelections] = useState<Record<string, DimSelection>>(
    () => Object.fromEntries(component.variants.map((v) => [v.name, "all"]))
  );

  const combinations = useMemo(
    () => generateCombinationsFromSelections(component.variants, selections),
    [component.variants, selections]
  );

  // Notify parent when combinations change
  const prevCombosRef = useMemo(() => ({ current: "" }), []);
  const combosKey = JSON.stringify(combinations);
  if (prevCombosRef.current !== combosKey) {
    prevCombosRef.current = combosKey;
    setTimeout(() => onCombinationsChange(combinations), 0);
  }

  const updateSelection = useCallback((name: string, value: DimSelection) => {
    setSelections((prev) => ({ ...prev, [name]: value }));
  }, []);

  const activeCount = Object.values(selections).filter((v) => v === "all").length;

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "var(--studio-surface)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b shrink-0"
        style={{ borderColor: "var(--studio-border)" }}
      >
        <button
          onClick={onBack}
          className="studio-icon-btn shrink-0"
          style={{ width: 22, height: 22 }}
          title="Back to page"
        >
          <ArrowLeftIcon style={{ width: 12, height: 12 }} />
        </button>
        <Component1Icon
          style={{ width: 12, height: 12, color: "var(--studio-accent)", flexShrink: 0 }}
        />
        <span
          className="text-[11px] font-semibold truncate flex-1"
          style={{ color: "var(--studio-text)" }}
        >
          {component.name}
        </span>
        <span className="text-[10px]" style={{ color: "var(--studio-text-dimmed)" }}>
          {combinations.length} {combinations.length === 1 ? "combo" : "combos"}
        </span>
      </div>

      {/* Props */}
      {component.variants.length > 0 ? (
        <div className="flex flex-col gap-1.5 px-3 py-3 overflow-y-auto">
          {component.variants.map((dim) => {
            const Icon = getPropIcon(dim.name);
            const sel = selections[dim.name];
            return (
              <div key={dim.name} className="flex items-center gap-2">
                {/* Icon */}
                <Icon
                  style={{
                    width: 11,
                    height: 11,
                    color: sel !== "all" ? "var(--studio-accent)" : "var(--studio-text-dimmed)",
                    flexShrink: 0,
                  }}
                />
                {/* Prop name */}
                <span
                  className="text-[10px] font-mono shrink-0 truncate"
                  style={{
                    color: sel !== "all" ? "var(--studio-text)" : "var(--studio-text-dimmed)",
                    width: 64,
                  }}
                  title={dim.name}
                >
                  {dim.name}
                </span>
                {/* Select */}
                <PropSelect
                  value={sel}
                  options={dim.options}
                  onValueChange={(v) => updateSelection(dim.name, v)}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="px-3 py-4 text-[11px] text-center"
          style={{ color: "var(--studio-text-dimmed)" }}
        >
          No variant props detected.
        </div>
      )}

      {/* Footer hint */}
      {component.variants.length > 0 && activeCount > 0 && (
        <div
          className="px-3 py-2 text-[10px] border-t mt-auto shrink-0"
          style={{
            color: "var(--studio-text-dimmed)",
            borderColor: "var(--studio-border-subtle)",
          }}
        >
          {activeCount} prop{activeCount !== 1 ? "s" : ""} expanding the grid
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PropSelect — Radix Select styled to match the studio theme
// ---------------------------------------------------------------------------

function PropSelect({
  value,
  options,
  onValueChange,
}: {
  value: string;
  options: string[];
  onValueChange: (v: string) => void;
}) {
  return (
    <Select.Root value={value} onValueChange={onValueChange}>
      <Select.Trigger className="studio-prop-select-trigger" asChild={false}>
        <span className="studio-prop-select-value">
          <Select.Value />
        </span>
        <Select.Icon asChild>
          <ChevronDownIcon style={{ width: 10, height: 10, flexShrink: 0 }} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="studio-prop-select-content"
          position="popper"
          sideOffset={4}
          collisionPadding={12}
        >
          <Select.Viewport>
            {/* "All" option — expands this dimension in the grid */}
            <PropSelectItem value="all" current={value}>
              <span style={{ color: "var(--studio-text-dimmed)", fontStyle: "italic" }}>All</span>
            </PropSelectItem>

            <Select.Separator className="studio-prop-select-separator" />

            {options.map((opt) => (
              <PropSelectItem key={opt} value={opt} current={value}>
                {opt}
              </PropSelectItem>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function PropSelectItem({
  value,
  current,
  children,
}: {
  value: string;
  current: string;
  children: React.ReactNode;
}) {
  return (
    <Select.Item value={value} className="studio-prop-select-item">
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator className="studio-prop-select-check">
        <CheckIcon style={{ width: 10, height: 10 }} />
      </Select.ItemIndicator>
    </Select.Item>
  );
}
