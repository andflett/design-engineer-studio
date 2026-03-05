import { ShadowIcon } from "@radix-ui/react-icons";
import { StudioSelect } from "./select.js";
import type { UnifiedProperty } from "../../lib/computed-styles.js";

export interface ShadowItem {
  name: string;
  value: string;
  cssVariable?: string;
}

export function ShadowPicker({
  prop,
  shadows,
  scale,
  elementClassName,
  onPreviewInlineStyle,
  onCommitClass,
  onCommitStyle,
}: {
  prop: UnifiedProperty;
  shadows?: ShadowItem[];
  /** Theme-derived shadow scale keys (e.g. ["sm", "md", "lg"]). Empty = no scale group. */
  scale: readonly string[];
  elementClassName: string;
  onPreviewInlineStyle: (p: string, v: string) => void;
  onCommitClass: (c: string, oldClass?: string) => void;
  /** CSS mode: commit raw CSS value instead of Tailwind classes */
  onCommitStyle?: (cssValue: string) => void;
}) {
  const isCssMode = !!onCommitStyle;
  const currentValue = prop.computedValue;
  const isNone = !currentValue || currentValue === "none";

  // Build full scale set (including "none" and empty-string default) for matching
  const scaleSet = new Set(scale);

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
      // Match standard shadow scale: shadow, shadow-<key>, shadow-none
      const scaleMatch = cls.match(/^shadow(?:-([\w]+))?$/);
      if (scaleMatch) {
        const scaleName = scaleMatch[1] || "";
        if (scaleName === "none" || scaleName === "" || scaleSet.has(scaleName)) {
          return { name: scaleName, cls };
        }
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
      if (onCommitStyle) {
        onCommitStyle("none");
      } else {
        onCommitClass("shadow-none", oldClass);
      }
      return;
    }

    // Check if it's a theme-derived scale value
    if (!isCssMode && scaleSet.has(shadowName)) {
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
      if (onCommitStyle) {
        // CSS mode: write the raw value or var() reference
        onCommitStyle(shadowDef.cssVariable ? `var(${shadowDef.cssVariable})` : shadowDef.value);
      } else if (shadowDef.cssVariable) {
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
        // Only show scale group when theme provides shadow scale entries
        ...(scale.length > 0 && !isCssMode ? [{
          label: "Scale",
          options: scale.filter(s => s !== "none").map((s) => ({
            value: s || "__default__",
            label: s === "" ? "shadow (default)" : s,
          })),
        }] : []),
        ...(shadows && shadows.length > 0 ? [{
          label: "Project Shadows",
          options: shadows
            .filter((s) => !isCssMode ? !scaleSet.has(s.name.replace(/^shadow-?/, "")) : true)
            .map((s) => ({ value: s.name })),
        }] : []),
      ]}
    />
  );
}
