import * as Switch from "@radix-ui/react-switch";
import { Tooltip } from "../tooltip.js";

interface ToggleControlProps {
  value: boolean;
  onChange: (value: boolean) => void;
  /** Label shown next to the toggle */
  label?: string;
  /** Icon rendered in left gutter */
  icon?: React.ComponentType<{ style?: React.CSSProperties }>;
  /** Tooltip shown on icon hover */
  tooltip?: string;
}

export function ToggleControl({
  value,
  onChange,
  label,
  icon: Icon,
  tooltip,
}: ToggleControlProps) {
  const toggle = (
    <Switch.Root
      checked={value}
      onCheckedChange={onChange}
      className="studio-toggle-root"
    >
      <Switch.Thumb className="studio-toggle-thumb" />
    </Switch.Root>
  );

  return (
    <div className="studio-scrub-input" style={{ gap: 0 }}>
      {Icon && (
        <Tooltip content={tooltip || ""} side="left">
          <div className="studio-scrub-icon no-scrub">
            <Icon style={{ width: 12, height: 12 }} />
          </div>
        </Tooltip>
      )}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 8px",
          minWidth: 0,
        }}
      >
        {label && (
          <span
            style={{
              fontSize: 11,
              color: "var(--studio-text)",
              userSelect: "none",
            }}
          >
            {label}
          </span>
        )}
        {toggle}
      </div>
    </div>
  );
}
