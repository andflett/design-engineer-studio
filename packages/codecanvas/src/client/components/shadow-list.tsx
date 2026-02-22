import { useState } from "react";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  Pencil1Icon,
  BookmarkIcon,
  CheckIcon,
} from "@radix-ui/react-icons";
import { ShadowControls } from "./shadow-controls.js";
import { ShadowPreview } from "./shadow-preview.js";

interface ShadowListProps {
  shadows: any[];
  cssFilePath: string;
  stylingType: string;
  onPreviewShadow: (variableName: string, value: string, shadowName?: string) => void;
}

export function ShadowList({
  shadows,
  cssFilePath,
  stylingType,
  onPreviewShadow,
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
}: {
  shadow: any;
  isExpanded: boolean;
  onToggle: () => void;
  mode: "custom" | "preset";
  onModeChange: (mode: "custom" | "preset") => void;
  cssFilePath: string;
  stylingType: string;
  onPreviewShadow: (variableName: string, value: string, shadowName?: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [currentValue, setCurrentValue] = useState(shadow.value);

  const handleSave = async (newValue: string) => {
    setCurrentValue(newValue);
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
          value={currentValue}
          size={24}
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
              shadow={{ ...shadow, value: currentValue }}
              onPreview={(value) => {
                const varName = shadow.cssVariable || `--${shadow.name}`;
                onPreviewShadow(varName, value, shadow.name);
              }}
              onSave={handleSave}
            />
          ) : (
            <PresetPicker
              currentValue={currentValue}
              onSelect={(value) => {
                const varName = shadow.cssVariable || `--${shadow.name}`;
                onPreviewShadow(varName, value, shadow.name);
                handleSave(value);
              }}
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
}: {
  currentValue: string;
  onSelect: (value: string) => void;
}) {
  const presets = [
    { name: "Crisp 2L", value: "0px 0.3px 0.7px 0px rgb(0 0 0 / 0.1), 0px 0.7px 2.1px 0px rgb(0 0 0 / 0.07)", desc: "Subtle" },
    { name: "Crisp 2L +", value: "0px 0.5px 1px 0px rgb(0 0 0 / 0.1), 0px 1px 3px 0px rgb(0 0 0 / 0.07), 0px 2px 6px 0px rgb(0 0 0 / 0.07)", desc: "Elevated" },
    { name: "Crisp 3L", value: "0px 1px 1px 0px rgb(0 0 0 / 0.08), 0px 2px 2px 0px rgb(0 0 0 / 0.08), 0px 4px 4px 0px rgb(0 0 0 / 0.08)", desc: "Card" },
    { name: "Crisp 3L +", value: "0px 1px 1px 0px rgb(0 0 0 / 0.08), 0px 2px 2px 0px rgb(0 0 0 / 0.08), 0px 4px 4px 0px rgb(0 0 0 / 0.08), 0px 8px 8px 0px rgb(0 0 0 / 0.08)", desc: "Elevated" },
    { name: "Crisp Tight", value: "0px 0.5px 0.5px 0px rgb(0 0 0 / 0.09), 0px 1px 1.5px 0px rgb(0 0 0 / 0.07), 0px 3px 3px 0px rgb(0 0 0 / 0.06)", desc: "Card" },
    { name: "Crisp Tight +", value: "0px 0.5px 0.5px 0px rgb(0 0 0 / 0.09), 0px 1px 1.5px 0px rgb(0 0 0 / 0.07), 0px 3px 3px 0px rgb(0 0 0 / 0.06), 0px 6px 6px 0px rgb(0 0 0 / 0.06)", desc: "Elevated" },
    { name: "Crisp 4L", value: "0px 0.5px 0.5px 0px rgb(0 0 0 / 0.07), 0px 1px 1px 0px rgb(0 0 0 / 0.06), 0px 2px 2px 0px rgb(0 0 0 / 0.06), 0px 4px 4px 0px rgb(0 0 0 / 0.06)", desc: "Card" },
    { name: "Crisp 4L +", value: "0px 0.5px 0.5px 0px rgb(0 0 0 / 0.07), 0px 1px 1px 0px rgb(0 0 0 / 0.06), 0px 2px 2px 0px rgb(0 0 0 / 0.06), 0px 4px 4px 0px rgb(0 0 0 / 0.06), 0px 8px 8px 0px rgb(0 0 0 / 0.06)", desc: "Elevated" },
    { name: "Edge 4L", value: "0px 0px 0.5px -0.5px rgb(0 0 0 / 0.12), 0px 1px 1px 0px rgb(0 0 0 / 0.06), 0px 2px 2px 0px rgb(0 0 0 / 0.06), 0px 4px 4px 0px rgb(0 0 0 / 0.05)", desc: "Card" },
    { name: "Edge 4L +", value: "0px 0px 0.5px -0.5px rgb(0 0 0 / 0.12), 0px 1px 1px 0px rgb(0 0 0 / 0.06), 0px 2px 2px 0px rgb(0 0 0 / 0.06), 0px 4px 4px 0px rgb(0 0 0 / 0.05), 0px 8px 8px 0px rgb(0 0 0 / 0.05)", desc: "Elevated" },
    { name: "Soft", value: "0px 1px 2px 0px rgb(0 0 0 / 0.04), 0px 2px 4px 0px rgb(0 0 0 / 0.04), 0px 4px 8px 0px rgb(0 0 0 / 0.04)", desc: "Diffuse" },
    { name: "Soft +", value: "0px 1px 2px 0px rgb(0 0 0 / 0.04), 0px 2px 4px 0px rgb(0 0 0 / 0.04), 0px 4px 8px 0px rgb(0 0 0 / 0.04), 0px 8px 16px 0px rgb(0 0 0 / 0.04)", desc: "Elevated" },
    { name: "Chunky", value: "3px 3px 0px 0px rgb(0 0 0 / 0.25)", desc: "Hard" },
    { name: "None", value: "none", desc: "Remove" },
  ];

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: "repeat(2, 1fr)" }}
    >
      {presets.map((preset) => {
        const isActive = currentValue === preset.value;
        return (
          <button
            key={preset.name}
            onClick={() => onSelect(preset.value)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-lg cursor-pointer"
            style={{
              background: isActive
                ? "var(--studio-accent-muted)"
                : "transparent",
              border: "1px solid",
              borderColor: isActive
                ? "var(--studio-accent)"
                : "var(--studio-border-subtle)",
            }}
          >
            <div
              className="flex items-center justify-center rounded-lg w-full"
              style={{
                background: "rgb(240, 244, 250)",
                height: 72,
              }}
            >
              <ShadowPreview
                value={preset.value}
                size={48}
                background="white"
              />
            </div>
            <div className="text-center">
              <div
                className="text-[10px] font-medium"
                style={{ color: "var(--studio-text-muted)" }}
              >
                {preset.name}
              </div>
              {preset.desc && (
                <div
                  className="text-[9px]"
                  style={{ color: "var(--studio-text-dimmed)" }}
                >
                  {preset.desc}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
