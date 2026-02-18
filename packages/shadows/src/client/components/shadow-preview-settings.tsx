export interface PreviewSettings {
  previewBg: string;
  showBorder: boolean;
  borderColor: string;
}

export const DEFAULT_PREVIEW_SETTINGS: PreviewSettings = {
  previewBg: "rgb(240, 244, 250)",
  showBorder: false,
  borderColor: "#e0e0e0",
};

const BG_SWATCHES = [
  { name: "Soft Blue", value: "rgb(240, 244, 250)" },
  { name: "White", value: "white" },
  { name: "Light Gray", value: "#f0f0f0" },
  { name: "Gray", value: "#e0e0e0" },
  { name: "Mid Gray", value: "#d0d0d0" },
  { name: "Dark Gray", value: "#bbb" },
];

const BORDER_COLORS = [
  { name: "Light", value: "#e0e0e0" },
  { name: "Medium", value: "#ccc" },
  { name: "Dark", value: "#bbb" },
  { name: "Darker", value: "#999" },
];

interface ShadowPreviewSettingsProps {
  settings: PreviewSettings;
  onChange: (settings: PreviewSettings) => void;
}

export function ShadowPreviewSettings({
  settings,
  onChange,
}: ShadowPreviewSettingsProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {/* Background row */}
      <div className="flex items-center gap-2">
        <span
          className="text-[9px] font-semibold uppercase tracking-wide shrink-0"
          style={{ color: "var(--studio-text-dimmed)", width: 68 }}
        >
          Background
        </span>
        <div className="flex gap-1">
          {BG_SWATCHES.map((bg) => (
            <button
              key={bg.value}
              onClick={() => onChange({ ...settings, previewBg: bg.value })}
              className="shrink-0 cursor-pointer"
              title={bg.name}
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                background: bg.value,
                border:
                  settings.previewBg === bg.value
                    ? "2px solid var(--studio-accent)"
                    : "1px solid var(--studio-border)",
                outline:
                  settings.previewBg === bg.value
                    ? "1px solid var(--studio-accent)"
                    : "none",
                outlineOffset: 1,
              }}
            />
          ))}
        </div>
      </div>

      {/* Border toggle row */}
      <div className="flex items-center gap-2">
        <span
          className="text-[9px] font-semibold uppercase tracking-wide shrink-0"
          style={{ color: "var(--studio-text-dimmed)", width: 68 }}
        >
          Borders
        </span>
        <button
          onClick={() =>
            onChange({ ...settings, showBorder: !settings.showBorder })
          }
          className="shrink-0 cursor-pointer"
          style={{
            width: 32,
            height: 18,
            borderRadius: 9,
            border: "1px solid var(--studio-border)",
            background: settings.showBorder
              ? "var(--studio-accent)"
              : "var(--studio-input-bg)",
            position: "relative",
            transition: "background 0.15s",
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "white",
              position: "absolute",
              top: 2,
              left: settings.showBorder ? 16 : 2,
              transition: "left 0.15s",
              boxShadow: "0 1px 2px rgb(0 0 0 / 0.15)",
            }}
          />
        </button>
        {settings.showBorder && (
          <div className="flex gap-1 ml-1">
            {BORDER_COLORS.map((bc) => (
              <button
                key={bc.value}
                onClick={() =>
                  onChange({ ...settings, borderColor: bc.value })
                }
                className="shrink-0 cursor-pointer"
                title={bc.name}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  background: bc.value,
                  border:
                    settings.borderColor === bc.value
                      ? "2px solid var(--studio-accent)"
                      : "1px solid var(--studio-border)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
