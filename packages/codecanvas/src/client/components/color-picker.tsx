import { useState, useEffect, useCallback } from "react";
import { RgbaColorPicker } from "react-colorful";
import { formatHex, converter } from "culori";
import * as Popover from "@radix-ui/react-popover";
import type { RgbaColor } from "react-colorful";

type InputMode = "hex" | "rgb" | "hsl" | "oklch";

const INPUT_MODES: { value: InputMode; label: string }[] = [
  { value: "hex", label: "Hex" },
  { value: "rgb", label: "RGB" },
  { value: "hsl", label: "HSL" },
  { value: "oklch", label: "OKLCH" },
];

const toRgb = converter("rgb");
const toHsl = converter("hsl");
const toOklch = converter("oklch");

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function cssToRgba(color: string): RgbaColor {
  const modernRgb = color.match(
    /rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?))?\s*\)/
  );
  if (modernRgb) {
    const a = modernRgb[4]
      ? modernRgb[4].endsWith("%")
        ? parseFloat(modernRgb[4]) / 100
        : parseFloat(modernRgb[4])
      : 1;
    return {
      r: clamp(Math.round(parseFloat(modernRgb[1])), 0, 255),
      g: clamp(Math.round(parseFloat(modernRgb[2])), 0, 255),
      b: clamp(Math.round(parseFloat(modernRgb[3])), 0, 255),
      a: clamp(a, 0, 1),
    };
  }

  const legacyRgba = color.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/
  );
  if (legacyRgba) {
    return {
      r: clamp(Math.round(parseFloat(legacyRgba[1])), 0, 255),
      g: clamp(Math.round(parseFloat(legacyRgba[2])), 0, 255),
      b: clamp(Math.round(parseFloat(legacyRgba[3])), 0, 255),
      a: clamp(parseFloat(legacyRgba[4] ?? "1"), 0, 1),
    };
  }

  const parsed = toRgb(color);
  if (parsed) {
    return {
      r: Math.round((parsed.r ?? 0) * 255),
      g: Math.round((parsed.g ?? 0) * 255),
      b: Math.round((parsed.b ?? 0) * 255),
      a: parsed.alpha ?? 1,
    };
  }

  return { r: 0, g: 0, b: 0, a: 1 };
}

function rgbaToCss(c: RgbaColor): string {
  if (c.a >= 1) return `rgb(${c.r} ${c.g} ${c.b})`;
  const alpha = Math.round(c.a * 100) / 100;
  return `rgb(${c.r} ${c.g} ${c.b} / ${alpha})`;
}

function rgbaToCulori(c: RgbaColor) {
  return { mode: "rgb" as const, r: c.r / 255, g: c.g / 255, b: c.b / 255, alpha: c.a };
}

function rgbaToHex(c: RgbaColor): string {
  return formatHex(rgbaToCulori(c)) ?? "#000000";
}

/* ------------------------------------------------------------------ */
/*  Shared sub-components                                              */
/* ------------------------------------------------------------------ */

