import { StudioSelect } from "./select.js";
import { getPropertyIcon } from "./property-icons.js";
import { computedToTailwindClass } from "../../../shared/tailwind-map.js";
import type { UnifiedProperty } from "../../lib/computed-styles.js";

export function getKeywordOptions(property: string): string[] {
  switch (property) {
    case "display":
      return ["block", "inline-block", "inline", "flex", "inline-flex", "grid", "inline-grid", "none"];
    case "position":
      return ["static", "relative", "absolute", "fixed", "sticky"];
    case "flex-direction":
      return ["row", "row-reverse", "column", "column-reverse"];
    case "flex-wrap":
      return ["nowrap", "wrap", "wrap-reverse"];
    case "justify-content":
      return ["flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly"];
    case "align-items":
      return ["flex-start", "flex-end", "center", "baseline", "stretch"];
    case "align-self":
      return ["auto", "flex-start", "flex-end", "center", "stretch"];
    case "overflow":
      return ["visible", "hidden", "scroll", "auto"];
    case "text-align":
      return ["left", "center", "right", "justify"];
    case "text-transform":
      return ["none", "uppercase", "lowercase", "capitalize"];
    case "text-decoration":
      return ["none", "underline", "overline", "line-through"];
    case "white-space":
      return ["normal", "nowrap", "pre", "pre-wrap", "pre-line"];
    default:
      return [];
  }
}

export function KeywordControl({
  prop,
  onPreviewInlineStyle,
  onCommitClass,
}: {
  prop: UnifiedProperty;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onCommitClass: (c: string, oldClass?: string) => void;
}) {
  const options = getKeywordOptions(prop.cssProperty);
  const Icon = getPropertyIcon(prop.cssProperty);

  if (options.length === 0) {
    return (
      <div
        className="text-[11px] font-mono truncate"
        style={{ color: "var(--studio-text)" }}
      >
        {prop.computedValue}
      </div>
    );
  }

  return (
    <StudioSelect
      icon={Icon}
      tooltip={prop.cssProperty}
      value={prop.computedValue}
      onChange={(v) => {
        onPreviewInlineStyle(prop.cssProperty, v);
        const match = computedToTailwindClass(prop.cssProperty, v);
        if (match) onCommitClass(match.tailwindClass);
      }}
      options={[
        ...(!options.includes(prop.computedValue) ? [{ value: prop.computedValue }] : []),
        ...options.map((opt) => ({ value: opt })),
      ]}
    />
  );
}
