import { useState } from "react";
import {
  CornersIcon,
  CornerTopLeftIcon,
  CornerTopRightIcon,
  CornerBottomLeftIcon,
  CornerBottomRightIcon,
} from "@radix-ui/react-icons";
import { ScaleInput } from "./scale-input.js";
import { PropLabelWithToggle } from "./prop-label.js";
import {
  getUniformBoxValue,
  type UnifiedProperty,
} from "../../lib/computed-styles.js";

const CORNERS = [
  { side: "top-left", label: "TL", prefix: "rounded-tl", cssProp: "border-top-left-radius", icon: CornerTopLeftIcon },
  { side: "top-right", label: "TR", prefix: "rounded-tr", cssProp: "border-top-right-radius", icon: CornerTopRightIcon },
  { side: "bottom-left", label: "BL", prefix: "rounded-bl", cssProp: "border-bottom-left-radius", icon: CornerBottomLeftIcon },
  { side: "bottom-right", label: "BR", prefix: "rounded-br", cssProp: "border-bottom-right-radius", icon: CornerBottomRightIcon },
] as const;

export function BoxRadiusControl({
  activeProps,
  allProperties,
  computedStyles,
  onPreviewInlineStyle,
  onCommitClass,
  onCommitStyle,
  radiusScale,
}: {
  activeProps: UnifiedProperty[];
  allProperties: UnifiedProperty[];
  computedStyles: Record<string, string>;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onCommitClass: (c: string, oldClass?: string) => void;
  onCommitStyle?: (cssProp: string, cssValue: string) => void;
  radiusScale?: readonly string[];
}) {
  const [expanded, setExpanded] = useState(false);

  const uniform = getUniformBoxValue(computedStyles, "border-radius");

  const findProp = (cssProp: string) =>
    allProperties.find((p) => p.cssProperty === cssProp);

  return (
    <div className="space-y-1.5">
      <PropLabelWithToggle
        label="Radius"
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
        tooltip={{ collapsed: "Per-corner radius", expanded: "Single radius" }}
        icon={{
          collapsed: <CornersIcon style={{ width: 12, height: 12 }} />,
          expanded: <CornerTopLeftIcon style={{ width: 12, height: 12 }} />,
        }}
      />
      {!expanded ? (
        <ScaleInput
          icon={CornersIcon}
          value={
            activeProps[0]?.tailwindValue ||
            (uniform === "0px" || uniform === "0" || !uniform
              ? "—"
              : uniform)
          }
          computedValue={uniform || "0"}
          currentClass={activeProps[0]?.fullClass || null}
          scale={(radiusScale ?? []) as string[]}
          prefix="rounded"
          cssProp="border-radius"
          onPreview={(v) => onPreviewInlineStyle("border-radius", v)}
          onCommitClass={onCommitClass}
          onCommitStyle={onCommitStyle ? (v) => onCommitStyle("border-radius", v) : undefined}
        />
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {CORNERS.map(({ cssProp, label, prefix, icon }) => {
            const prop = findProp(cssProp);
            const cv = prop?.computedValue || "0";
            return (
              <ScaleInput
                key={cssProp}
                icon={icon}
                label={label}
                value={prop?.tailwindValue || (cv === "0px" || cv === "0" ? "—" : cv)}
                computedValue={cv}
                currentClass={prop?.fullClass || null}
                scale={(radiusScale ?? []) as string[]}
                prefix={prefix}
                cssProp={cssProp}
                onPreview={(v) => onPreviewInlineStyle(cssProp, v)}
                onCommitClass={onCommitClass}
                onCommitStyle={onCommitStyle ? (v) => onCommitStyle(cssProp, v) : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
