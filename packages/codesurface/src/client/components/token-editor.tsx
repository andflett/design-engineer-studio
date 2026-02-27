import { useState, useRef, useEffect, useCallback, type PointerEvent as ReactPointerEvent } from "react";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  SpaceBetweenHorizontallyIcon,
  CornersIcon,
  BorderWidthIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
  Cross2Icon,
  Pencil1Icon,
} from "@radix-ui/react-icons";
import * as Popover from "@radix-ui/react-popover";
import { RgbaColorPicker } from "react-colorful";
import type { RgbaColor } from "react-colorful";
import { TokenPopover } from "./color-popover.js";
import { ShadowList } from "./shadow-list.js";
import {
  cssToRgba,
  rgbaToCss,
  ModeTabs,
  ColorInputFields,
  type InputMode,
} from "./color-picker.js";
import { useTokens, useShadows, useBorders, useGradients, useStyling } from "../lib/scan-hooks.js";
import { saveToken, saveGradient, saveBorder } from "../lib/scan-actions.js";
import { SPACING_SCALE } from "../../shared/tailwind-parser.js";

interface TokenEditorProps {
  tokenRefs: string[];
  theme: "light" | "dark";
  onPreviewToken: (token: string, value: string) => void;
  onPreviewShadow: (variableName: string, value: string, shadowName?: string) => void;
}

