/**
 * Unified ColorInput — Figma-style color trigger + popover with Custom and Tokens tabs.
 * Replaces ColorPicker, ColorControl, TokenColorRow, ColorPopover, and TokenPopover.
 */
import { useState, useCallback, useRef, useMemo } from "react";
import * as Popover from "@radix-ui/react-popover";
import { RgbaColorPicker } from "react-colorful";
import { converter } from "culori";
import type { RgbaColor } from "react-colorful";
import {
  type InputMode,
  cssToRgba,
  rgbaToCss,
  clamp,
  ModeTabs,
  ColorInputFields,
} from "./color-picker.js";

const toRgb = converter("rgb");
const toOklch = converter("oklch");

/* ------------------------------------------------------------------ */
/*  OKLCH utilities (moved from color-popover.tsx)                     */
/* ------------------------------------------------------------------ */

interface OklchColor {
  l: number;
  c: number;
  h: number;
}

function parseOklch(value: string): OklchColor {
  const match = value.match(
    /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)/
  );
  if (match) {
    const l = match[2] === "%" ? parseFloat(match[1]) / 100 : parseFloat(match[1]);
    return { l, c: parseFloat(match[3]), h: parseFloat(match[4]) };
  }
  return { l: 0.5, c: 0.1, h: 250 };
}

function formatOklch(color: OklchColor): string {
  return `oklch(${color.l.toFixed(3)} ${color.c.toFixed(3)} ${color.h.toFixed(1)})`;
}

