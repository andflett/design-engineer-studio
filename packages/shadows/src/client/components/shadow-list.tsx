import { useState, useRef } from "react";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  Pencil1Icon,
  BookmarkIcon,
  CheckIcon,
} from "@radix-ui/react-icons";
import { ShadowControls } from "./shadow-controls.js";
import { ShadowPreview } from "./shadow-preview.js";
import type { PreviewSettings } from "./shadow-preview-settings.js";

interface ShadowListProps {
  shadows: any[];
  cssFilePath: string;
  stylingType: string;
  onPreviewShadow: (variableName: string, value: string) => void;
  previewSettings: PreviewSettings;
}

export function ShadowList({
  shadows,
  cssFilePath,
  stylingType,
  onPreviewShadow,
  previewSettings,
}: ShadowListProps) {
  const [expandedShadow, setExpandedShadow] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<Record<string, "custom" | "preset">>({});

  return (
    <div>
      {shadows.map((shadow: any) => (
        <ShadowRow
          key={shadow.name}
          shadow={shadow}
          isExpanded={expandedShadow === shadow.name}
          onToggle={() =>
            setExpandedShadow(
              expandedShadow === shadow.name ? null : shadow.name
            )
          }
          mode={editMode[shadow.name] || "custom"}
          onModeChange={(mode) =>
            setEditMode({ ...editMode, [shadow.name]: mode })
          }
          cssFilePath={cssFilePath}
          stylingType={stylingType}
          onPreviewShadow={onPreviewShadow}
          previewSettings={previewSettings}
        />
      ))}

      {shadows.length === 0 && (
        <div
          className="px-4 py-6 text-center text-[11px]"
          style={{ color: "var(--studio-text-dimmed)" }}
        >
          No shadows found. Add shadow CSS variables to your global CSS file.
        </div>
      )}
    </div>
  );
}

function ShadowRow({
  shadow,
  isExpanded,
  onToggle,
  mode,
  onModeChange,
  cssFilePath,
  stylingType,
  onPreviewShadow,
  previewSettings,
}: {
  shadow: any;
  isExpanded: boolean;
  onToggle: () => void;
  mode: "custom" | "preset";
  onModeChange: (mode: "custom" | "preset") => void;
  cssFilePath: string;
  stylingType: string;
  onPreviewShadow: (variableName: string, value: string) => void;
  previewSettings: PreviewSettings;
}) {
  const [saving, setSaving] = useState(false);

  const handleSave = async (newValue: string) => {
    setSaving(true);
    try {
      // Design token shadows write to their own endpoint
      if (shadow.source === "design-token" && shadow.tokenFilePath && shadow.tokenPath) {
        const res = await fetch("/api/shadows/design-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filePath: shadow.tokenFilePath,
            tokenPath: shadow.tokenPath,
            value: newValue,
          }),
        });
        const data = await res.json();
        if (!data.ok) console.error("Design token save failed:", data.error);
      } else {
        // CSS/SCSS shadow writes
        const variableName = shadow.sassVariable || shadow.cssVariable || `--${shadow.name}`;
        let selector: string;
        let filePath = cssFilePath;

        if (stylingType === "tailwind-v4") {
          selector = "@theme";
        } else if (stylingType === "bootstrap" && shadow.sassVariable) {
          selector = "scss";
          // Use the SCSS file if available, fall back to CSS file
          filePath = shadow.filePath || cssFilePath;
        } else {
          selector = ":root";
        }

        const endpoint = shadow.isOverridden ? "/api/shadows" : "/api/shadows/create";
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filePath,
            variableName,
            value: newValue,
            selector,
          }),
        });
        const data = await res.json();
        if (!data.ok) console.error("Shadow save failed:", data.error);
      }
    } catch (err) {
      console.error("Shadow save error:", err);
    }
    setTimeout(() => setSaving(false), 1000);
  };

  return (
    <div style={{ borderTop: "1px solid var(--studio-border-subtle)" }}>
      <button
        onClick={onToggle}
        className="studio-section-hdr"
        style={{ gap: 8 }}
      >
        {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
        <ShadowPreview
          value={shadow.value}
          size={24}
          showBorder={previewSettings.showBorder}
          borderColor={previewSettings.borderColor}
        />
        <span
          className="flex-1 text-[11px] font-mono truncate text-left"
          style={{
            color: "var(--studio-text)",
            fontWeight: 500,
            textTransform: "none",
            letterSpacing: 0,
          }}
        >
          {shadow.name}
        </span>
        {shadow.source === "framework-preset" && !shadow.isOverridden && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded"
            style={{
              background: "var(--studio-input-bg)",
              color: "var(--studio-text-dimmed)",
            }}
          >
            preset
          </span>
        )}
        {shadow.source === "design-token" && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded"
            style={{
              background: "var(--studio-input-bg)",
              color: "var(--studio-text-dimmed)",
            }}
          >
            token
          </span>
        )}
        {saving && (
          <span
            className="flex items-center gap-0.5 text-[10px]"
            style={{ color: "var(--studio-success)" }}
          >
            <CheckIcon style={{ width: 10, height: 10 }} />
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-3">
          {/* Edit mode toggle */}
          <div className="studio-segmented mb-3" style={{ width: "100%" }}>
            <button
              onClick={() => onModeChange("custom")}
              className={mode === "custom" ? "active" : ""}
              style={{ flex: 1 }}
            >
              <Pencil1Icon style={{ width: 12, height: 12 }} />
              Custom
            </button>
            <button
              onClick={() => onModeChange("preset")}
              className={mode === "preset" ? "active" : ""}
              style={{ flex: 1 }}
            >
              <BookmarkIcon style={{ width: 12, height: 12 }} />
              Use Preset
            </button>
          </div>

          {mode === "custom" ? (
            <ShadowControls
              shadow={shadow}
              onPreview={(value) => {
                const varName = shadow.cssVariable || `--${shadow.name}`;
                onPreviewShadow(varName, value);
              }}
              onSave={handleSave}
              previewSettings={previewSettings}
            />
          ) : (
            <PresetPicker
              currentValue={shadow.value}
              onSelect={(value) => {
                const varName = shadow.cssVariable || `--${shadow.name}`;
                onPreviewShadow(varName, value);
                handleSave(value);
              }}
              previewSettings={previewSettings}
            />
          )}
        </div>
      )}
    </div>
  );
}

