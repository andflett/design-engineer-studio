import { ShadowIcon } from "@radix-ui/react-icons";
import { StudioSelect } from "./select.js";
import type { UnifiedProperty } from "../../lib/computed-styles.js";

export interface ShadowItem {
  name: string;
  value: string;
  cssVariable?: string;
}

export const SHADOW_SCALE = ["none", "2xs", "xs", "sm", "", "md", "lg", "xl", "2xl"];

export function ShadowPicker({
  prop,
  shadows,
  elementClassName,
  onPreviewInlineStyle,
  onCommitClass,
}: {
  prop: UnifiedProperty;
  shadows?: ShadowItem[];
  elementClassName: string;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onCommitClass: (c: string, oldClass?: string) => void;
}) {
  const currentValue = prop.computedValue;
  const isNone = !currentValue || currentValue === "none";

  // Resolve current shadow name from the element's className
  const resolvedFromClass = (() => {
    if (prop.tailwindValue) return { name: prop.tailwindValue, cls: prop.fullClass || undefined };
    if (isNone) return { name: "none", cls: undefined };
    // Search className for shadow classes
    const classes = elementClassName.split(/\s+/).filter(Boolean);
    for (const cls of classes) {
      // Match shadow-[var(--name)] → find shadow by CSS variable
      const varMatch = cls.match(/^shadow-\[var\((--[\w-]+)\)\]$/);
      if (varMatch) {
        const varName = varMatch[1];
        const shadowDef = shadows?.find((s) => s.cssVariable === varName);
        if (shadowDef) return { name: shadowDef.name, cls };
      }
      // Match standard shadow scale: shadow, shadow-sm, shadow-md, etc.
      const scaleMatch = cls.match(/^shadow(?:-(2xs|xs|sm|md|lg|xl|2xl|none))?$/);
      if (scaleMatch) {
        const scaleName = scaleMatch[1] || "";
        return { name: scaleName, cls };
      }
    }
    return null;
  })();
  const currentShadowName = resolvedFromClass?.name ?? null;
  const currentShadowClass = resolvedFromClass?.cls;

  const handleSelect = (shadowName: string) => {
    const oldClass = currentShadowClass || prop.fullClass || undefined;
    if (shadowName === "none") {
      onPreviewInlineStyle("box-shadow", "none");
      onCommitClass("shadow-none", oldClass);
      return;
    }

    // Check if it's a standard Tailwind shadow scale value
    if (SHADOW_SCALE.includes(shadowName)) {
      const cls = shadowName === "" ? "shadow" : `shadow-${shadowName}`;
      const shadowDef = shadows?.find((s) => s.name === `shadow-${shadowName}` || s.name === shadowName);
      if (shadowDef) {
        onPreviewInlineStyle("box-shadow", shadowDef.value);
      }
      onCommitClass(cls, oldClass);
      return;
    }

    // Custom shadow — find definition and apply as arbitrary value or class
    const shadowDef = shadows?.find((s) => s.name === shadowName);
    if (shadowDef) {
      onPreviewInlineStyle("box-shadow", shadowDef.value);
      if (shadowDef.cssVariable) {
        onCommitClass(`shadow-[var(${shadowDef.cssVariable})]`, oldClass);
      } else {
        const cls = shadowName.startsWith("shadow-") ? shadowName : `shadow-${shadowName}`;
        onCommitClass(cls, oldClass);
      }
    }
  };

  return (
    <StudioSelect
      icon={ShadowIcon}
      tooltip="box-shadow"
      value={currentShadowName === null ? "__current__" : (currentShadowName || "__default__")}
      onChange={(v) => handleSelect(v === "__default__" ? "" : v)}
      options={[
        ...(currentShadowName === null ? [{ value: "__current__", label: currentValue.length > 30 ? currentValue.slice(0, 30) + "..." : currentValue }] : []),
        { value: "none" },
      ]}
      groups={[
        {
          label: "Scale",
          options: SHADOW_SCALE.filter(s => s !== "none").map((s) => ({
            value: s || "__default__",
            label: s === "" ? "shadow (default)" : s,
          })),
        },
        ...(shadows && shadows.length > 0 ? [{
          label: "Project Shadows",
          options: shadows
            .filter((s) => !SHADOW_SCALE.includes(s.name.replace(/^shadow-?/, "")))
            .map((s) => ({ value: s.name })),
        }] : []),
      ]}
    />
  );
}
