import { useState, useRef, useEffect, type PointerEvent as ReactPointerEvent } from "react";
import { Tooltip } from "../tooltip.js";

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

export function parseNumeric(v: string): { num: number; unit: string } | null {
  const match = v.match(/^(-?[\d.]+)\s*(px|rem|em|%|vh|vw|pt)$/);
  if (match) return { num: parseFloat(match[1]), unit: match[2] };
  const num = parseFloat(v);
  if (!isNaN(num) && String(num) === v.trim()) return { num, unit: "" };
  return null;
}

export function getStep(unit: string): number {
  if (unit === "rem" || unit === "em") return 0.0625;
  return 1;
}

// ---------------------------------------------------------------------------
// ScrubInput
// ---------------------------------------------------------------------------

interface ScrubInputProps {
  icon?: React.ComponentType<{ style?: React.CSSProperties }>;
  label?: string;
  value: string;
  tooltip?: string;
  onPreview?: (v: string) => void;
  onCommit: (v: string) => void;
  step?: number;
  min?: number;
  maxDecimals?: number;
}

export function ScrubInput({
  icon: Icon,
  label,
  value,
  tooltip,
  onPreview,
  onCommit,
  step: stepOverride,
  min,
  maxDecimals,
}: ScrubInputProps) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const scrubRef = useRef<{ startX: number; startVal: number; unit: string } | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingValueRef = useRef<string | null>(null);

  useEffect(() => {
    if (!focused && !scrubbing) setDraft(value);
    if (pendingValueRef.current !== null) pendingValueRef.current = null;
  }, [value, focused, scrubbing]);

  const displayValue = (focused || scrubbing) ? draft : (pendingValueRef.current || value);
  const isScrubbable = parseNumeric(displayValue) !== null;

  const handlePointerDown = (e: ReactPointerEvent) => {
    const parsed = parseNumeric(displayValue);
    if (!parsed) return;
    e.preventDefault();
    scrubRef.current = { startX: e.clientX, startVal: parsed.num, unit: parsed.unit };
    setScrubbing(true);
    const step = stepOverride ?? getStep(parsed.unit);
    const decimals = maxDecimals ?? 4;

    const handleMove = (me: globalThis.PointerEvent) => {
      if (!scrubRef.current) return;
      const multiplier = me.shiftKey ? 10 : 1;
      const delta = Math.round((me.clientX - scrubRef.current.startX) / 2);
      let newVal = scrubRef.current.startVal + delta * step * multiplier;
      if (min !== undefined && newVal < min) newVal = min;
      const formatted = scrubRef.current.unit
        ? `${parseFloat(newVal.toFixed(decimals))}${scrubRef.current.unit}`
        : `${Math.round(newVal)}`;
      setDraft(formatted);
      draftRef.current = formatted;
      onPreview?.(formatted);
    };

    const handleUp = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      if (scrubRef.current) {
        pendingValueRef.current = draftRef.current;
        onCommit(draftRef.current);
        scrubRef.current = null;
      }
      setScrubbing(false);
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  };

  const tooltipContent = tooltip || label || "";

  return (
    <div className="studio-scrub-input">
      {Icon && (
        <Tooltip content={tooltipContent} side="left">
          <div
            className={isScrubbable ? "studio-scrub-icon" : "studio-scrub-icon no-scrub"}
            onPointerDown={isScrubbable ? handlePointerDown : undefined}
          >
            <Icon style={{ width: 12, height: 12 }} />
          </div>
        </Tooltip>
      )}
      {!Icon && label && (
        <Tooltip content={tooltipContent} side="left">
          <div
            className={isScrubbable ? "studio-scrub-label" : "studio-scrub-label no-scrub"}
            onPointerDown={isScrubbable ? handlePointerDown : undefined}
          >
            {label}
          </div>
        </Tooltip>
      )}
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={(e) => { setDraft(e.target.value); }}
        onFocus={() => { setDraft(value); setFocused(true); }}
        onBlur={() => {
          setFocused(false);
          const trimmed = draft.trim();
          if (trimmed && trimmed !== value) {
            pendingValueRef.current = trimmed;
            onCommit(trimmed);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraft(value); setFocused(false); }
        }}
        className="studio-scrub-value"
      />
    </div>
  );
}