function PresetPicker({
  currentValue,
  onSelect,
  previewSettings,
}: {
  currentValue: string;
  onSelect: (value: string) => void;
  previewSettings: PreviewSettings;
}) {
  // Import presets inline to avoid circular deps
  const presets = [
    { name: "Soft Small", value: "0 1px 2px 0 rgb(0 0 0 / 0.03), 0 1px 3px 0 rgb(0 0 0 / 0.06)", category: "subtle" },
    { name: "Soft Medium", value: "0 2px 8px -2px rgb(0 0 0 / 0.05), 0 4px 12px -2px rgb(0 0 0 / 0.08)", category: "subtle" },
    { name: "Soft Large", value: "0 4px 16px -4px rgb(0 0 0 / 0.08), 0 8px 24px -4px rgb(0 0 0 / 0.1)", category: "subtle" },
    { name: "Card", value: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)", category: "medium" },
    { name: "Dropdown", value: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)", category: "medium" },
    { name: "Modal", value: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)", category: "medium" },
    { name: "Elevated", value: "0 25px 50px -12px rgb(0 0 0 / 0.25)", category: "dramatic" },
    { name: "Floating", value: "0 20px 60px -15px rgb(0 0 0 / 0.3)", category: "dramatic" },
    { name: "Layered Small", value: "0 1px 1px rgb(0 0 0 / 0.04), 0 2px 2px rgb(0 0 0 / 0.04), 0 4px 4px rgb(0 0 0 / 0.04)", category: "layered" },
    { name: "Layered Medium", value: "0 1px 1px rgb(0 0 0 / 0.03), 0 2px 2px rgb(0 0 0 / 0.03), 0 4px 4px rgb(0 0 0 / 0.03), 0 8px 8px rgb(0 0 0 / 0.03), 0 16px 16px rgb(0 0 0 / 0.03)", category: "layered" },
    { name: "Blue Glow", value: "0 4px 14px 0 rgb(59 130 246 / 0.3)", category: "colored" },
    { name: "Purple Glow", value: "0 4px 14px 0 rgb(147 51 234 / 0.3)", category: "colored" },
    { name: "None", value: "none", category: "reset" },
  ];

  const categories = ["subtle", "medium", "dramatic", "layered", "colored", "reset"];
  const categoryLabels: Record<string, string> = {
    subtle: "Subtle",
    medium: "Medium",
    dramatic: "Dramatic",
    layered: "Layered",
    colored: "Colored",
    reset: "Reset",
  };

  return (
    <div className="flex flex-col gap-2">
      {categories.map((cat) => {
        const catPresets = presets.filter((p) => p.category === cat);
        if (catPresets.length === 0) return null;
        return (
          <div key={cat}>
            <div
              className="text-[9px] font-semibold uppercase tracking-wide mb-1"
              style={{ color: "var(--studio-text-dimmed)" }}
            >
              {categoryLabels[cat]}
            </div>
            <div className="flex flex-col gap-1">
              {catPresets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => onSelect(preset.value)}
                  className="flex items-center gap-2 p-1.5 rounded text-left w-full"
                  style={{
                    background:
                      currentValue === preset.value
                        ? "var(--studio-accent-muted)"
                        : "transparent",
                    border: "1px solid",
                    borderColor:
                      currentValue === preset.value
                        ? "var(--studio-accent)"
                        : "var(--studio-border-subtle)",
                    cursor: "pointer",
                  }}
                >
                  <ShadowPreview
                    value={preset.value}
                    size={32}
                    showBorder={previewSettings.showBorder}
                    borderColor={previewSettings.borderColor}
                  />
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--studio-text)" }}
                  >
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
