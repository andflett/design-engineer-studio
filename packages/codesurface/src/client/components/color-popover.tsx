/**
 * Color popover components for token selection and OKLCH editing.
 * All popovers use @radix-ui/react-popover for consistent positioning,
 * focus management, and dismissal behavior.
 */
import React, { useState, useCallback, useRef, type RefObject } from "react";
import * as Popover from "@radix-ui/react-popover";
import { RgbaColorPicker } from "react-colorful";
import { converter } from "culori";
import type { RgbaColor } from "react-colorful";
import {
  type InputMode,
  clamp,
  cssToRgba,
  rgbaToCss,
  ModeTabs,
  ColorInputFields,
} from "./color-picker.js";
import { saveToken } from "../lib/scan-actions.js";

const toRgb = converter("rgb");
const toOklch = converter("oklch");

// ---------------------------------------------------------------------------
// Color token picker popover (used by computed-property-panel's ColorControl)
// Uses Radix Popover for positioning/focus/dismiss.
// ---------------------------------------------------------------------------

interface ColorPopoverContentProps {
  currentValue: string;
  availableTokens: string[];
  tokenValues: Record<string, string>;
  onSelect: (token: string) => void;
}

export function ColorPopoverContent({
  currentValue,
  availableTokens,
  tokenValues,
  onSelect,
}: ColorPopoverContentProps) {
  const baseValue = currentValue.split("/")[0];
  const resolvedPreview = tokenValues[baseValue] || "";

  return (
    <>
      {/* Preview swatch */}
      <div
        className="studio-popover-swatch"
        style={{
          "--swatch-color": resolvedPreview,
        } as React.CSSProperties}
      />

      {/* Token list */}
      <div className="studio-popover-list">
        {availableTokens.map((token) => (
          <button
            key={token}
            className={`studio-popover-item ${token === currentValue ? "active" : ""}`}
            onClick={() => onSelect(token)}
          >
            <div
              className="studio-swatch"
              style={{
                "--swatch-color": tokenValues[token.split("/")[0]] || "",
              } as React.CSSProperties}
            />
            <span className="truncate">{token}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// Backwards-compatible wrapper that still accepts anchorRef + onClose
// but uses Radix Popover internally
interface ColorPopoverProps {
  anchorRef: RefObject<HTMLElement | null>;
  currentValue: string;
  availableTokens: string[];
  tokenValues: Record<string, string>;
  onSelect: (token: string) => void;
  onClose: () => void;
}

export function ColorPopover({
  anchorRef,
  currentValue,
  availableTokens,
  tokenValues,
  onSelect,
  onClose,
}: ColorPopoverProps) {
  // Render as a Radix popover anchored via a virtual reference
  return (
    <Popover.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Popover.Anchor virtualRef={anchorRef as React.RefObject<{ getBoundingClientRect: () => DOMRect }>} />
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          sideOffset={4}
          collisionPadding={12}
          className="studio-popover"
        >
          <ColorPopoverContent
            currentValue={currentValue}
            availableTokens={availableTokens}
            tokenValues={tokenValues}
            onSelect={onSelect}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---------------------------------------------------------------------------
// Token editing popover with OKLCH sliders (used by token-editor)
// ---------------------------------------------------------------------------

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

interface TokenPopoverProps {
  anchorRef: RefObject<HTMLElement | null>;
  token: { name: string; value: string; resolvedValue: string };
  theme: "light" | "dark";
  cssFilePath: string;
  contrastToken?: { name: string; resolvedValue: string } | null;
  onPreview: (token: string, value: string) => void;
  onClose: () => void;
}

export function TokenPopover({
  anchorRef,
  token,
  theme,
  cssFilePath,
  contrastToken,
  onPreview,
  onClose,
}: TokenPopoverProps) {
  const [color, setColor] = useState<OklchColor>(() =>
    parseOklch(token.resolvedValue)
  );
  const [inputMode, setInputMode] = useState<InputMode>("oklch");

  // Track RGBA separately during picker drags to avoid lossy OKLCH↔RGBA round-trips.
  // When non-null, this is passed directly to the picker instead of deriving from OKLCH.
  const pickerRgbaRef = useRef<RgbaColor | null>(null);

  // Derive RGBA from OKLCH for the visual picker (only when not actively dragging)
  const rgba: RgbaColor = (() => {
    if (pickerRgbaRef.current) return pickerRgbaRef.current;
    const rgb = toRgb({ mode: "oklch" as const, l: color.l, c: color.c, h: color.h });
    if (rgb) {
      return {
        r: clamp(Math.round((rgb.r ?? 0) * 255), 0, 255),
        g: clamp(Math.round((rgb.g ?? 0) * 255), 0, 255),
        b: clamp(Math.round((rgb.b ?? 0) * 255), 0, 255),
        a: 1,
      };
    }
    return { r: 0, g: 0, b: 0, a: 1 };
  })();

  // Handle visual picker (RGBA) changes → convert to OKLCH
  // Store the RGBA value to avoid round-trip precision loss
  const handlePickerChange = useCallback(
    (c: RgbaColor) => {
      pickerRgbaRef.current = c;
      const oklch = toOklch({ mode: "rgb" as const, r: c.r / 255, g: c.g / 255, b: c.b / 255 });
      if (oklch) {
        const newColor: OklchColor = {
          l: oklch.l ?? 0.5,
          c: oklch.c ?? 0.1,
          h: oklch.h ?? 0,
        };
        setColor(newColor);
        onPreview(token.name, formatOklch(newColor));
      }
    },
    [onPreview, token.name]
  );

  // Handle ColorInputFields changes (RGBA) → convert to OKLCH
  // Clear pickerRgba so the picker re-derives from the new OKLCH
  const handleInputFieldsChange = useCallback(
    (c: RgbaColor) => {
      pickerRgbaRef.current = null;
      const oklch = toOklch({ mode: "rgb" as const, r: c.r / 255, g: c.g / 255, b: c.b / 255 });
      if (oklch) {
        const newColor: OklchColor = {
          l: oklch.l ?? 0.5,
          c: oklch.c ?? 0.1,
          h: oklch.h ?? 0,
        };
        setColor(newColor);
        onPreview(token.name, formatOklch(newColor));
      }
    },
    [onPreview, token.name]
  );

  const savedRef = useRef(false);

  const handleSave = async () => {
    savedRef.current = true;
    const selector = theme === "dark" ? ".dark" : ":root";
    await saveToken(cssFilePath, token.name, formatOklch(color), selector);
    onClose();
  };

  // Revert preview on close without save
  const handleClose = useCallback(() => {
    if (!savedRef.current) {
      onPreview(token.name, token.resolvedValue);
    }
    onClose();
  }, [onClose, onPreview, token.name, token.resolvedValue]);

  const contrastRatio = contrastToken
    ? getContrastRatio(contrastToken.resolvedValue, formatOklch(color))
    : null;

  return (
    <Popover.Root open onOpenChange={(open) => { if (!open) handleClose(); }}>
      <Popover.Anchor virtualRef={anchorRef as React.RefObject<{ getBoundingClientRect: () => DOMRect }>} />
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          sideOffset={4}
          collisionPadding={12}
          className="studio-popover"
          style={{ width: 260 }}
        >
          {/* Token name + contrast */}
          <div className="flex items-center justify-between px-1 mb-1.5">
            <span
              className="text-[11px] font-mono truncate"
              style={{ color: "var(--studio-text)" }}
            >
              {token.name.replace(/^--/, "")}
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

          {/* Visual color picker */}
          <style>{`
            .token-color-picker .react-colorful {
              width: 100% !important;
              height: 140px !important;
              gap: 8px !important;
            }
            .token-color-picker .react-colorful__saturation {
              border-radius: 6px !important;
            }
            .token-color-picker .react-colorful__hue,
            .token-color-picker .react-colorful__alpha {
              height: 10px !important;
              border-radius: 5px !important;
            }
            .token-color-picker .react-colorful__pointer {
              width: 14px !important;
              height: 14px !important;
              border-width: 2px !important;
            }
          `}</style>
          <div className="token-color-picker" style={{ marginBottom: 8 }}>
            <RgbaColorPicker color={rgba} onChange={handlePickerChange} />
          </div>

          {/* Mode tabs */}
          <div style={{ marginBottom: 8 }}>
            <ModeTabs mode={inputMode} onChange={setInputMode} />
          </div>

          {/* Channel inputs per mode */}
          <div style={{ marginBottom: 8 }}>
            <ColorInputFields color={rgba} onChange={handleInputFieldsChange} mode={inputMode} />
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            className="w-full py-1.5 rounded text-[11px] font-medium cursor-pointer"
            style={{
              background: "var(--studio-accent)",
              color: "white",
              border: "none",
            }}
          >
            Save
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