function ChannelInput({
  label,
  value,
  onChange,
  min = 0,
  max = 255,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
      <label
        style={{
          fontSize: 9,
          fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
          textTransform: "uppercase",
          color: "var(--studio-text-dimmed)",
        }}
      >
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            const n = parseFloat(e.target.value);
            if (!isNaN(n)) onChange(String(clamp(n, min, max)));
          }}
          className="studio-input"
          style={{ width: "100%", fontSize: 10, paddingRight: suffix ? 16 : undefined }}
        />
        {suffix && (
          <span
            style={{
              position: "absolute",
              right: 5,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 9,
              color: "var(--studio-text-dimmed)",
              fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
              pointerEvents: "none",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function AlphaInput({ color, onChange }: { color: RgbaColor; onChange: (c: RgbaColor) => void }) {
  return (
    <ChannelInput
      label="A"
      value={String(Math.round(color.a * 100))}
      onChange={(v) => {
        const n = parseInt(v);
        if (!isNaN(n)) onChange({ ...color, a: clamp(n, 0, 100) / 100 });
      }}
      max={100}
      suffix="%"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Color input fields (per mode)                                      */
/* ------------------------------------------------------------------ */

function ColorInputFields({
  color,
  onChange,
  mode,
}: {
  color: RgbaColor;
  onChange: (c: RgbaColor) => void;
  mode: InputMode;
}) {
  const [hexInput, setHexInput] = useState(rgbaToHex(color).replace("#", ""));

  useEffect(() => {
    setHexInput(rgbaToHex(color).replace("#", ""));
  }, [color.r, color.g, color.b]);

  const culoriColor = rgbaToCulori(color);

  const commitHex = (v: string) => {
    const cleaned = v.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    setHexInput(cleaned);
    if (cleaned.length === 6 || cleaned.length === 3) {
      const parsed = toRgb(`#${cleaned}`);
      if (parsed) {
        onChange({
          r: Math.round((parsed.r ?? 0) * 255),
          g: Math.round((parsed.g ?? 0) * 255),
          b: Math.round((parsed.b ?? 0) * 255),
          a: color.a,
        });
      }
    }
  };

  if (mode === "hex") {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
          <label
            style={{
              fontSize: 9,
              fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
              textTransform: "uppercase",
              color: "var(--studio-text-dimmed)",
            }}
          >
            Hex
          </label>
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 6,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 10,
                color: "var(--studio-text-dimmed)",
                fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
                pointerEvents: "none",
              }}
            >
              #
            </span>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => commitHex(e.target.value)}
              onBlur={() => commitHex(hexInput)}
              className="studio-input"
              style={{ width: "100%", fontSize: 10, paddingLeft: 14, textTransform: "uppercase" }}
              maxLength={6}
            />
          </div>
        </div>
        <AlphaInput color={color} onChange={onChange} />
      </div>
    );
  }

  if (mode === "rgb") {
    return (
      <div style={{ display: "flex", gap: 6 }}>
        <ChannelInput label="R" value={String(color.r)} max={255}
          onChange={(v) => { const n = parseInt(v); if (!isNaN(n)) onChange({ ...color, r: clamp(n, 0, 255) }); }} />
        <ChannelInput label="G" value={String(color.g)} max={255}
          onChange={(v) => { const n = parseInt(v); if (!isNaN(n)) onChange({ ...color, g: clamp(n, 0, 255) }); }} />
        <ChannelInput label="B" value={String(color.b)} max={255}
          onChange={(v) => { const n = parseInt(v); if (!isNaN(n)) onChange({ ...color, b: clamp(n, 0, 255) }); }} />
        <AlphaInput color={color} onChange={onChange} />
      </div>
    );
  }

  if (mode === "hsl") {
    const hsl = toHsl(culoriColor);
    const h = Math.round(hsl?.h ?? 0);
    const s = Math.round((hsl?.s ?? 0) * 100);
    const l = Math.round((hsl?.l ?? 0) * 100);

    const updateHsl = (channel: "h" | "s" | "l", val: string) => {
      const n = parseFloat(val);
      if (isNaN(n)) return;
      const newH = channel === "h" ? clamp(n, 0, 360) : (hsl?.h ?? 0);
      const newS = channel === "s" ? clamp(n, 0, 100) / 100 : (hsl?.s ?? 0);
      const newL = channel === "l" ? clamp(n, 0, 100) / 100 : (hsl?.l ?? 0);
      const rgb = toRgb({ mode: "hsl", h: newH, s: newS, l: newL });
      if (rgb) {
        onChange({
          r: Math.round((rgb.r ?? 0) * 255),
          g: Math.round((rgb.g ?? 0) * 255),
          b: Math.round((rgb.b ?? 0) * 255),
          a: color.a,
        });
      }
    };

    return (
      <div style={{ display: "flex", gap: 6 }}>
        <ChannelInput label="H" value={String(h)} max={360} suffix="°" onChange={(v) => updateHsl("h", v)} />
        <ChannelInput label="S" value={String(s)} max={100} suffix="%" onChange={(v) => updateHsl("s", v)} />
        <ChannelInput label="L" value={String(l)} max={100} suffix="%" onChange={(v) => updateHsl("l", v)} />
        <AlphaInput color={color} onChange={onChange} />
      </div>
    );
  }

  // OKLCH
  const oklch = toOklch(culoriColor);
  const okL = Math.round((oklch?.l ?? 0) * 100);
  const okC = oklch?.c ?? 0;
  const okH = Math.round(oklch?.h ?? 0);

  const updateOklch = (channel: "l" | "c" | "h", val: string) => {
    const n = parseFloat(val);
    if (isNaN(n)) return;
    const newL = channel === "l" ? clamp(n, 0, 100) / 100 : (oklch?.l ?? 0);
    const newC = channel === "c" ? clamp(n, 0, 0.4) : (oklch?.c ?? 0);
    const newH = channel === "h" ? clamp(n, 0, 360) : (oklch?.h ?? 0);
    const rgb = toRgb({ mode: "oklch", l: newL, c: newC, h: newH });
    if (rgb) {
      onChange({
        r: clamp(Math.round((rgb.r ?? 0) * 255), 0, 255),
        g: clamp(Math.round((rgb.g ?? 0) * 255), 0, 255),
        b: clamp(Math.round((rgb.b ?? 0) * 255), 0, 255),
        a: color.a,
      });
    }
  };

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <ChannelInput label="L" value={String(okL)} max={100} suffix="%" onChange={(v) => updateOklch("l", v)} />
      <ChannelInput label="C" value={okC.toFixed(3)} min={0} max={0.4} step={0.001} onChange={(v) => updateOklch("c", v)} />
      <ChannelInput label="H" value={String(okH)} max={360} suffix="°" onChange={(v) => updateOklch("h", v)} />
      <AlphaInput color={color} onChange={onChange} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mode tabs                                                          */
/* ------------------------------------------------------------------ */

function ModeTabs({ mode, onChange }: { mode: InputMode; onChange: (mode: InputMode) => void }) {
  return (
    <div
      style={{
        display: "flex",
        borderRadius: 4,
        background: "var(--studio-input-bg)",
        padding: 2,
      }}
    >
      {INPUT_MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => onChange(m.value)}
          style={{
            flex: 1,
            padding: "2px 4px",
            fontSize: 9,
            fontWeight: 500,
            borderRadius: 3,
            border: "none",
            cursor: "pointer",
            transition: "background 0.1s, color 0.1s",
            background: mode === m.value ? "var(--studio-surface-hover)" : "transparent",
            color: mode === m.value ? "var(--studio-text)" : "var(--studio-text-dimmed)",
            boxShadow: mode === m.value ? "0 1px 2px rgba(0,0,0,0.2)" : "none",
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main ColorPicker                                                   */
/* ------------------------------------------------------------------ */

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [inputMode, setInputMode] = useState<InputMode>("hex");

  const rgba = cssToRgba(color);

  const handleChange = useCallback(
    (c: RgbaColor) => {
      onChange(rgbaToCss(c));
    },
    [onChange]
  );

  return (
    <div className="mt-1.5">
      <div
        className="text-[9px] font-medium mb-0.5"
        style={{ color: "var(--studio-text-dimmed)" }}
      >
        Color
      </div>

      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="studio-color-trigger"
            style={{ fontSize: 10 }}
          >
            <div
              className="studio-swatch"
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                ["--swatch-color" as string]: color,
              }}
            />
            <span style={{ fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace", fontSize: 10 }}>
              {color}
            </span>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="left"
            sideOffset={8}
            collisionPadding={12}
            style={{
              width: 232,
              padding: 12,
              background: "var(--studio-surface)",
              border: "1px solid var(--studio-border)",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)",
              zIndex: 10000,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <style>{`
              .shadow-color-picker .react-colorful {
                width: 100% !important;
                height: 150px !important;
                gap: 8px !important;
              }
              .shadow-color-picker .react-colorful__saturation {
                border-radius: 6px !important;
              }
              .shadow-color-picker .react-colorful__hue,
              .shadow-color-picker .react-colorful__alpha {
                height: 12px !important;
                border-radius: 6px !important;
              }
              .shadow-color-picker .react-colorful__pointer {
                width: 16px !important;
                height: 16px !important;
                border-width: 2px !important;
              }
            `}</style>
            <div className="shadow-color-picker">
              <RgbaColorPicker color={rgba} onChange={handleChange} />
            </div>
            <ModeTabs mode={inputMode} onChange={setInputMode} />
            <ColorInputFields color={rgba} onChange={handleChange} mode={inputMode} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
