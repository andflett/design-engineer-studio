import { useState, useRef, useCallback } from "react";
import { ScrubInput } from "./controls/index.js";
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
import { ShadowList } from "./shadow-list.js";
import { ColorInput, ColorInputSwatch } from "./controls/color-input.js";
import { useTokens, useShadows, useBorders, useGradients, useSpacing, useStyling } from "../lib/scan-hooks.js";
import { saveToken, saveGradient, saveBorder, saveSpacing } from "../lib/scan-actions.js";
import { SPACING_SCALE } from "../../shared/tailwind-parser.js";

interface TokenEditorProps {
  tokenRefs: string[];
  theme: "light" | "dark";
  onPreviewToken: (token: string, value: string) => void;
  onClearTokenPreview: () => void;
  onPreviewShadow: (variableName: string, value: string, shadowName?: string) => void;
}

export function TokenEditor({
  tokenRefs,
  theme,
  onPreviewToken,
  onClearTokenPreview,
  onPreviewShadow,
}: TokenEditorProps) {
  const tokenData = useTokens();
  const shadowData = useShadows();
  const borderData = useBorders();
  const gradientData = useGradients();
  const spacingData = useSpacing();
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

  const spacingDefs = spacingData?.spacing || [];

  const borderColorTokens = tokens.filter((t) =>
    t.category === "color" && ["--border", "--input", "--ring"].includes(t.name)
  );

  const radiusBorders = borderData?.borders?.filter((b: any) => b.kind === "radius") || [];
  const widthBorders = borderData?.borders?.filter((b: any) => b.kind === "width") || [];

  const stylingType = styling?.type || "";
  const selector = stylingType === "tailwind-v4" ? "@theme" : (theme === "dark" ? ".dark" : ":root");

  return (
    <div className="">
      {/* Used by element — only show when relevant */}
      {referencedTokens.length > 0 && (
        <Section title="Used by selected element" count={referencedTokens.length} defaultCollapsed>
          <div className="flex flex-col gap-1.5 px-4 pb-2">
            {referencedTokens.map((token: any) => {
              const value = theme === "dark" && token.darkValue ? token.darkValue : token.lightValue;
              const fgTokenName = token.name.endsWith("-foreground")
                ? token.name.replace("-foreground", "")
                : `${token.name}-foreground`;
              const fgToken = tokens.find((t: any) => t.name === fgTokenName);
              const fgValue = fgToken
                ? theme === "dark" && fgToken.darkValue ? fgToken.darkValue : fgToken.lightValue
                : null;
              return (
                <ColorInput
                  key={token.name}
                  color={value}
                  label={token.name.replace(/^--/, "")}
                  tabs="custom"
                  tokenName={token.name}
                  contrastToken={fgValue ? { name: fgTokenName, value: fgValue } : null}
                  onChange={(v) => onPreviewToken(token.name, v)}
                  onSave={(oklchValue) => {
                    saveToken(cssFilePath, token.name, oklchValue, selector);
                    onClearTokenPreview();
                  }}
                />
              );
            })}
          </div>
        </Section>
      )}

      {/* Colors — always visible */}
      <Section title="Colors" count={colorTokenGroups.reduce((sum, [_, g]) => sum + (g as any[]).filter(t => t.category === "color").length, 0)} defaultCollapsed>
        {colorTokenGroups.length > 0 ? (
          <div className="studio-tree">
            {colorTokenGroups.map(([groupName, groupTokens]) => (
              <SubSection key={groupName} title={groupName} count={(groupTokens as any[]).filter(t => t.category === "color").length}>
                <div className="flex flex-col gap-1.5 pb-1">
                  {(groupTokens as any[])
                    .filter((t) => t.category === "color")
                    .map((token: any) => {
                      const value = theme === "dark" && token.darkValue ? token.darkValue : token.lightValue;
                      const fgTokenName = token.name.endsWith("-foreground")
                        ? token.name.replace("-foreground", "")
                        : `${token.name}-foreground`;
                      const fgToken = tokens.find((t: any) => t.name === fgTokenName);
                      const fgValue = fgToken
                        ? theme === "dark" && fgToken.darkValue ? fgToken.darkValue : fgToken.lightValue
                        : null;
                      return (
                        <ColorInput
                          key={token.name}
                          color={value}
                          label={token.name.replace(/^--/, "")}
                          tabs="custom"
                          tokenName={token.name}
                          contrastToken={fgValue ? { name: fgTokenName, value: fgValue } : null}
                          onChange={(v) => onPreviewToken(token.name, v)}
                          onSave={(oklchValue) => {
                            saveToken(cssFilePath, token.name, oklchValue, selector);
                            onClearTokenPreview();
                          }}
                        />
                      );
                    })}
                </div>
              </SubSection>
            ))}
          </div>
        ) : (
          <EmptyState message="No color tokens found in your CSS." />
        )}
      </Section>

      {/* Spacing — always visible */}
      <Section title="Spacing" count={spacingDefs.length} defaultCollapsed>
        {spacingDefs.length > 0 ? (
          <SpacingScale
            spacingDefs={spacingDefs}
            cssFilePath={spacingData?.cssFilePath || cssFilePath}
            stylingType={spacingData?.stylingType || stylingType}
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

      {/* Radii */}
      <Section title="Radii" count={radiusBorders.length} defaultCollapsed>
        <RadiiSection
          borders={radiusBorders}
          theme={theme}
          cssFilePath={borderData?.cssFilePath || cssFilePath}
          stylingType={borderData?.stylingType || stylingType}
        />
      </Section>

      {/* Borders — widths + colors */}
      <Section title="Borders" count={widthBorders.length + borderColorTokens.length} defaultCollapsed>
        <BordersSection
          widthBorders={widthBorders}
          borderColorTokens={borderColorTokens}
          theme={theme}
          cssFilePath={borderData?.cssFilePath || cssFilePath}
          stylingType={borderData?.stylingType || stylingType}
          allTokens={tokens}
          onPreviewToken={onPreviewToken}
          onClearPreview={onClearTokenPreview}
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
// TokenScrubRow — scrub-enabled input for spacing/radius/border tokens
// ---------------------------------------------------------------------------

function TokenScrubRow({
  token,
  theme,
  icon,
  onSave,
  step,
  min,
  maxDecimals,
}: {
  token: any;
  theme?: "light" | "dark";
  icon?: React.ComponentType<{ style?: React.CSSProperties }>;
  onSave: (value: string) => void;
  step?: number;
  min?: number;
  maxDecimals?: number;
}) {
  const displayVal = token.value ?? (theme === "dark" && token.darkValue ? token.darkValue : token.lightValue) ?? "";
  const displayName = (token.name || "").replace(/^--/, "");

  return (
    <div>
      <div
        className="text-[10px] font-mono truncate mb-0.5"
        style={{ color: "var(--studio-text-dimmed)" }}
      >
        {displayName}
      </div>
      <ScrubInput
        icon={icon}
        value={displayVal}
        onCommit={onSave}
        step={step}
        min={min}
        maxDecimals={maxDecimals}
      />
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
  spacingDefs,
  cssFilePath,
  stylingType,
  theme,
}: {
  spacingDefs: any[];
  cssFilePath: string;
  stylingType: string;
  theme: "light" | "dark";
}) {
  // Find the base --spacing token (Tailwind v4 pattern)
  const baseToken = spacingDefs.find((s: any) => s.isBase);
  const otherTokens = spacingDefs.filter((s: any) => !s.isBase);
  const baseVal = baseToken?.value || null;
  const parsed = baseVal ? parseSpacingBase(baseVal) : null;
  const selector = stylingType === "tailwind-v4" ? "@theme" : (theme === "dark" ? ".dark" : ":root");

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
            theme={theme}
            icon={SpaceBetweenHorizontallyIcon}
            onSave={(value) => saveSpacing(cssFilePath, baseToken.cssVariable, value, selector)}
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
              theme={theme}
              icon={SpaceBetweenHorizontallyIcon}
              onSave={(value) => saveSpacing(cssFilePath, token.cssVariable, value, selector)}
            />
          ))}
        </div>
      )}

      {/* Derived scale table */}
      {parsed && (
        <div className="px-4">
         
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
// TokenScaleStrip — compact vertical strip for scale tokens (radii, widths)
// ---------------------------------------------------------------------------

/** Inline icon that previews the actual radius on a single corner. */
function RadiusPreviewIcon({ value }: { style?: React.CSSProperties; value: string }) {
  return (
    <div
      style={{
        width: 14,
        height: 14,
        borderTopLeftRadius: value,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        border: "1.5px solid currentColor",
      }}
    />
  );
}

/** Inline icon that previews border thickness as a horizontal line. */
function WidthPreviewIcon({ value }: { style?: React.CSSProperties; value: string }) {
  // Parse to px for the line thickness
  const m = value.match(/^([\d.]+)(rem|px|em)?$/);
  let px = 1;
  if (m) {
    const n = parseFloat(m[1]);
    const unit = m[2] || "px";
    px = unit === "rem" || unit === "em" ? n * 16 : n;
  }
  return (
    <div
      style={{
        width: 12,
        height: Math.max(Math.min(px, 8), 1),
        borderRadius: 0.5,
        background: "currentColor",
      }}
    />
  );
}

function TokenScaleStrip({
  tokens,
  kind,
  onSave,
  step,
  min,
  maxDecimals,
}: {
  tokens: { name: string; value: string }[];
  kind: "radius" | "width";
  onSave: (token: any, value: string) => void;
  step?: number;
  min?: number;
  maxDecimals?: number;
}) {
  // Sort by T-shirt size suffix: xs, sm, md, lg, xl, 2xl, 3xl, …
  const SIZE_ORDER: Record<string, number> = {
    xs: 1, sm: 2, DEFAULT: 3, md: 4, lg: 5, xl: 6,
    "2xl": 7, "3xl": 8, "4xl": 9, "5xl": 10, full: 11,
  };
  const sizeRank = (name: string): number => {
    // Extract suffix after last dash: "radius-2xl" → "2xl", "radius" → "DEFAULT"
    const parts = name.replace(/^--/, "").split("-");
    const suffix = parts.length > 1 ? parts[parts.length - 1] : "DEFAULT";
    return SIZE_ORDER[suffix] ?? 6.5; // unknown suffixes land mid-range
  };
  const sorted = [...tokens].sort((a, b) => sizeRank(a.name) - sizeRank(b.name));

  return (
    <div className="flex flex-col gap-1">
      {sorted.map((token) => {
        const displayName = (token.name || "").replace(/^--/, "");

        const RowIcon = kind === "radius"
          ? (props: { style?: React.CSSProperties }) => <RadiusPreviewIcon {...props} value={token.value} />
          : (props: { style?: React.CSSProperties }) => <WidthPreviewIcon {...props} value={token.value} />;

        return (
          <div key={token.name} className="flex items-center gap-1.5">
            <span
              className="text-[10px] font-mono truncate shrink-0"
              style={{ color: "var(--studio-text-dimmed)", width: 96 }}
            >
              {displayName}
            </span>
            <ScrubInput
              icon={RowIcon}
              value={token.value}
              onCommit={(v) => onSave(token, v)}
              step={step}
              min={min}
              maxDecimals={maxDecimals}
            />
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Radii Section
// ---------------------------------------------------------------------------

function RadiiSection({
  borders,
  theme,
  cssFilePath,
  stylingType,
}: {
  borders: any[];
  theme: "light" | "dark";
  cssFilePath: string;
  stylingType: string;
}) {
  if (borders.length === 0) {
    return <EmptyState message="No radius tokens found." />;
  }

  const selector = stylingType === "tailwind-v4" ? "@theme" : (theme === "dark" ? ".dark" : ":root");

  const handleSave = async (border: any, newValue: string) => {
    const variableName = border.cssVariable || `--${border.name}`;
    const isNew = border.source === "framework-preset" && !border.isOverridden;
    const endpoint = isNew ? "/api/gradients/create" : "/api/gradients";
    await saveBorder(endpoint, { filePath: cssFilePath, variableName, value: newValue, selector });
  };

  return (
    <div className="px-4 pb-2">
      <TokenScaleStrip
        tokens={borders}
        kind="radius"
        onSave={handleSave}
        step={0.025}
        min={0}
        maxDecimals={3}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Borders Section — widths + colors
// ---------------------------------------------------------------------------

function BordersSection({
  widthBorders,
  borderColorTokens,
  theme,
  cssFilePath,
  stylingType,
  allTokens,
  onPreviewToken,
  onClearPreview,
}: {
  widthBorders: any[];
  borderColorTokens: any[];
  theme: "light" | "dark";
  cssFilePath: string;
  stylingType: string;
  allTokens: any[];
  onPreviewToken: (token: string, value: string) => void;
  onClearPreview: () => void;
}) {
  const hasContent = widthBorders.length > 0 || borderColorTokens.length > 0;

  if (!hasContent) {
    return <EmptyState message="No border tokens found." />;
  }

  const selector = stylingType === "tailwind-v4" ? "@theme" : (theme === "dark" ? ".dark" : ":root");

  const handleSave = async (border: any, newValue: string) => {
    const variableName = border.cssVariable || `--${border.name}`;
    const isNew = border.source === "framework-preset" && !border.isOverridden;
    const endpoint = isNew ? "/api/gradients/create" : "/api/gradients";
    await saveBorder(endpoint, { filePath: cssFilePath, variableName, value: newValue, selector });
  };

  return (
    <div className="flex flex-col gap-3 pb-2">
      {/* Border Width subsection */}
      {widthBorders.length > 0 && (
        <div className="px-4">
          <TokenScaleStrip
            tokens={widthBorders}
            kind="width"
            onSave={handleSave}
            min={0}
          />
        </div>
      )}

      {/* Border Color subsection */}
      {borderColorTokens.length > 0 && (
        <div className="px-4">
          <SectionLabel label="Color" />
          <div className="flex flex-col gap-1.5">
            {borderColorTokens.map((token: any) => {
              const value = theme === "dark" && token.darkValue ? token.darkValue : token.lightValue;
              const fgTokenName = token.name.endsWith("-foreground")
                ? token.name.replace("-foreground", "")
                : `${token.name}-foreground`;
              const fgToken = allTokens.find((t: any) => t.name === fgTokenName);
              const fgValue = fgToken
                ? theme === "dark" && fgToken.darkValue ? fgToken.darkValue : fgToken.lightValue
                : null;
              return (
                <ColorInput
                  key={token.name}
                  color={value}
                  label={token.name.replace(/^--/, "")}
                  tabs="custom"
                  tokenName={token.name}
                  contrastToken={fgValue ? { name: fgTokenName, value: fgValue } : null}
                  onChange={(v) => onPreviewToken(token.name, v)}
                  onSave={(oklchValue) => {
                    saveToken(cssFilePath, token.name, oklchValue, selector);
                    onClearPreview();
                  }}
                />
              );
            })}
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
            <ColorInputSwatch
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

