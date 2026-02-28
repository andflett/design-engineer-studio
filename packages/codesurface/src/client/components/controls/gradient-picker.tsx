import { StudioSelect } from "./select.js";
import type { UnifiedProperty } from "../../lib/computed-styles.js";

export interface GradientItem {
  name: string;
  value: string;
  cssVariable: string;
}

function GradientIcon({ style }: { style?: React.CSSProperties }) {
  const s = { width: 12, height: 12, ...style };
  return (
    <div
      style={{
        ...s,
        borderRadius: 2,
        background: "linear-gradient(135deg, var(--studio-accent), transparent)",
      }}
    />
  );
}

export function GradientPicker({
  prop,
  gradients,
  elementClassName,
  onPreviewInlineStyle,
  onCommitClass,
}: {
  prop: UnifiedProperty | null;
  gradients?: GradientItem[];
  elementClassName: string;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onCommitClass: (c: string, oldClass?: string) => void;
}) {
  const currentValue = prop?.computedValue || "none";
  const hasGradient = currentValue !== "none" && currentValue.includes("gradient");

  // Resolve current gradient from the element's className
  const resolvedFromClass = (() => {
    if (prop?.fullClass) return { name: null, cls: prop.fullClass };
    const classes = elementClassName.split(/\s+/).filter(Boolean);
    for (const cls of classes) {
      // Match bg-[image:var(--name)] or bg-[var(--name)]
      const varMatch = cls.match(/^bg-\[(?:image:)?var\((--[\w-]+)\)\]$/);
      if (varMatch) {
        const varName = varMatch[1];
        const gradDef = gradients?.find((g) => g.cssVariable === varName);
        if (gradDef) return { name: gradDef.name, cls };
      }
    }
    return null;
  })();
  const currentClass = resolvedFromClass?.cls || prop?.fullClass || undefined;
  const currentGradientName = resolvedFromClass?.name;

  const handleSelect = (value: string) => {
    if (value === "none") {
      onPreviewInlineStyle("background-image", "none");
      onCommitClass("bg-none", currentClass);
      return;
    }

    const grad = gradients?.find((g) => g.name === value);
    if (grad) {
      onPreviewInlineStyle("background-image", grad.value);
      onCommitClass(`bg-[image:var(${grad.cssVariable})]`, currentClass);
    }
  };

  return (
    <StudioSelect
      icon={GradientIcon}
      tooltip="background-image (gradient)"
      value={currentGradientName || (hasGradient ? "__current__" : "none")}
      onChange={handleSelect}
      options={[
        { value: "none" },
        ...(hasGradient && !currentGradientName ? [{ value: "__current__", label: currentValue.length > 30 ? currentValue.slice(0, 30) + "..." : currentValue }] : []),
      ]}
      groups={gradients && gradients.length > 0 ? [{
        label: "Project Gradients",
        options: gradients.map((g) => ({ value: g.name })),
      }] : undefined}
    />
  );
}