export function TokenEditor({
  tokenRefs,
  theme,
  onPreviewToken,
  onPreviewShadow,
}: TokenEditorProps) {
  const tokenData = useTokens();
  const shadowData = useShadows();
  const borderData = useBorders();
  const gradientData = useGradients();
  const styling = useStyling();

  if (!tokenData) {
    return (
      <div
        className="px-4 py-3 text-[11px]"
        style={{ color: "var(--studio-text-dimmed)" }}
      >
        Loading tokens...
      </div>
    );
  }

  const tokens = tokenData.tokens;
  const cssFilePath = tokenData.cssFilePath;

  const referencedTokens = tokens.filter((t) =>
    tokenRefs.includes(t.name)
  );
  const colorTokenGroups = Object.entries(tokenData.groups)
    .filter(([_, tokens]) => tokens.some((t) => t.category === "color"))
    .slice(0, 8);

  const spacingTokens = tokens.filter((t) => t.category === "spacing");

  const borderColorTokens = tokens.filter((t) =>
    t.category === "color" && ["--border", "--input", "--ring"].includes(t.name)
  );

  const stylingType = styling?.type || "";
  const selector = stylingType === "tailwind-v4" ? "@theme" : (theme === "dark" ? ".dark" : ":root");

  return (
    <div className="">
      {/* Used by element — only show when relevant */}
      {referencedTokens.length > 0 && (
        <Section title="Used by element" count={referencedTokens.length} defaultCollapsed>
          {referencedTokens.map((token: any) => (
            <TokenRow
              key={token.name}
              token={token}
              theme={theme}
              onPreview={onPreviewToken}
              cssFilePath={cssFilePath}
              allTokens={tokens}
            />
          ))}
        </Section>
      )}

      {/* Colors — always visible */}
      <Section title="Colors" count={colorTokenGroups.reduce((sum, [_, g]) => sum + (g as any[]).filter(t => t.category === "color").length, 0)} defaultCollapsed>
        {colorTokenGroups.length > 0 ? (
          <div className="studio-tree">
            {colorTokenGroups.map(([groupName, groupTokens]) => (
              <SubSection key={groupName} title={groupName} count={(groupTokens as any[]).filter(t => t.category === "color").length}>
                {(groupTokens as any[])
                  .filter((t) => t.category === "color")
                  .map((token: any) => (
                    <TokenRow
                      key={token.name}
                      token={token}
                      theme={theme}
                      onPreview={onPreviewToken}
                      cssFilePath={cssFilePath}
                      allTokens={tokens}
                    />
                  ))}
              </SubSection>
            ))}
          </div>
        ) : (
          <EmptyState message="No color tokens found in your CSS." />
        )}
      </Section>

      {/* Spacing — always visible */}
      <Section title="Spacing" count={spacingTokens.length} defaultCollapsed>
        {spacingTokens.length > 0 ? (
          <SpacingScale
            spacingTokens={spacingTokens}
            cssFilePath={cssFilePath}
            theme={theme}
          />
        ) : (
          <EmptyState message="No spacing tokens found in your CSS." />
        )}
      </Section>

      {/* Shadows — always visible */}
      <Section title="Shadows" count={shadowData?.shadows?.length || 0} defaultCollapsed>
        {shadowData && shadowData.shadows.length > 0 ? (
          <ShadowList
            shadows={shadowData.shadows}
            cssFilePath={shadowData.cssFilePath}
            stylingType={shadowData.stylingType}
            onPreviewShadow={onPreviewShadow}
          />
        ) : (
          <EmptyState message="No shadows found. Add shadow CSS variables to your global CSS file." />
        )}
      </Section>

      {/* Borders — uses scan-borders data */}
      <Section title="Borders" count={(borderData?.borders?.length || 0) + borderColorTokens.length} defaultCollapsed>
        <BordersSection
          borders={borderData?.borders || []}
          borderColorTokens={borderColorTokens}
          theme={theme}
          cssFilePath={borderData?.cssFilePath || cssFilePath}
          stylingType={borderData?.stylingType || stylingType}
          allTokens={tokens}
          onPreviewToken={onPreviewToken}
        />
      </Section>

      {/* Gradients — gradient builder */}
      <Section title="Gradients" count={gradientData?.gradients?.length || 0} defaultCollapsed>
        <GradientBuilder
          gradients={gradientData?.gradients || []}
          cssFilePath={gradientData?.cssFilePath || cssFilePath}
          stylingType={gradientData?.stylingType || stylingType}
        />
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section / SubSection / EmptyState
// ---------------------------------------------------------------------------

function Section({
  title,
  count,
  children,
  defaultCollapsed = true,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div style={{ borderTop: "1px solid var(--studio-border-subtle)" }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="studio-section-hdr"
      >
        {collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
        {title}
        {count !== undefined && <span className="count">{count}</span>}
      </button>
      {!collapsed && <div className="pb-2">{children}</div>}
    </div>
  );
}

function SubSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="studio-tree-node">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="studio-section-hdr"
        style={{ fontSize: 10 }}
      >
        {collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
        <span style={{ color: "var(--studio-text)", fontWeight: 600 }}>
          {title}
        </span>
        {count !== undefined && <span className="count">{count}</span>}
      </button>
      {!collapsed && <div className="studio-tree-content">{children}</div>}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div
      className="text-[10px] font-semibold uppercase tracking-wider mb-2"
      style={{ color: "var(--studio-text-dimmed)" }}
    >
      {label}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="px-4 py-4 text-[11px] text-center"
      style={{ color: "var(--studio-text-dimmed)" }}
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TokenRow — color tokens with swatch and popover
// ---------------------------------------------------------------------------

function TokenRow({
  token,
  theme,
  onPreview,
  cssFilePath,
  allTokens,
}: {
  token: any;
  theme: "light" | "dark";
  onPreview: (token: string, value: string) => void;
  cssFilePath: string;
  allTokens: any[];
}) {
  const [showPopover, setShowPopover] = useState(false);
  const rowRef = useRef<HTMLButtonElement>(null);
  const value = theme === "dark" && token.darkValue ? token.darkValue : token.lightValue;
  const resolvedValue = value;

  const fgTokenName = token.name.endsWith("-foreground")
    ? token.name.replace("-foreground", "")
    : `${token.name}-foreground`;
  const fgToken = allTokens.find((t: any) => t.name === fgTokenName);
  const fgValue = fgToken
    ? theme === "dark" && fgToken.darkValue ? fgToken.darkValue : fgToken.lightValue
    : null;

  return (
    <>
      <button
        ref={rowRef}
        onClick={() => setShowPopover(!showPopover)}
        className="studio-prop-row w-full text-left"
        style={{
          background: showPopover ? "var(--studio-surface-hover)" : "transparent",
          cursor: "pointer",
          border: "none",
        }}
      >
        <div
          className="studio-swatch"
          style={{
            "--swatch-color": value,
            width: 20,
            height: 20,
          } as React.CSSProperties}
        />
        <span
          className="flex-1 text-[11px] font-mono truncate"
          style={{ color: "var(--studio-text)" }}
        >
          {token.name.replace(/^--/, "")}
        </span>
      </button>

      {showPopover && (
        <TokenPopover
          anchorRef={rowRef}
          token={{
            name: token.name,
            value: value,
            resolvedValue,
          }}
          theme={theme}
          cssFilePath={cssFilePath}
          contrastToken={
            fgValue
              ? { name: fgTokenName, resolvedValue: fgValue }
              : null
          }
          onPreview={onPreview}
          onClose={() => setShowPopover(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// TokenScrubRow — scrub-enabled input for spacing/radius/border tokens
// ---------------------------------------------------------------------------

function parseTokenNumeric(v: string): { num: number; unit: string } | null {
  const match = v.match(/^(-?[\d.]+)\s*(px|rem|em|%|vh|vw|pt)$/);
  if (match) return { num: parseFloat(match[1]), unit: match[2] };
  const num = parseFloat(v);
  if (!isNaN(num) && String(num) === v.trim()) return { num, unit: "" };
  return null;
}

function getStep(unit: string): number {
  if (unit === "rem" || unit === "em") return 0.0625;
  return 1;
}

function TokenScrubRow({
  token,
  icon: Icon,
  onSave,
  step: stepOverride,
  min,
  maxDecimals,
}: {
  token: any;
  icon?: React.ComponentType<{ style?: React.CSSProperties }>;
  onSave: (value: string) => void;
  step?: number;
  min?: number;
  maxDecimals?: number;
}) {
  const displayVal = token.value ?? token.lightValue ?? "";
  const [value, setValue] = useState(displayVal);
  const [focused, setFocused] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const scrubRef = useRef<{ startX: number; startVal: number; unit: string } | null>(null);
  const draftRef = useRef(value);
  draftRef.current = value;

  useEffect(() => {
    if (!focused && !scrubbing) setValue(displayVal);
  }, [displayVal, focused, scrubbing]);

  const isScrubbable = parseTokenNumeric(value) !== null;

  const handlePointerDown = (e: ReactPointerEvent) => {
    const parsed = parseTokenNumeric(value);
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
      setValue(formatted);
      draftRef.current = formatted;
    };

    const handleUp = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      if (scrubRef.current) {
        onSave(draftRef.current);
        scrubRef.current = null;
      }
      setScrubbing(false);
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  };

  const displayName = (token.name || "").replace(/^--/, "");

  return (
    <div>
      <div
        className="text-[10px] font-mono truncate mb-0.5"
        style={{ color: "var(--studio-text-dimmed)" }}
      >
        {displayName}
      </div>
      <div className="studio-scrub-input">
        {Icon && (
          <div
            className={isScrubbable ? "studio-scrub-icon" : "studio-scrub-icon no-scrub"}
            onPointerDown={isScrubbable ? handlePointerDown : undefined}
          >
            <Icon style={{ width: 12, height: 12 }} />
          </div>
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onSave(value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="studio-scrub-value"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spacing Scale — editable base + derived scale table
// ---------------------------------------------------------------------------

/** Numeric steps from the Tailwind spacing scale (excludes "px" keyword) */
const SPACING_NUMERIC_STEPS = SPACING_SCALE.filter((s) => s !== "px" && s !== "0")
  .map(Number)
  .filter((n) => !isNaN(n));

function parseSpacingBase(value: string): { num: number; unit: string } | null {
  const match = value.match(/^([\d.]+)(rem|px|em)$/);
  if (match) return { num: parseFloat(match[1]), unit: match[2] };
  return null;
}

function SpacingScale({
  spacingTokens,
  cssFilePath,
  theme,
}: {
  spacingTokens: any[];
  cssFilePath: string;
  theme: "light" | "dark";
}) {
  // Find the base --spacing token (Tailwind v4 pattern)
  const baseToken = spacingTokens.find((t: any) => t.name === "--spacing");
  const otherTokens = spacingTokens.filter((t: any) => t.name !== "--spacing");
  const baseVal = baseToken
    ? (theme === "dark" && baseToken.darkValue ? baseToken.darkValue : baseToken.lightValue)
    : null;
  const parsed = baseVal ? parseSpacingBase(baseVal) : null;

  // Show a subset of the scale that's useful (skip the very large ones to keep it compact)
  const visibleSteps = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96];
  const maxBarValue = parsed ? 16 * parsed.num : 4; // 16× base for full bar width

  return (
    <div className="pb-2">
      {/* Editable base token */}
      {baseToken && (
        <div className="px-4 mb-2">
          <TokenScrubRow
            token={baseToken}
            icon={SpaceBetweenHorizontallyIcon}
            onSave={(value) => saveToken(cssFilePath, baseToken.name, value, theme === "dark" ? ".dark" : ":root")}
          />
        </div>
      )}

      {/* Other non-base spacing tokens */}
      {otherTokens.length > 0 && (
        <div className="px-4 mb-2 grid grid-cols-2 gap-1.5">
          {otherTokens.map((token: any) => (
            <TokenScrubRow
              key={token.name}
              token={token}
              icon={SpaceBetweenHorizontallyIcon}
              onSave={(value) => saveToken(cssFilePath, token.name, value, theme === "dark" ? ".dark" : ":root")}
            />
          ))}
        </div>
      )}

      {/* Derived scale table */}
      {parsed && (
        <div className="px-4">
          <div
            className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: "var(--studio-text-dimmed)" }}
          >
            Scale
          </div>
          <div
            className="rounded-md overflow-hidden"
            style={{
              border: "1px solid var(--studio-border-subtle)",
            }}
          >
            {/* Header */}
            <div
              className="grid text-[9px] font-semibold uppercase tracking-wider"
              style={{
                gridTemplateColumns: "42px 56px 1fr",
                color: "var(--studio-text-dimmed)",
                borderBottom: "1px solid var(--studio-border-subtle)",
                background: "var(--studio-input-bg)",
                padding: "4px 8px",
              }}
            >
              <span>Name</span>
              <span>Size</span>
              <span></span>
            </div>
            {/* px row */}
            <div
              className="grid items-center"
              style={{
                gridTemplateColumns: "42px 56px 1fr",
                borderBottom: "1px solid var(--studio-border-subtle)",
                padding: "3px 8px",
              }}
            >
              <span
                className="text-[11px] font-mono"
                style={{ color: "var(--studio-text)" }}
              >
                px
              </span>
              <span
                className="text-[10px] font-mono"
                style={{ color: "var(--studio-text-muted)" }}
              >
                1px
              </span>
              <div
                style={{
                  height: 6,
                  borderRadius: 2,
                  background: "var(--studio-accent)",
                  opacity: 0.25,
                  width: "1px",
                  minWidth: 1,
                }}
              />
            </div>
            {/* Numeric rows */}
            {visibleSteps.map((step, i) => {
              const computedNum = step * parsed.num;
              const computedStr = `${parseFloat(computedNum.toFixed(4))}${parsed.unit}`;
              const barFraction = Math.min(computedNum / maxBarValue, 1);
              return (
                <div
                  key={step}
                  className="grid items-center"
                  style={{
                    gridTemplateColumns: "42px 56px 1fr",
                    borderBottom: i < visibleSteps.length - 1 ? "1px solid var(--studio-border-subtle)" : "none",
                    padding: "3px 8px",
                  }}
                >
                  <span
                    className="text-[11px] font-mono"
                    style={{ color: "var(--studio-text)" }}
                  >
                    {step}
                  </span>
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: "var(--studio-text-muted)" }}
                  >
                    {computedStr}
                  </span>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 2,
                      background: "var(--studio-accent)",
                      opacity: 0.4,
                      width: `${Math.max(barFraction * 100, 1)}%`,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Borders Section — uses scan-borders data with framework defaults
// ---------------------------------------------------------------------------

function BordersSection({
  borders,
  borderColorTokens,
  theme,
  cssFilePath,
  stylingType,
  allTokens,
  onPreviewToken,
}: {
  borders: any[];
  borderColorTokens: any[];
  theme: "light" | "dark";
  cssFilePath: string;
  stylingType: string;
  allTokens: any[];
  onPreviewToken: (token: string, value: string) => void;
}) {
  const radiusBorders = borders.filter((b: any) => b.kind === "radius");
  const widthBorders = borders.filter((b: any) => b.kind === "width");
  const hasContent = radiusBorders.length > 0 || widthBorders.length > 0 || borderColorTokens.length > 0;

  if (!hasContent) {
    return <EmptyState message="No border tokens found." />;
  }

  const selector = stylingType === "tailwind-v4" ? "@theme" : (theme === "dark" ? ".dark" : ":root");

  const handleSave = async (border: any, newValue: string) => {
    const variableName = border.cssVariable || `--${border.name}`;
    const isNew = border.source === "framework-preset" && !border.isOverridden;
    const endpoint = isNew ? "/api/gradients/create" : "/api/gradients";
    await saveBorder(endpoint, {
      filePath: cssFilePath,
      variableName,
      value: newValue,
      selector,
    });
  };

  return (
    <div className="flex flex-col gap-3 pb-2">
      {/* Radius subsection */}
      {radiusBorders.length > 0 && (
        <div className="px-4">
          <SectionLabel label="Radius" />
          <div className="grid grid-cols-2 gap-1.5">
            {radiusBorders.map((border: any) => (
              <TokenScrubRow
                key={border.name}
                token={border}
                icon={CornersIcon}
                onSave={(v) => handleSave(border, v)}
                step={0.025}
                min={0}
                maxDecimals={3}
              />
            ))}
          </div>
        </div>
      )}

      {/* Border Width subsection */}
      {widthBorders.length > 0 && (
        <div className="px-4">
          <SectionLabel label="Width" />
          <div className="grid grid-cols-2 gap-1.5">
            {widthBorders.map((border: any) => (
              <TokenScrubRow
                key={border.name}
                token={border}
                icon={BorderWidthIcon}
                onSave={(v) => handleSave(border, v)}
                min={0}
              />
            ))}
          </div>
        </div>
      )}

      {/* Border Color subsection */}
      {borderColorTokens.length > 0 && (
        <div>
          <div className="px-4">
            <SectionLabel label="Color" />
          </div>
          <div className="flex flex-col gap-0 mb-2">
            {borderColorTokens.map((token: any) => (
              <TokenRow
                key={token.name}
                token={token}
                theme={theme}
                onPreview={onPreviewToken}
                cssFilePath={cssFilePath}
                allTokens={allTokens}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gradient Builder
// ---------------------------------------------------------------------------

interface GradientStop {
  color: string;
  position: number; // 0-100
}

interface GradientState {
  name: string;
  direction: string;
  stops: GradientStop[];
}

const DIRECTION_OPTIONS = [
  { value: "to right", label: "→" },
  { value: "to bottom right", label: "↘" },
  { value: "to bottom", label: "↓" },
  { value: "to bottom left", label: "↙" },
  { value: "to left", label: "←" },
  { value: "to top left", label: "↖" },
  { value: "to top", label: "↑" },
  { value: "to top right", label: "↗" },
];

function formatGradientCss(direction: string, stops: GradientStop[]): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const stopStrings = sorted.map((s) => `${s.color} ${s.position}%`);
  return `linear-gradient(${direction}, ${stopStrings.join(", ")})`;
}

function parseGradientValue(value: string): { direction: string; stops: GradientStop[] } | null {
  const match = value.match(/linear-gradient\(([^,]+),\s*(.*)\)$/);
  if (!match) return null;

  const direction = match[1].trim();
  const stopsStr = match[2];

  // Split stops by comma, respecting color function parens
  const stops: GradientStop[] = [];
  let depth = 0;
  let current = "";
  for (const char of stopsStr) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      const parsed = parseStop(current.trim());
      if (parsed) stops.push(parsed);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    const parsed = parseStop(current.trim());
    if (parsed) stops.push(parsed);
  }

  return { direction, stops };
}

function parseStop(s: string): GradientStop | null {
  // Match "color position%" e.g. "#ff0000 50%" or "rgb(0,0,0) 100%"
  const posMatch = s.match(/\s+(\d+)%$/);
  if (posMatch) {
    return {
      color: s.slice(0, posMatch.index).trim(),
      position: parseInt(posMatch[1]),
    };
  }
  // No position — return with default
  return { color: s.trim(), position: 0 };
}

function GradientBuilder({
  gradients,
  cssFilePath,
  stylingType,
}: {
  gradients: any[];
  cssFilePath: string;
  stylingType: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const selector = stylingType === "tailwind-v4" ? "@theme" : ":root";

  const handleSave = async (variableName: string, value: string, isNew: boolean) => {
    const endpoint = isNew ? "/api/gradients/create" : "/api/gradients";
    await saveGradient(endpoint, { filePath: cssFilePath, variableName, value, selector });
  };

  const handleDelete = async (variableName: string) => {
    await saveGradient("/api/gradients/delete", { filePath: cssFilePath, variableName, selector });
  };

  return (
    <div className="px-4 pb-2">
      {/* Existing gradients */}
      {gradients.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {gradients.map((g: any) => (
            <GradientRow
              key={g.cssVariable}
              gradient={g}
              isEditing={editing === g.cssVariable}
              onEdit={() => setEditing(editing === g.cssVariable ? null : g.cssVariable)}
              onSave={(value) => {
                handleSave(g.cssVariable, value, false);
                setEditing(null);
              }}
              onDelete={() => {
                handleDelete(g.cssVariable);
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          ))}
        </div>
      )}

      {/* Create new */}
      {creating ? (
        <GradientCreator
          onSave={(name, value) => {
            handleSave(`--${name}`, value, true);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="studio-addable-row w-full"
          style={{ justifyContent: "center", gap: 6 }}
        >
          <PlusIcon style={{ width: 12, height: 12 }} />
          <span className="text-[11px]" style={{ color: "var(--studio-text-dimmed)" }}>
            Add gradient
          </span>
        </button>
      )}

      {gradients.length === 0 && !creating && (
        <div
          className="text-[10px] leading-relaxed text-center mt-2"
          style={{ color: "var(--studio-text-dimmed)" }}
        >
          No gradient tokens yet. Add one to store a reusable gradient as a CSS custom property.
        </div>
      )}
    </div>
  );
}

function GradientRow({
  gradient,
  isEditing,
  onEdit,
  onSave,
  onDelete,
  onCancel,
}: {
  gradient: any;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (value: string) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  return (
    <div>
      <button
        onClick={onEdit}
        className="flex items-center gap-2 w-full text-left p-0"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <div
          className="studio-gradient-swatch"
          style={{
            background: gradient.value,
            width: 32,
            height: 24,
            flexShrink: 0,
          }}
        />
        <span
          className="flex-1 text-[11px] font-mono truncate"
          style={{ color: "var(--studio-text)" }}
        >
          {gradient.name}
        </span>
        <Pencil1Icon style={{ width: 10, height: 10, color: "var(--studio-text-dimmed)" }} />
      </button>

      {isEditing && (
        <div className="mt-2">
          <GradientEditor
            initialValue={gradient.value}
            onSave={onSave}
            onDelete={onDelete}
            onCancel={onCancel}
          />
        </div>
      )}
    </div>
  );
}

function GradientCreator({
  onSave,
  onCancel,
}: {
  onSave: (name: string, value: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("gradient-1");

  const handleSave = (value: string) => {
    const cleanName = name.replace(/^--/, "").replace(/[^a-z0-9-]/g, "-");
    onSave(cleanName, value);
  };

  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: "var(--studio-input-bg)",
        border: "1px solid var(--studio-border-subtle)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <label className="text-[10px] shrink-0" style={{ color: "var(--studio-text-dimmed)" }}>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="studio-input-sm flex-1"
          placeholder="gradient-name"
        />
      </div>
      <GradientEditor
        initialValue="linear-gradient(to right, #3b82f6 0%, #8b5cf6 100%)"
        onSave={handleSave}
        onDelete={undefined}
        onCancel={onCancel}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// StopColorPicker — inline swatch that opens the shared Radix color picker
// ---------------------------------------------------------------------------

function StopColorPicker({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  const [inputMode, setInputMode] = useState<InputMode>("hex");
  const rgba = cssToRgba(color);

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
          <style>{`
            .gradient-stop-picker .react-colorful {
              width: 100% !important;
              height: 150px !important;
              gap: 8px !important;
            }
            .gradient-stop-picker .react-colorful__saturation {
              border-radius: 6px !important;
            }
            .gradient-stop-picker .react-colorful__hue,
            .gradient-stop-picker .react-colorful__alpha {
              height: 12px !important;
              border-radius: 6px !important;
            }
            .gradient-stop-picker .react-colorful__pointer {
              width: 16px !important;
              height: 16px !important;
              border-width: 2px !important;
            }
          `}</style>
          <div className="gradient-stop-picker">
            <RgbaColorPicker color={rgba} onChange={handleChange} />
          </div>
          <ModeTabs mode={inputMode} onChange={setInputMode} />
          <ColorInputFields color={rgba} onChange={handleChange} mode={inputMode} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function GradientEditor({
  initialValue,
  onSave,
  onDelete,
  onCancel,
}: {
  initialValue: string;
  onSave: (value: string) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const parsed = parseGradientValue(initialValue);
  const [direction, setDirection] = useState(parsed?.direction || "to right");
  const [stops, setStops] = useState<GradientStop[]>(
    parsed?.stops?.length
      ? parsed.stops
      : [
          { color: "#3b82f6", position: 0 },
          { color: "#8b5cf6", position: 100 },
        ]
  );

  const gradientCss = formatGradientCss(direction, stops);

  const updateStop = (index: number, updates: Partial<GradientStop>) => {
    setStops((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...updates } : s))
    );
  };

  const addStop = () => {
    // Add a stop midway between last two stops
    const sorted = [...stops].sort((a, b) => a.position - b.position);
    const last = sorted[sorted.length - 1];
    const secondLast = sorted.length > 1 ? sorted[sorted.length - 2] : { position: 0 };
    const newPos = Math.round((last.position + secondLast.position) / 2);
    setStops([...stops, { color: "#6366f1", position: newPos }]);
  };

  const removeStop = (index: number) => {
    if (stops.length <= 2) return;
    setStops(stops.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Preview bar */}
      <div
        className="w-full rounded-md"
        style={{
          background: gradientCss,
          height: 32,
          border: "1px solid var(--studio-border-subtle)",
        }}
      />

      {/* Direction */}
      <div className="flex items-center gap-2">
        <label className="text-[10px] shrink-0" style={{ color: "var(--studio-text-dimmed)" }}>Dir</label>
        <div className="studio-segmented" style={{ flex: 1 }}>
          {DIRECTION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDirection(opt.value)}
              className={direction === opt.value ? "active" : ""}
              title={opt.value}
              style={{ flex: 1, padding: "3px 2px", fontSize: 11 }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stops */}
      <div className="flex flex-col gap-1.5">
        {stops.map((stop, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <StopColorPicker
              color={stop.color}
              onChange={(c) => updateStop(i, { color: c })}
            />
            <input
              type="text"
              value={stop.color}
              onChange={(e) => updateStop(i, { color: e.target.value })}
              className="studio-input-sm flex-1"
              style={{ fontSize: 10 }}
            />
            <input
              type="number"
              min={0}
              max={100}
              value={stop.position}
              onChange={(e) => updateStop(i, { position: parseInt(e.target.value) || 0 })}
              className="studio-input-sm"
              style={{ width: 48, textAlign: "right", fontSize: 10 }}
            />
            <span className="text-[9px]" style={{ color: "var(--studio-text-dimmed)" }}>%</span>
            {stops.length > 2 && (
              <button
                onClick={() => removeStop(i)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--studio-text-dimmed)",
                  padding: 2,
                  display: "flex",
                }}
              >
                <Cross2Icon style={{ width: 10, height: 10 }} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add stop */}
      <button
        onClick={addStop}
        className="studio-addable-row"
        style={{ justifyContent: "center", gap: 4, padding: "3px 8px" }}
      >
        <PlusIcon style={{ width: 10, height: 10 }} />
        <span className="text-[10px]" style={{ color: "var(--studio-text-dimmed)" }}>Add stop</span>
      </button>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={() => onSave(gradientCss)}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-[10px] font-medium"
          style={{
            background: "var(--studio-accent)",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          <CheckIcon style={{ width: 10, height: 10 }} />
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-[10px]"
          style={{
            background: "transparent",
            color: "var(--studio-text-dimmed)",
            border: "1px solid var(--studio-border-subtle)",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-[10px] ml-auto"
            style={{
              background: "transparent",
              color: "var(--studio-danger)",
              border: "1px solid var(--studio-border-subtle)",
              cursor: "pointer",
            }}
          >
            <TrashIcon style={{ width: 10, height: 10 }} />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

