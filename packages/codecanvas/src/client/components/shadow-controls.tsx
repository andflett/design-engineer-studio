import { useState, useCallback } from "react";
import {
  PlusIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { ColorPicker } from "./color-picker.js";

interface ShadowLayer {
  offsetX: string;
  offsetY: string;
  blur: string;
  spread: string;
  color: string;
  inset: boolean;
}

interface ShadowControlsProps {
  shadow: { value: string; layers: ShadowLayer[] };
  onPreview: (value: string) => void;
  onSave: (value: string) => void;
}

export function ShadowControls({
  shadow,
  onPreview,
  onSave,
}: ShadowControlsProps) {
  const [layers, setLayers] = useState<ShadowLayer[]>(() =>
    shadow.layers.length > 0
      ? shadow.layers
      : [{ offsetX: "0", offsetY: "4px", blur: "6px", spread: "-1px", color: "rgb(0 0 0 / 0.1)", inset: false }]
  );

  const formatValue = useCallback((layers: ShadowLayer[]) => {
    if (layers.length === 0) return "none";
    return layers
      .map((l) => {
        const parts: string[] = [];
        if (l.inset) parts.push("inset");
        parts.push(l.offsetX, l.offsetY, l.blur, l.spread, l.color);
        return parts.join(" ");
      })
      .join(", ");
  }, []);

  const updateLayer = useCallback(
    (index: number, update: Partial<ShadowLayer>) => {
      const newLayers = layers.map((l, i) =>
        i === index ? { ...l, ...update } : l
      );
      setLayers(newLayers);
      onPreview(formatValue(newLayers));
    },
    [layers, onPreview, formatValue]
  );

  const addLayer = () => {
    const newLayers = [
      ...layers,
      { offsetX: "0", offsetY: "4px", blur: "8px", spread: "0", color: "rgb(0 0 0 / 0.1)", inset: false },
    ];
    setLayers(newLayers);
    onPreview(formatValue(newLayers));
  };

  const removeLayer = (index: number) => {
    const newLayers = layers.filter((_, i) => i !== index);
    setLayers(newLayers);
    onPreview(formatValue(newLayers));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Preview */}
      <div
        className="flex items-center justify-center p-6 rounded-lg"
        style={{
          background: "rgb(240, 244, 250)",
        }}
      >
        <div
          className="w-20 h-20 rounded-lg"
          style={{
            background: "white",
            boxShadow: formatValue(layers),
          }}
        />
      </div>

      {/* Layers */}
      {layers.map((layer, i) => (
        <LayerEditor
          key={i}
          layer={layer}
          index={i}
          total={layers.length}
          onChange={(update) => updateLayer(i, update)}
          onRemove={() => removeLayer(i)}
        />
      ))}

      {/* Add layer button */}
      <button
        onClick={addLayer}
        className="flex items-center justify-center gap-1 py-1.5 rounded text-[11px] cursor-pointer"
        style={{
          background: "var(--studio-input-bg)",
          border: "1px solid var(--studio-border-subtle)",
          color: "var(--studio-text-muted)",
        }}
      >
        <PlusIcon style={{ width: 12, height: 12 }} />
        Add Layer
      </button>

      {/* Save */}
      <button
        onClick={() => onSave(formatValue(layers))}
        className="w-full py-1.5 rounded text-[11px] font-medium cursor-pointer"
        style={{
          background: "var(--studio-accent)",
          color: "white",
          border: "none",
        }}
      >
        Save to File
      </button>
    </div>
  );
}

function LayerEditor({
  layer,
  index,
  total,
  onChange,
  onRemove,
}: {
  layer: ShadowLayer;
  index: number;
  total: number;
  onChange: (update: Partial<ShadowLayer>) => void;
  onRemove: () => void;
}) {
  const parseNum = (v: string): number => parseFloat(v) || 0;

  return (
    <div
      className="rounded-lg p-2.5"
      style={{
        background: "var(--studio-input-bg)",
        border: "1px solid var(--studio-border-subtle)",
      }}
    >
      {/* Layer header */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[9px] font-semibold uppercase tracking-wide"
          style={{ color: "var(--studio-text-dimmed)" }}
        >
          Layer {index + 1}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange({ inset: !layer.inset })}
            className={`studio-bp-btn ${layer.inset ? "active" : ""}`}
            style={{ fontSize: 9, padding: "1px 5px" }}
          >
            inset
          </button>
          {total > 1 && (
            <button
              onClick={onRemove}
              className="studio-icon-btn"
              style={{ width: 20, height: 20 }}
            >
              <TrashIcon style={{ width: 10, height: 10 }} />
            </button>
          )}
        </div>
      </div>

      {/* Controls grid */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
        <SliderField
          label="X Offset"
          value={parseNum(layer.offsetX)}
          min={-50}
          max={50}
          unit="px"
          onChange={(v) => onChange({ offsetX: `${v}px` })}
        />
        <SliderField
          label="Y Offset"
          value={parseNum(layer.offsetY)}
          min={-50}
          max={50}
          unit="px"
          onChange={(v) => onChange({ offsetY: `${v}px` })}
        />
        <SliderField
          label="Blur"
          value={parseNum(layer.blur)}
          min={0}
          max={100}
          unit="px"
          onChange={(v) => onChange({ blur: `${v}px` })}
        />
        <SliderField
          label="Spread"
          value={parseNum(layer.spread)}
          min={-50}
          max={50}
          unit="px"
          onChange={(v) => onChange({ spread: `${v}px` })}
        />
      </div>

      {/* Color */}
      <ColorPicker
        color={layer.color}
        onChange={(color) => onChange({ color })}
      />
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span
          className="text-[9px] font-medium"
          style={{ color: "var(--studio-text-dimmed)" }}
        >
          {label}
        </span>
        <span
          className="text-[9px] font-mono"
          style={{ color: "var(--studio-text-muted)" }}
        >
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full"
      />
    </div>
  );
}
