import { useState, useEffect } from "react";
import { Tooltip } from "../tooltip.js";

interface SegmentedOption {
  value: string;
  icon?: React.ComponentType<{ style?: React.CSSProperties }>;
  label?: string;
  tooltip?: string;
}

interface SegmentedIconsProps {
  options: SegmentedOption[];
  value: string;
  onChange: (v: string) => void;
}

export function SegmentedIcons({ options, value, onChange }: SegmentedIconsProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className="studio-segmented" style={{ width: "100%" }}>
      {options.map((opt) => (
        <Tooltip key={opt.value} content={opt.tooltip || opt.label || opt.value} side="bottom">
          <button
            onClick={() => {
              setLocalValue(opt.value);
              onChange(opt.value);
            }}
            className={localValue === opt.value ? "active" : ""}
            style={{ flex: 1, cursor: "pointer" }}
          >
            {opt.icon ? (
              <opt.icon style={{ width: 14, height: 14 }} />
            ) : (
              <span style={{ fontSize: 10 }}>{opt.label || opt.value}</span>
            )}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
