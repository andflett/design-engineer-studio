import { useState } from "react";
import { BoxModelIcon } from "@radix-ui/react-icons";
import { Tooltip } from "../tooltip.js";
import { ScrubInput } from "./scrub-input.js";
import { ScaleInput } from "./scale-input.js";
import { PropLabel, SubSectionLabel } from "./prop-label.js";
import {
  getUniformBoxValue,
  getAxisBoxValues,
  type UnifiedProperty,
} from "../../lib/computed-styles.js";
import {
  computedToTailwindClass,
  uniformBoxToTailwind,
  axisBoxToTailwind,
} from "../../../shared/tailwind-map.js";
import { SPACING_SCALE } from "../../../shared/tailwind-parser.js";

const SIDES = ["top", "right", "bottom", "left"] as const;

export function BoxSpacingControl({
  box,
  icon: Icon,
  activeProps,
  allProperties,
  computedStyles,
  onPreviewInlineStyle,
  onCommitClass,
}: {
  /** "padding" or "margin" */
  box: "padding" | "margin";
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  activeProps: UnifiedProperty[];
  allProperties: UnifiedProperty[];
  computedStyles: Record<string, string>;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onCommitClass: (c: string, oldClass?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const twShort = box === "padding" ? "p" : "m"; // p, m
  const uniform = getUniformBoxValue(computedStyles, box);
  const axis = !uniform ? getAxisBoxValues(computedStyles, box) : null;

  const formatVal = (p: UnifiedProperty) => {
    const v = p.computedValue;
    if (!p.tailwindValue && (v === "0px" || v === "0")) return "—";
    return v;
  };

  const summary = uniform
    ? null
    : axis
    ? `${axis.y} ${axis.x}`
    : activeProps.length > 0
    ? activeProps.map(formatVal).join(" ")
    : null;

  const findProp = (cssProp: string) => allProperties.find((p) => p.cssProperty === cssProp);

  const label = box.charAt(0).toUpperCase() + box.slice(1);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <PropLabel label={label} noMargin />
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--studio-text-dimmed)",
            padding: "2px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Tooltip content={expanded ? "Collapse to shorthand" : "Expand individual sides"}>
            <BoxModelIcon style={{ width: 12, height: 12, opacity: expanded ? 1 : 0.5 }} />
          </Tooltip>
        </button>
      </div>
      {!expanded ? (
        uniform ? (
          <ScaleInput
            icon={Icon}
            value={activeProps[0]?.tailwindValue || (uniform === "0px" || uniform === "0" ? "—" : uniform)}
            computedValue={uniform || "0"}
            currentClass={activeProps[0]?.fullClass || null}
            scale={SPACING_SCALE as string[]}
            prefix={twShort}
            cssProp={box}
            onPreview={(v) => onPreviewInlineStyle(box, v)}
            onCommitClass={onCommitClass}
            onCommitValue={(v) => {
              const match = uniformBoxToTailwind(box, v);
              if (match) {
                onCommitClass(match.tailwindClass);
              } else {
                const mapped = computedToTailwindClass(box, v);
                if (mapped) onCommitClass(mapped.tailwindClass);
                else onCommitClass(`${twShort}-[${v.trim()}]`);
              }
            }}
          />
        ) : axis ? (
          <div className="grid grid-cols-2 gap-1.5">
            <ScaleInput
              icon={Icon}
              label="X"
              value={axis.x}
              computedValue={axis.x}
              currentClass={null}
              scale={SPACING_SCALE as string[]}
              prefix={`${twShort}x`}
              cssProp={`${box}-left`}
              onPreview={(v) => {
                onPreviewInlineStyle(`${box}-left`, v);
                onPreviewInlineStyle(`${box}-right`, v);
              }}
              onCommitClass={onCommitClass}
              onCommitValue={(v) => {
                const { xClass } = axisBoxToTailwind(box, v, axis.y);
                if (xClass) {
                  onCommitClass(xClass.tailwindClass);
                } else {
                  const mapped = computedToTailwindClass(`${box}-left`, v);
                  if (mapped) onCommitClass(mapped.tailwindClass);
                  else onCommitClass(`${twShort}x-[${v.trim()}]`);
                }
              }}
            />
            <ScaleInput
              icon={Icon}
              label="Y"
              value={axis.y}
              computedValue={axis.y}
              currentClass={null}
              scale={SPACING_SCALE as string[]}
              prefix={`${twShort}y`}
              cssProp={`${box}-top`}
              onPreview={(v) => {
                onPreviewInlineStyle(`${box}-top`, v);
                onPreviewInlineStyle(`${box}-bottom`, v);
              }}
              onCommitClass={onCommitClass}
              onCommitValue={(v) => {
                const { yClass } = axisBoxToTailwind(box, axis.x, v);
                if (yClass) {
                  onCommitClass(yClass.tailwindClass);
                } else {
                  const mapped = computedToTailwindClass(`${box}-top`, v);
                  if (mapped) onCommitClass(mapped.tailwindClass);
                  else onCommitClass(`${twShort}y-[${v.trim()}]`);
                }
              }}
            />
          </div>
        ) : (
          <ScrubInput
            icon={Icon}
            value={summary || "mixed"}
            tooltip={box}
            onPreview={(v) => onPreviewInlineStyle(box, v)}
            onCommit={(v) => {
              const match = uniformBoxToTailwind(box, v);
              if (match) onCommitClass(match.tailwindClass);
            }}
          />
        )
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {SIDES.map((side) => {
            const cssProp = `${box}-${side}`;
            const prop = findProp(cssProp);
            const sideLabel = side[0].toUpperCase();
            const sidePrefix = `${twShort}${side[0]}`;
            const cv = prop?.computedValue || "0";
            return (
              <ScaleInput
                key={cssProp}
                label={sideLabel}
                value={prop?.tailwindValue || (cv === "0px" || cv === "0" ? "—" : cv)}
                computedValue={cv}
                currentClass={prop?.fullClass || null}
                scale={SPACING_SCALE as string[]}
                prefix={sidePrefix}
                cssProp={cssProp}
                onPreview={(v) => onPreviewInlineStyle(cssProp, v)}
                onCommitClass={onCommitClass}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
