import type { ReactNode } from "react";
import { Tooltip } from "../tooltip.js";

export function PropLabel({
  label,
  inherited,
  noMargin,
}: {
  label: string;
  inherited?: boolean;
  noMargin?: boolean;
}) {
  return (
    <div
      className={`text-[10px] font-medium ${noMargin ? "" : "mb-1.5"}`}
      style={{
        color: "var(--studio-text-dimmed)",
        letterSpacing: "0.03em",
      }}
    >
      {label}
      {inherited && (
        <span
          className="ml-1 text-[10px] italic"
          style={{ color: "var(--studio-text-dimmed)" }}
        >
          inherited
        </span>
      )}
    </div>
  );
}

export function PropLabelWithToggle({
  label,
  expanded,
  onToggle,
  tooltip,
  icon,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  tooltip: { collapsed: string; expanded: string };
  icon: { collapsed: ReactNode; expanded: ReactNode };
}) {
  return (
    <div className="flex items-center justify-between">
      <PropLabel label={label} noMargin />
      <Tooltip content={expanded ? tooltip.expanded : tooltip.collapsed}>
        <button
          onClick={onToggle}
          className="studio-icon-btn"
          style={{ width: 20, height: 20 }}
        >
          {expanded ? icon.expanded : icon.collapsed}
        </button>
      </Tooltip>
    </div>
  );
}

export function SubSectionLabel({ label }: { label: string }) {
  return (
    <div
      className="text-[10px] font-medium tracking-wide mt-1 mb-1"
      style={{ color: "var(--studio-text-muted)" }}
    >
      {label}
    </div>
  );
}
