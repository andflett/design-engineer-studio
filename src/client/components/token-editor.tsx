import { useState, useRef } from "react";
import {
  ChevronRightIcon,
  ChevronDownIcon,
} from "@radix-ui/react-icons";
import type { ScanData } from "../app.js";
import { TokenPopover } from "./color-popover.js";

interface TokenEditorProps {
  tokenRefs: string[];
  scanData: ScanData | null;
  theme: "light" | "dark";
  onPreviewToken: (token: string, value: string) => void;
}

export function TokenEditor({
  tokenRefs,
  scanData,
  theme,
  onPreviewToken,
}: TokenEditorProps) {
  if (!scanData) {
    return (
      <div
        className="px-4 py-3 text-[11px]"
        style={{ color: "var(--studio-text-dimmed)" }}
      >
        Loading tokens...
      </div>
    );
  }

  const tokens = scanData.tokens.tokens;
  const cssFilePath = scanData.tokens.cssFilePath;

  const referencedTokens = tokens.filter((t: any) =>
    tokenRefs.includes(t.name)
  );
  const colorTokenGroups = Object.entries(scanData.tokens.groups)
    .filter(([_, tokens]) => (tokens as any[]).some((t) => t.category === "color"))
    .slice(0, 8);

  const radiusTokens = tokens.filter((t: any) => t.category === "radius");
  const spacingTokens = tokens.filter((t: any) => t.category === "spacing");

  return (
    <div className="">
      {referencedTokens.length > 0 && (
        <Section title="Used by element" count={referencedTokens.length}>
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

      {radiusTokens.length > 0 && (
        <Section title="Radius" count={radiusTokens.length} defaultCollapsed>
          {radiusTokens.map((token: any) => (
            <RadiusTokenRow
              key={token.name}
              token={token}
              onSave={(value) => handleTokenSave(cssFilePath, token.name, value, theme === "dark" ? ".dark" : ":root")}
            />
          ))}
        </Section>
      )}

      {spacingTokens.length > 0 && (
        <Section title="Spacing" count={spacingTokens.length} defaultCollapsed>
          {spacingTokens.map((token: any) => (
            <SpacingTokenRow
              key={token.name}
              token={token}
              onSave={(value) => handleTokenSave(cssFilePath, token.name, value, theme === "dark" ? ".dark" : ":root")}
            />
          ))}
        </Section>
      )}

      {colorTokenGroups.map(([groupName, groupTokens]) => (
        <Section key={groupName} title={groupName} count={(groupTokens as any[]).filter(t => t.category === "color").length} defaultCollapsed>
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
        </Section>
      ))}
    </div>
  );
}

function Section({
  title,
  count,
  children,
  defaultCollapsed = false,
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
      {!collapsed && <div className="pb-1">{children}</div>}
    </div>
  );
}

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

  // Find contrast pair
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

function RadiusTokenRow({
  token,
  onSave,
}: {
  token: any;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(token.lightValue);

  return (
    <div className="studio-prop-row">
      <div
        className="w-5 h-5 border shrink-0"
        style={{
          borderColor: "var(--studio-text-dimmed)",
          borderRadius: value,
        }}
      />
      <span
        className="flex-1 text-[11px] font-mono truncate"
        style={{ color: "var(--studio-text)" }}
      >
        {token.name.replace(/^--/, "")}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onSave(value)}
        className="studio-input w-14 text-right"
      />
    </div>
  );
}

function SpacingTokenRow({
  token,
  onSave,
}: {
  token: any;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(token.lightValue);

  return (
    <div className="studio-prop-row">
      <span
        className="flex-1 text-[11px] font-mono truncate"
        style={{ color: "var(--studio-text)" }}
      >
        {token.name.replace(/^--/, "")}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onSave(value)}
        className="studio-input w-16 text-right"
      />
    </div>
  );
}

async function handleTokenSave(
  cssFilePath: string,
  token: string,
  value: string,
  selector: string
) {
  try {
    const res = await fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath: cssFilePath, token, value, selector }),
    });
    const data = await res.json();
    if (!data.ok) console.error("Token save failed:", data.error);
  } catch (err) {
    console.error("Token save error:", err);
  }
}
