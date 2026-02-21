/**
 * Token overview panel shown when no element is selected.
 * Displays the project's design tokens (colors, spacing, etc.)
 * grouped by category from the /api/scan endpoint.
 */
import { useState } from "react";
import { ChevronDownIcon } from "@radix-ui/react-icons";

interface TokenOverviewProps {
  tokenGroups: Record<string, any[]>;
  stylingType: string;
}

function TokenGroup({ name, tokens }: { name: string; tokens: any[] }) {
  const [open, setOpen] = useState(true);
  const colorTokens = tokens.filter((t) => t.category === "color");
  const otherTokens = tokens.filter((t) => t.category !== "color");

  if (tokens.length === 0) return null;

  return (
    <div style={{ borderTop: "1px solid var(--studio-border-subtle, var(--studio-border))" }}>
      <button className="studio-section-hdr" onClick={() => setOpen(!open)}>
        <ChevronDownIcon style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform 0.15s" }} />
        {name}
        <span className="count">{tokens.length}</span>
      </button>
      {open && (
        <div className="pb-2">
          {/* Color tokens as swatch grid */}
          {colorTokens.length > 0 && (
            <div className="px-4 flex flex-wrap gap-1.5 mb-2">
              {colorTokens.map((token) => (
                <div key={token.name} className="flex flex-col items-center gap-0.5">
                  <span
                    className="studio-swatch"
                    style={{
                      "--swatch-color": token.lightValue || token.darkValue || "",
                      width: 28,
                      height: 28,
                      borderRadius: 4,
                    } as React.CSSProperties}
                    title={`${token.name}\nLight: ${token.lightValue || "—"}\nDark: ${token.darkValue || "—"}`}
                  />
                  <span
                    className="text-[8px] truncate text-center"
                    style={{ color: "var(--studio-text-dimmed)", maxWidth: 36 }}
                    title={token.name}
                  >
                    {token.name.replace(/^--/, "")}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Non-color tokens as rows */}
          {otherTokens.map((token) => (
            <div key={token.name} className="studio-prop-row">
              <span className="studio-prop-label" title={token.name}>
                {token.name.replace(/^--/, "")}
              </span>
              <span
                className="text-[11px] truncate"
                style={{
                  color: "var(--studio-text)",
                  fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
                }}
                title={token.lightValue}
              >
                {token.lightValue || token.darkValue || "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TokenOverview({ tokenGroups, stylingType }: TokenOverviewProps) {
  const groupNames = Object.keys(tokenGroups);
  const totalTokens = Object.values(tokenGroups).reduce((sum, g) => sum + g.length, 0);

  return (
    <div
      className="overflow-y-auto studio-scrollbar"
      style={{
        width: 280,
        minWidth: 280,
        background: "var(--studio-surface)",
        borderLeft: "1px solid var(--studio-border)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: "var(--studio-border)" }}
      >
        <div
          className="text-[13px] font-semibold mb-1"
          style={{ color: "var(--studio-text)" }}
        >
          Design Tokens
        </div>
        <div
          className="text-[10px]"
          style={{ color: "var(--studio-text-dimmed)" }}
        >
          {totalTokens} tokens &middot; {stylingType}
        </div>
      </div>

      {totalTokens === 0 ? (
        <div
          className="px-4 py-6 text-center"
          style={{ color: "var(--studio-text-dimmed)", fontSize: 11 }}
        >
          <div className="mb-2">No design tokens found</div>
          <div className="text-[10px]">
            Select an element in the viewport to inspect its styles
          </div>
        </div>
      ) : (
        groupNames.map((name) => (
          <TokenGroup
            key={name}
            name={name}
            tokens={tokenGroups[name]}
          />
        ))
      )}
    </div>
  );
}
