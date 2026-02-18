import { useState } from "react";
import { ShadowPreview } from "./shadow-preview.js";
import type { PreviewSettings } from "./shadow-preview-settings.js";

interface ShadowOverviewProps {
  shadows: any[];
  previewSettings: PreviewSettings;
}

export function ShadowOverview({ shadows, previewSettings }: ShadowOverviewProps) {
  const [previewSize, setPreviewSize] = useState(80);

  const containerSize = previewSize + 64;

  return (
    <div>
      {/* Size selector */}
      <div className="px-4 py-2 flex items-center justify-end">
        <select
          value={previewSize}
          onChange={(e) => setPreviewSize(parseInt(e.target.value))}
          className="studio-select"
          style={{ fontSize: 10, width: 50 }}
        >
          <option value={64}>S</option>
          <option value={80}>M</option>
          <option value={112}>L</option>
        </select>
      </div>

      {/* Shadow grid */}
      <div
        className="grid gap-5 px-4 py-3"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${containerSize}px, 1fr))`,
        }}
      >
        {shadows.map((shadow: any) => (
          <div key={shadow.name} className="flex flex-col items-center gap-2">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{
                background: previewSettings.previewBg,
                width: containerSize,
                height: containerSize,
              }}
            >
              <ShadowPreview
                value={shadow.value}
                size={previewSize}
                background="white"
                showBorder={previewSettings.showBorder}
                borderColor={previewSettings.borderColor}
              />
            </div>
            <span
              className="text-[9px] font-mono text-center truncate w-full"
              style={{ color: "var(--studio-text-muted)" }}
            >
              {shadow.name}
            </span>
          </div>
        ))}
      </div>

      {shadows.length === 0 && (
        <div
          className="px-4 py-6 text-center text-[11px]"
          style={{ color: "var(--studio-text-dimmed)" }}
        >
          No shadows to display
        </div>
      )}
    </div>
  );
}