function getContrastRatio(fg: string, bg: string): number | null {
  try {
    const fgL = parseOklch(fg).l;
    const bgL = parseOklch(bg).l;
    const lighter = Math.max(fgL, bgL);
    const darker = Math.min(fgL, bgL);
    return (lighter + 0.05) / (darker + 0.05);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ColorInputProps {
  /** Current CSS color value (any format) */
  color: string;
  /** Display text — token name, class, or raw value. Falls back to color. */
  label?: string;
  /** Called during picker drag / input changes (for live preview) */
  onChange?: (color: string) => void;
  /** Called on final commit (pointerUp, blur, Enter). Falls back to onChange. */
  onCommit?: (color: string) => void;

  /** Tab configuration */
  tabs?: "custom" | "tokens" | "both";
  defaultTab?: "custom" | "tokens";

  /** Tokens tab data */
  tokens?: Array<{ name: string; value: string }>;
  activeToken?: string;
  onSelectToken?: (name: string) => void;

  /** Token editing extras (Custom tab, for token-editor context) */
  tokenName?: string;
  contrastToken?: { name: string; value: string } | null;
  onSave?: (oklchValue: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Trigger                                                            */
/* ------------------------------------------------------------------ */

function ColorTrigger({ color, label }: { color: string; label?: string }) {
  return (
    <button type="button" className="studio-scrub-input" style={{ cursor: "pointer" }}>
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          margin: 6,
          marginRight: 0,
          alignSelf: "stretch",
          flexShrink: 0,
          background: color || "transparent",
          backgroundImage: color
            ? `linear-gradient(${color}, ${color}), linear-gradient(45deg, #1a1a24 25%, transparent 25%), linear-gradient(-45deg, #1a1a24 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a24 75%), linear-gradient(-45deg, transparent 75%, #1a1a24 75%)`
            : undefined,
          backgroundSize: color ? "cover, 6px 6px, 6px 6px, 6px 6px, 6px 6px" : undefined,
          backgroundPosition: color ? "0 0, 0 0, 0 3px, 3px -3px, -3px 0" : undefined,
        }}
      />
      <span
        className="studio-scrub-value"
        style={{ color: "var(--studio-text)", userSelect: "none", textAlign: "left" }}
      >
        {label || color}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Tokens tab                                                         */
/* ------------------------------------------------------------------ */

function TokensTab({
  tokens,
  activeToken,
  onSelect,
}: {
  tokens: Array<{ name: string; value: string }>;
  activeToken?: string;
  onSelect: (name: string) => void;
}) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter) return tokens;
    const lc = filter.toLowerCase();
    return tokens.filter((t) => t.name.toLowerCase().includes(lc));
  }, [tokens, filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search tokens..."
        className="studio-input-sm"
        style={{ fontSize: 11 }}
        autoFocus
      />
      <div className="studio-popover-list">
        {filtered.map((token) => (
          <button
            key={token.name}
            className={`studio-popover-item ${token.name === activeToken ? "active" : ""}`}
            onClick={() => onSelect(token.name)}
          >
            <div
              className="studio-swatch"
              style={{
                "--swatch-color": token.value,
              } as React.CSSProperties}
            />
            <span className="truncate">{token.name}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div
            style={{
              fontSize: 10,
              color: "var(--studio-text-dimmed)",
              padding: "8px 8px",
              textAlign: "center",
            }}
          >
            No matching tokens
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom tab                                                         */
/* ------------------------------------------------------------------ */

function CustomTab({
  rgba,
  onPickerChange,
  onFieldsChange,
  tokenName,
  contrastToken,
  currentOklch,
  onSave,
}: {
  rgba: RgbaColor;
  onPickerChange: (c: RgbaColor) => void;
  onFieldsChange: (c: RgbaColor) => void;
  tokenName?: string;
  contrastToken?: { name: string; value: string } | null;
  currentOklch?: OklchColor | null;
  onSave?: (oklchValue: string) => void;
}) {
  const [inputMode, setInputMode] = useState<InputMode>("hex");

  const contrastRatio = contrastToken && currentOklch
    ? getContrastRatio(contrastToken.value, formatOklch(currentOklch))
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Token name + contrast */}
      {tokenName && (
        <div className="flex items-center justify-between px-1">
          <span
            className="text-[11px] font-mono truncate"
            style={{ color: "var(--studio-text)" }}
          >
            {tokenName.replace(/^--/, "")}
          </span>
          {contrastRatio !== null && (
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{
                color:
                  contrastRatio >= 7
                    ? "var(--studio-success)"
                    : contrastRatio >= 4.5
                      ? "var(--studio-warning)"
                      : "var(--studio-danger)",
                background: "var(--studio-input-bg)",
              }}
            >
              {contrastRatio.toFixed(1)}:1
            </span>
          )}
        </div>
      )}

      {/* Visual picker */}
      <div className="studio-color-picker">
        <RgbaColorPicker color={rgba} onChange={onPickerChange} />
      </div>

      {/* Mode tabs */}
      <ModeTabs mode={inputMode} onChange={setInputMode} />

      {/* Channel inputs */}
      <ColorInputFields color={rgba} onChange={onFieldsChange} mode={inputMode} />

      {/* Save button (token editing) */}
      {onSave && currentOklch && (
        <button
          onClick={() => onSave(formatOklch(currentOklch))}
          className="w-full py-1.5 rounded text-[11px] font-medium cursor-pointer"
          style={{
            background: "var(--studio-accent)",
            color: "white",
            border: "none",
          }}
        >
          Save
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab bar                                                            */
/* ------------------------------------------------------------------ */

function TabBar({
  activeTab,
  onChange,
}: {
  activeTab: "custom" | "tokens";
  onChange: (tab: "custom" | "tokens") => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        borderRadius: 4,
        background: "var(--studio-input-bg)",
        padding: 2,
        marginBottom: 8,
      }}
    >
      {(["tokens", "custom"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          style={{
            flex: 1,
            padding: "3px 4px",
            fontSize: 10,
            fontWeight: 500,
            borderRadius: 3,
            border: "none",
            cursor: "pointer",
            transition: "background 0.1s, color 0.1s",
            background: activeTab === tab ? "var(--studio-surface-hover)" : "transparent",
            color: activeTab === tab ? "var(--studio-text)" : "var(--studio-text-dimmed)",
            boxShadow: "none",
          }}
        >
          {tab === "custom" ? "Custom" : "Tokens"}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ColorInput({
  color,
  label,
  onChange,
  onCommit,
  tabs = "custom",
  defaultTab,
  tokens,
  activeToken,
  onSelectToken,
  tokenName,
  contrastToken,
  onSave,
}: ColorInputProps) {
  const firstTab = defaultTab || (tabs === "custom" ? "custom" : "tokens");
  const [activeTab, setActiveTab] = useState<"custom" | "tokens">(firstTab);
  const [open, setOpen] = useState(false);

  // OKLCH state for token editing
  const [oklchState, setOklchState] = useState<OklchColor | null>(null);
  const pickerRgbaRef = useRef<RgbaColor | null>(null);
  const savedRef = useRef(false);

  // Derive RGBA for picker
  const rgba: RgbaColor = (() => {
    if (pickerRgbaRef.current) return pickerRgbaRef.current;
    if (oklchState) {
      const rgb = toRgb({ mode: "oklch" as const, l: oklchState.l, c: oklchState.c, h: oklchState.h });
      if (rgb) {
        return {
          r: clamp(Math.round((rgb.r ?? 0) * 255), 0, 255),
          g: clamp(Math.round((rgb.g ?? 0) * 255), 0, 255),
          b: clamp(Math.round((rgb.b ?? 0) * 255), 0, 255),
          a: 1,
        };
      }
    }
    return cssToRgba(color);
  })();

  const handlePickerChange = useCallback(
    (c: RgbaColor) => {
      pickerRgbaRef.current = c;
      if (onSave) {
        // Token editing mode — track OKLCH
        const oklch = toOklch({ mode: "rgb" as const, r: c.r / 255, g: c.g / 255, b: c.b / 255 });
        if (oklch) {
          const newOklch: OklchColor = { l: oklch.l ?? 0.5, c: oklch.c ?? 0.1, h: oklch.h ?? 0 };
          setOklchState(newOklch);
          onChange?.(formatOklch(newOklch));
        }
      } else {
        onChange?.(rgbaToCss(c));
      }
    },
    [onChange, onSave]
  );

  const handleFieldsChange = useCallback(
    (c: RgbaColor) => {
      pickerRgbaRef.current = null;
      if (onSave) {
        const oklch = toOklch({ mode: "rgb" as const, r: c.r / 255, g: c.g / 255, b: c.b / 255 });
        if (oklch) {
          const newOklch: OklchColor = { l: oklch.l ?? 0.5, c: oklch.c ?? 0.1, h: oklch.h ?? 0 };
          setOklchState(newOklch);
          onChange?.(formatOklch(newOklch));
        }
      } else {
        const css = rgbaToCss(c);
        onChange?.(css);
        onCommit?.(css);
      }
    },
    [onChange, onCommit, onSave]
  );

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        // Reset state on open
        savedRef.current = false;
        pickerRgbaRef.current = null;
        if (onSave) {
          // Initialize OKLCH from current color for token editing
          setOklchState(parseOklch(color));
        }
        setActiveTab(firstTab);
      } else if (!savedRef.current && pickerRgbaRef.current && !onSave) {
        // Closing popover after custom color change — commit the final value
        const finalCss = rgbaToCss(pickerRgbaRef.current);
        onCommit?.(finalCss);
      }
      setOpen(isOpen);
    },
    [color, firstTab, onSave, onCommit]
  );

  const handleSave = useCallback(
    (oklchValue: string) => {
      savedRef.current = true;
      onSave?.(oklchValue);
      setOpen(false);
    },
    [onSave]
  );

  const handleSelectToken = useCallback(
    (name: string) => {
      onSelectToken?.(name);
      setOpen(false);
    },
    [onSelectToken]
  );

  const showTabs = tabs === "both";

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <div>
          <ColorTrigger color={color} label={label} />
        </div>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="left"
          sideOffset={8}
          collisionPadding={12}
          style={{
            width: 260,
            padding: 10,
            background: "var(--studio-surface)",
            border: "1px solid var(--studio-border)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)",
            zIndex: 10000,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {showTabs && <TabBar activeTab={activeTab} onChange={setActiveTab} />}

          {activeTab === "custom" && (
            <CustomTab
              rgba={rgba}
              onPickerChange={handlePickerChange}
              onFieldsChange={handleFieldsChange}
              tokenName={tokenName}
              contrastToken={contrastToken}
              currentOklch={oklchState}
              onSave={onSave ? handleSave : undefined}
            />
          )}

          {activeTab === "tokens" && tokens && (
            <TokensTab
              tokens={tokens}
              activeToken={activeToken}
              onSelect={handleSelectToken}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ------------------------------------------------------------------ */
/*  Compact swatch-only variant (for gradient stops etc.)              */
/* ------------------------------------------------------------------ */

export function ColorInputSwatch({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  const rgba = cssToRgba(color);
  const [inputMode, setInputMode] = useState<InputMode>("hex");

  const handleChange = useCallback(
    (c: RgbaColor) => onChange(rgbaToCss(c)),
    [onChange]
  );

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            border: "1px solid var(--studio-border-subtle)",
            background: color,
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
          }}
        />
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
          <div className="studio-color-picker">
            <RgbaColorPicker color={rgba} onChange={handleChange} />
          </div>
          <ModeTabs mode={inputMode} onChange={setInputMode} />
          <ColorInputFields color={rgba} onChange={handleChange} mode={inputMode} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
