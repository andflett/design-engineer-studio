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
import { Palette, Move, Layers, Square, Sparkles, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { ShadowList } from "./shadow-list.js";
import { ColorInput, ColorInputSwatch } from "./controls/color-input.js";
import { useTokens, useShadows, useBorders, useGradients, useSpacing, useStyling } from "../lib/scan-hooks.js";
import { saveToken, saveGradient, saveBorder, saveSpacing, createToken, deleteToken, deleteBorder } from "../lib/scan-actions.js";
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
    t.category === "color" && (
      ["--border", "--input", "--ring"].includes(t.name) ||
      t.name.startsWith("--border-color")
    )
  );

  const radiusBorders = borderData?.borders?.filter((b: any) => b.kind === "radius") || [];
  const widthBorders = borderData?.borders?.filter((b: any) => b.kind === "width") || [];

  const stylingType = styling?.type || "";
  const selector = theme === "dark" ? ".dark" : (stylingType === "tailwind-v4" ? "@theme" : ":root");

  return (
    <div className="">
      {/* Used by element — only show when relevant */}
      {referencedTokens.length > 0 && (
        <Section title="Used by selected element" icon={<Sparkles size={12} />} count={referencedTokens.length} defaultCollapsed>
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
              const tokenId = token.name.replace(/^--/, "");
              return (
                <div key={token.name} data-testid={`token-row-${tokenId}`}>
                  <ColorInput
                    color={value}
                    label={tokenId}
                    tabs="custom"
                    tokenName={token.name}
                    contrastToken={fgValue ? { name: fgTokenName, value: fgValue } : null}
                    onChange={(v) => onPreviewToken(token.name, v)}
                    onSave={(oklchValue) => {
                      saveToken(cssFilePath, token.name, oklchValue, selector);
                      onClearTokenPreview();
                    }}
                  />
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Colors — always visible */}
      <Section title="Colors" icon={<Palette size={12} />} count={colorTokenGroups.reduce((sum, [_, g]) => sum + (g as any[]).filter(t => t.category === "color").length, 0)} defaultCollapsed>
        <ColorsSection
          colorTokenGroups={colorTokenGroups}
          tokens={tokens}
          theme={theme}
          cssFilePath={cssFilePath}
          selector={selector}
          onPreviewToken={onPreviewToken}
          onClearTokenPreview={onClearTokenPreview}
        />
      </Section>

      {/* Spacing — only for Tailwind projects (base multiplier) */}
      {stylingType.startsWith("tailwind") && <Section title="Spacing" icon={<Move size={12} />} count={spacingDefs.length} defaultCollapsed>
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
      </Section>}

      {/* Shadows — always visible */}
      <Section title="Shadows" icon={<Layers size={12} />} count={shadowData?.shadows?.length || 0} defaultCollapsed>
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
      <Section title="Radii" icon={<CornersIcon />} count={radiusBorders.length} defaultCollapsed>
        <RadiiSection
          borders={radiusBorders}
          theme={theme}
          cssFilePath={borderData?.cssFilePath || cssFilePath}
          stylingType={borderData?.stylingType || stylingType}
        />
      </Section>

      {/* Borders — widths + colors */}
      <Section title="Borders" icon={<Square size={12} />} count={widthBorders.length + borderColorTokens.length} defaultCollapsed>
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
      <Section title="Gradients" icon={<Sparkles size={12} />} count={gradientData?.gradients?.length || 0} defaultCollapsed>
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
  icon,
  count,
  children,
  defaultCollapsed = true,
}: {
  title: string;
  icon?: React.ReactNode;
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
        {icon && <span style={{ opacity: 0.45, display: "flex", alignItems: "center" }}>{icon}</span>}
        <span style={{ flex: 1 }}>{title}</span>
        {count !== undefined && <span className="count">{count}</span>}
        <span style={{ opacity: 0.35, display: "flex", alignItems: "center" }}>
          {collapsed ? <ChevronsUpDown size={11} /> : <ChevronsDownUp size={11} />}
        </span>
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
// suggestNextName — convention-aware auto-naming for new tokens
// ---------------------------------------------------------------------------

export function suggestNextName(existingNames: string[], fallbackPrefix: string): string {
  if (existingNames.length === 0) return `${fallbackPrefix}-1`;

  // Strip -- prefix from names
  const stripped = existingNames.map((n) => n.replace(/^--/, ""));

  // Check if names end with numbers (e.g. space-1, space-2)
  const numericEndings = stripped
    .map((n) => {
      const m = n.match(/-(\d+)$/);
      return m ? parseInt(m[1]) : null;
    })
    .filter((n): n is number => n !== null);

  if (numericEndings.length > 0) {
    // Strip numeric suffix to find the base prefix
    const bases = stripped.map((n) => n.replace(/-\d+$/, ""));
    let prefix = bases[0];
    for (let i = 1; i < bases.length; i++) {
      while (bases[i].indexOf(prefix) !== 0 && prefix.length > 0) {
        prefix = prefix.slice(0, -1);
      }
    }
    prefix = prefix.replace(/-$/, "");
    if (!prefix) prefix = fallbackPrefix;

    const maxNum = Math.max(...numericEndings);
    return `${prefix}-${maxNum + 1}`;
  }

  // Find common prefix among all names
  let prefix = stripped[0];
  for (let i = 1; i < stripped.length; i++) {
    while (stripped[i].indexOf(prefix) !== 0 && prefix.length > 0) {
      prefix = prefix.slice(0, -1);
    }
  }
  // Trim trailing dash from prefix
  prefix = prefix.replace(/-$/, "");
  if (!prefix) prefix = fallbackPrefix;

  // T-shirt sizes or semantic names — suggest prefix with trailing dash for user to complete
  return `${prefix}-`;
}

// ---------------------------------------------------------------------------
// TokenCreator — shared inline creator for new tokens
// ---------------------------------------------------------------------------

function TokenCreator({
  fallbackPrefix,
  existingNames,
  children,
  onSave,
  onCancel,
}: {
  fallbackPrefix: string;
  existingNames: string[];
  children: (value: string, setValue: (v: string) => void) => React.ReactNode;
  onSave: (name: string, value: string) => void;
  onCancel: () => void;
}) {
  const suggestedName = suggestNextName(existingNames, fallbackPrefix);
  const [name, setName] = useState(suggestedName);
  const [value, setValue] = useState("");

  const handleSave = () => {
    const cleanName = name.replace(/^--/, "").replace(/[^a-z0-9-]/g, "-").replace(/-+$/, "");
    if (!cleanName) return;
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
          placeholder={`${fallbackPrefix}-name`}
          autoFocus
        />
      </div>
      <div className="mb-3">
        {children(value, setValue)}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
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
      </div>
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
  const baseVal = baseToken?.value || null;
  const parsed = baseVal ? parseSpacingBase(baseVal) : null;
  const selector = theme === "dark" ? ".dark" : (stylingType === "tailwind-v4" ? "@theme" : ":root");

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
  onDelete,
  step,
  min,
  maxDecimals,
}: {
  tokens: { name: string; value: string }[];
  kind: "radius" | "width";
  onSave: (token: any, value: string) => void;
  onDelete?: (token: any) => void;
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
          <div key={token.name} className="group/scale flex items-center gap-1.5">
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
            {onDelete && (
              <button
                onClick={() => onDelete(token)}
                className="opacity-0 group-hover/scale:opacity-100 transition-opacity"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--studio-text-dimmed)",
                  padding: 2,
                  display: "flex",
                  flexShrink: 0,
                }}
                title="Delete"
              >
                <TrashIcon style={{ width: 10, height: 10 }} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colors Section — with add & delete
// ---------------------------------------------------------------------------

function ColorsSection({
  colorTokenGroups,
  tokens,
  theme,
  cssFilePath,
  selector,
  onPreviewToken,
  onClearTokenPreview,
}: {
  colorTokenGroups: [string, any[]][];
  tokens: any[];
  theme: "light" | "dark";
  cssFilePath: string;
  selector: string;
  onPreviewToken: (token: string, value: string) => void;
  onClearTokenPreview: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const allColorNames = tokens.filter((t) => t.category === "color").map((t) => t.name);

  return (
    <>
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
                    const tokenId = token.name.replace(/^--/, "");
                    return (
                      <div key={token.name} className="group/token flex items-center gap-1" data-testid={`token-row-${tokenId}`}>
                        <div className="flex-1 min-w-0">
                          <ColorInput
                            color={value}
                            label={tokenId}
                            tabs="custom"
                            tokenName={token.name}
                            contrastToken={fgValue ? { name: fgTokenName, value: fgValue } : null}
                            onChange={(v) => onPreviewToken(token.name, v)}
                            onSave={(oklchValue) => {
                              saveToken(cssFilePath, token.name, oklchValue, selector);
                              onClearTokenPreview();
                            }}
                          />
                        </div>
                        <button
                          onClick={() => deleteToken(cssFilePath, token.name, selector)}
                          className="opacity-0 group-hover/token:opacity-100 transition-opacity"
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--studio-text-dimmed)",
                            padding: 2,
                            display: "flex",
                            flexShrink: 0,
                          }}
                          title="Delete token"
                        >
                          <TrashIcon style={{ width: 10, height: 10 }} />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </SubSection>
          ))}
        </div>
      ) : null}

      {/* Add color */}
      <div className="px-4 pt-1">
        {creating ? (
          <TokenCreator
            fallbackPrefix="color"
            existingNames={allColorNames}
            onSave={(name, value) => {
              createToken(cssFilePath, `--${name}`, value || "oklch(0.5 0.15 250)", selector);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          >
            {(value, setValue) => (
              <ColorInput
                color={value || "oklch(0.5 0.15 250)"}
                label="Value"
                tabs="custom"
                onChange={(v) => setValue(v)}
                onSave={(v) => setValue(v)}
              />
            )}
          </TokenCreator>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="studio-addable-row w-full"
            style={{ justifyContent: "center", gap: 6 }}
          >
            <PlusIcon style={{ width: 12, height: 12 }} />
            <span className="text-[11px]" style={{ color: "var(--studio-text-dimmed)" }}>
              Add color
            </span>
          </button>
        )}
      </div>

      {colorTokenGroups.length === 0 && !creating && (
        <EmptyState message="No color tokens found in your CSS." />
      )}
    </>
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
  const [creating, setCreating] = useState(false);
  const selector = theme === "dark" ? ".dark" : (stylingType === "tailwind-v4" ? "@theme" : ":root");

  const handleSave = async (border: any, newValue: string) => {
    const variableName = border.cssVariable || `--${border.name}`;
    const isNew = border.source === "framework-preset" && !border.isOverridden;
    const endpoint = isNew ? "/api/gradients/create" : "/api/gradients";
    await saveBorder(endpoint, { filePath: cssFilePath, variableName, value: newValue, selector });
  };

  const handleDelete = async (border: any) => {
    const variableName = border.cssVariable || `--${border.name}`;
    await deleteBorder(cssFilePath, variableName, selector);
  };

  return (
    <div className="px-4 pb-2">
      {borders.length > 0 && (
        <TokenScaleStrip
          tokens={borders}
          kind="radius"
          onSave={handleSave}
          onDelete={handleDelete}
          step={0.025}
          min={0}
          maxDecimals={3}
        />
      )}

      {/* Add radius */}
      <div className="pt-1">
        {creating ? (
          <TokenCreator
            fallbackPrefix="radius"
            existingNames={borders.map((b) => b.name)}
            onSave={(name, value) => {
              saveBorder("/api/gradients/create", {
                filePath: cssFilePath,
                variableName: `--${name}`,
                value: value || "0.5rem",
                selector,
              });
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          >
            {(value, setValue) => (
              <ScrubInput
                icon={(props) => <RadiusPreviewIcon {...props} value={value || "0.5rem"} />}
                value={value || "0.5rem"}
                onCommit={setValue}
                step={0.025}
                min={0}
                maxDecimals={3}
              />
            )}
          </TokenCreator>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="studio-addable-row w-full"
            style={{ justifyContent: "center", gap: 6 }}
          >
            <PlusIcon style={{ width: 12, height: 12 }} />
            <span className="text-[11px]" style={{ color: "var(--studio-text-dimmed)" }}>
              Add radius
            </span>
          </button>
        )}
      </div>

      {borders.length === 0 && !creating && (
        <EmptyState message="No radius tokens found." />
      )}
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
  const [creatingWidth, setCreatingWidth] = useState(false);
  const [creatingColor, setCreatingColor] = useState(false);
  const selector = theme === "dark" ? ".dark" : (stylingType === "tailwind-v4" ? "@theme" : ":root");

  const handleSave = async (border: any, newValue: string) => {
    const variableName = border.cssVariable || `--${border.name}`;
    const isNew = border.source === "framework-preset" && !border.isOverridden;
    const endpoint = isNew ? "/api/gradients/create" : "/api/gradients";
    await saveBorder(endpoint, { filePath: cssFilePath, variableName, value: newValue, selector });
  };

  const handleDeleteWidth = async (border: any) => {
    const variableName = border.cssVariable || `--${border.name}`;
    await deleteBorder(cssFilePath, variableName, selector);
  };

  return (
    <div className="flex flex-col gap-3 pb-2">
      {/* Border Width subsection */}
      <div className="px-4">
        {widthBorders.length > 0 && (
          <TokenScaleStrip
            tokens={widthBorders}
            kind="width"
            onSave={handleSave}
            onDelete={handleDeleteWidth}
            min={0}
          />
        )}

        {/* Add border width */}
        <div className="pt-1">
          {creatingWidth ? (
            <TokenCreator
              fallbackPrefix="border-width"
              existingNames={widthBorders.map((b) => b.name)}
              onSave={(name, value) => {
                saveBorder("/api/gradients/create", {
                  filePath: cssFilePath,
                  variableName: `--${name}`,
                  value: value || "1px",
                  selector,
                });
                setCreatingWidth(false);
              }}
              onCancel={() => setCreatingWidth(false)}
            >
              {(value, setValue) => (
                <ScrubInput
                  icon={(props) => <WidthPreviewIcon {...props} value={value || "1px"} />}
                  value={value || "1px"}
                  onCommit={setValue}
                  min={0}
                />
              )}
            </TokenCreator>
          ) : (
            <button
              onClick={() => setCreatingWidth(true)}
              className="studio-addable-row w-full"
              style={{ justifyContent: "center", gap: 6 }}
            >
              <PlusIcon style={{ width: 12, height: 12 }} />
              <span className="text-[11px]" style={{ color: "var(--studio-text-dimmed)" }}>
                Add border width
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Border Color subsection */}
      <div className="px-4">
        {borderColorTokens.length > 0 && (
          <>
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
                  <div key={token.name} className="group/bcolor flex items-center gap-1">
                    <div className="flex-1 min-w-0">
                      <ColorInput
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
                    </div>
                    <button
                      onClick={() => deleteToken(cssFilePath, token.name, selector)}
                      className="opacity-0 group-hover/bcolor:opacity-100 transition-opacity"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--studio-text-dimmed)",
                        padding: 2,
                        display: "flex",
                        flexShrink: 0,
                      }}
                      title="Delete token"
                    >
                      <TrashIcon style={{ width: 10, height: 10 }} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Add border color */}
        <div className="pt-1">
          {creatingColor ? (
            <TokenCreator
              fallbackPrefix="border-color"
              existingNames={borderColorTokens.map((t: any) => t.name)}
              onSave={(name, value) => {
                createToken(cssFilePath, `--${name}`, value || "oklch(0.8 0 0)", selector);
                setCreatingColor(false);
              }}
              onCancel={() => setCreatingColor(false)}
            >
              {(value, setValue) => (
                <ColorInput
                  color={value || "oklch(0.8 0 0)"}
                  label="Value"
                  tabs="custom"
                  onChange={(v) => setValue(v)}
                  onSave={(v) => setValue(v)}
                />
              )}
            </TokenCreator>
          ) : (
            <button
              onClick={() => setCreatingColor(true)}
              className="studio-addable-row w-full"
              style={{ justifyContent: "center", gap: 6 }}
            >
              <PlusIcon style={{ width: 12, height: 12 }} />
              <span className="text-[11px]" style={{ color: "var(--studio-text-dimmed)" }}>
                Add border color
              </span>
            </button>
          )}
        </div>
      </div>
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

