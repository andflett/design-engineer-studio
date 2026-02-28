import { useState, useRef, useEffect, type PointerEvent as ReactPointerEvent } from "react";
import { CodeIcon, TokensIcon } from "@radix-ui/react-icons";
import { Tooltip } from "../tooltip.js";
import { StudioSelect } from "./select.js";
import { parseNumeric, getStep } from "./scrub-input.js";
import { computedToTailwindClass } from "../../../shared/tailwind-map.js";

export function ScaleInput({
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
  // Hold the committed CSS value until HMR updates computedValue, preventing
  // a flicker back to the old value during the write→HMR roundtrip.
  const pendingValueRef = useRef<string | null>(null);

  // Keep ref in sync with prop when element re-selects
  useEffect(() => {
    lastWrittenClassRef.current = currentClass;
  }, [currentClass]);

  // Clear pending value once computedValue actually changes (HMR arrived)
  useEffect(() => {
    if (pendingValueRef.current !== null) {
      pendingValueRef.current = null;
    }
  }, [computedValue]);

  // Sync draft when the external value changes (e.g. element re-selected)
  useEffect(() => {
    if (!focused) {
      setDraft(arbitraryMode ? computedValue : normalizedValue);
    }
    // Never auto-switch modes — the user controls the toggle explicitly.
  }, [normalizedValue, computedValue, focused, arbitraryMode]);

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
    // Hold the committed value so the input doesn't flicker back to the old
    // computedValue during the write→HMR roundtrip.
    pendingValueRef.current = trimmed;
    // 1. Direct scale match (works for spacing: "4" → "p-4")
    if (scale.includes(trimmed)) {
      const newClass = `${prefix}-${trimmed}`;
      onCommitClass(newClass, oldClass);
      lastWrittenClassRef.current = newClass;
      return;
    }
    // 2. CSS value → Tailwind class mapping (works for "700" → "font-bold", "24px" → "text-2xl")
    const mapped = computedToTailwindClass(cssProp, trimmed);
    if (mapped && mapped.exact) {
      onCommitClass(mapped.tailwindClass, oldClass);
      lastWrittenClassRef.current = mapped.tailwindClass;
      return;
    }
    // 3. Arbitrary fallback — use mapped arbitrary class if available, else build one
    const newClass = mapped ? mapped.tailwindClass : `${prefix}-[${trimmed}]`;
    onCommitClass(newClass, oldClass);
    lastWrittenClassRef.current = newClass;
  };

  // Scrub support for arbitrary mode
  const scrubRef = useRef<{ startX: number; startVal: number; unit: string } | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const scrubValue = arbitraryMode ? (focused ? draft : (pendingValueRef.current || computedValue)) : null;
  const isScrubbable = arbitraryMode && scrubValue !== null && parseNumeric(scrubValue) !== null;

  const handleScrubDown = (e: ReactPointerEvent) => {
    if (!scrubValue) return;
    const parsed = parseNumeric(scrubValue);
    if (!parsed) return;

    e.preventDefault();
    scrubRef.current = { startX: e.clientX, startVal: parsed.num, unit: parsed.unit };
    setScrubbing(true);
    const step = getStep(parsed.unit);

    const handleMove = (me: globalThis.PointerEvent) => {
      if (!scrubRef.current) return;
      const multiplier = me.shiftKey ? 10 : 1;
      const delta = Math.round((me.clientX - scrubRef.current.startX) / 2);
      const newVal = scrubRef.current.startVal + delta * step * multiplier;
      const formatted = scrubRef.current.unit
        ? `${parseFloat(newVal.toFixed(4))}${scrubRef.current.unit}`
        : `${Math.round(newVal)}`;
      setDraft(formatted);
      draftRef.current = formatted;
      if (onPreview) onPreview(formatted);
    };

    const handleUp = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      if (scrubRef.current) {
        const val = draftRef.current;
        if (onCommitValue) onCommitValue(val);
        else handleArbitraryCommit(val);
        scrubRef.current = null;
      }
      setScrubbing(false);
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  };

  return (
    <div
      className="studio-scale-input"
      style={arbitraryMode ? { borderLeft: "2px solid var(--studio-accent)" } : undefined}
    >
      {Icon && (
        <Tooltip content={label || cssProp} side="left">
          <div
            className={isScrubbable ? "studio-scrub-icon" : "studio-scale-icon"}
            onPointerDown={isScrubbable ? handleScrubDown : undefined}
          >
            <Icon style={{ width: 12, height: 12 }} />
          </div>
        </Tooltip>
      )}
      {!Icon && label && (
        <Tooltip content={cssProp} side="left">
          <div
            className={isScrubbable ? "studio-scrub-label" : "studio-scale-label"}
            onPointerDown={isScrubbable ? handleScrubDown : undefined}
          >
            {label}
          </div>
        </Tooltip>
      )}

      {!arbitraryMode ? (
        <StudioSelect
          value={isInScale ? normalizedValue : "__custom__"}
          onChange={handleScaleChange}
          options={[
            ...(!isInScale ? [{ value: "__custom__", label: normalizedValue || "—" }] : []),
            ...scale.map((val) => ({ value: val })),
          ]}
        />
      ) : (
        <input
          type="text"
          value={focused || scrubbing ? draft : (pendingValueRef.current || computedValue)}
          placeholder="e.g. 16px"
          onChange={(e) => {
            setDraft(e.target.value);
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

      <Tooltip content={arbitraryMode ? "Custom CSS value — click to use token scale" : "Token scale — click to enter custom CSS value"} side="bottom">
        <button
          onClick={() => {
            setArbitraryMode(!arbitraryMode);
            if (!arbitraryMode) setDraft(computedValue);
          }}
          className={`studio-scale-toggle${arbitraryMode ? " active" : ""}`}
        >
          {arbitraryMode
            ? <CodeIcon style={{ width: 12, height: 12 }} />
            : <TokensIcon style={{ width: 12, height: 12 }} />
          }
        </button>
      </Tooltip>
    </div>
  );
}
