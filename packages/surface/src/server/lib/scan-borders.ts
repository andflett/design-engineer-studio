import fs from "fs/promises";
import path from "path";
import type { FrameworkInfo } from "./detect-framework.js";
import type { StylingSystem } from "./detect-styling.js";
import { parseBlock } from "./scan-tokens.js";
import {
  TAILWIND_RADIUS_PRESETS,
  TAILWIND_BORDER_WIDTH_PRESETS,
  type BorderPreset,
} from "./presets/tailwind.js";
import {
  BOOTSTRAP_RADIUS_PRESETS,
  BOOTSTRAP_BORDER_WIDTH_PRESETS,
} from "./presets/bootstrap.js";

export interface BorderDefinition {
  /** Display name: "radius-md", "--border-radius-lg", etc. */
  name: string;
  /** Raw CSS value */
  value: string;
  /** Kind of border property */
  kind: "radius" | "width";
  /** Where this definition comes from */
  source: "custom" | "framework-preset";
  /** Whether the user has overridden this value */
  isOverridden: boolean;
  /** The CSS variable name if applicable */
  cssVariable?: string;
}

export interface BorderMap {
  borders: BorderDefinition[];
  /** CSS file path where custom borders can be written */
  cssFilePath: string;
  /** Detected styling system info */
  stylingType: StylingSystem["type"];
}

export async function scanBorders(
  projectRoot: string,
  framework: FrameworkInfo,
  styling: StylingSystem
): Promise<BorderMap> {
  const borders: BorderDefinition[] = [];
  const allCssFiles = framework.cssFiles.length > 0 ? framework.cssFiles : styling.cssFiles;
  const cssFilePath = allCssFiles[0] || "";

  // 1. Scan CSS files for custom radius/border-width variables
  const customBorders = await scanCustomBorders(projectRoot, allCssFiles);
  const overriddenNames = new Set(customBorders.map((b) => b.name));

  // 2. Add framework presets
  if (styling.type === "tailwind-v4" || styling.type === "tailwind-v3") {
    addPresets(borders, TAILWIND_RADIUS_PRESETS, overriddenNames);
    addPresets(borders, TAILWIND_BORDER_WIDTH_PRESETS, overriddenNames);
  } else if (styling.type === "bootstrap") {
    addPresets(borders, BOOTSTRAP_RADIUS_PRESETS, overriddenNames);
    addPresets(borders, BOOTSTRAP_BORDER_WIDTH_PRESETS, overriddenNames);
  }

  // 3. Add custom borders (these override presets)
  for (const custom of customBorders) {
    borders.push({ ...custom, isOverridden: true });
  }

  // Sort: custom first, then presets; within each group sort by size
  const sizeOrder: Record<string, number> = {
    "xs": 0, "sm": 1, "": 2, "md": 3, "lg": 4, "xl": 5, "2xl": 6, "3xl": 7, "full": 8, "pill": 9, "xxl": 10,
  };

  borders.sort((a, b) => {
    // Group by kind first
    if (a.kind !== b.kind) return a.kind === "radius" ? -1 : 1;
    // Then source
    const order = { custom: 0, "framework-preset": 1 };
    const aOrder = order[a.source];
    const bOrder = order[b.source];
    if (aOrder !== bOrder) return aOrder - bOrder;
    // Then by size suffix
    const extractSize = (name: string) => {
      const match = name.match(/-(xs|sm|md|lg|xl|2xl|3xl|full|pill|xxl)$/);
      return match ? match[1] : "";
    };
    const aSize = sizeOrder[extractSize(a.name)] ?? 50;
    const bSize = sizeOrder[extractSize(b.name)] ?? 50;
    if (aSize !== bSize) return aSize - bSize;
    return a.name.localeCompare(b.name);
  });

  return { borders, cssFilePath, stylingType: styling.type };
}

function addPresets(
  borders: BorderDefinition[],
  presets: BorderPreset[],
  overriddenNames: Set<string>
): void {
  for (const preset of presets) {
    if (!overriddenNames.has(preset.name)) {
      borders.push({
        name: preset.name,
        value: preset.value,
        kind: preset.kind,
        source: "framework-preset",
        isOverridden: false,
        cssVariable: `--${preset.name}`,
      });
    }
  }
}

async function scanCustomBorders(
  projectRoot: string,
  cssFiles: string[]
): Promise<BorderDefinition[]> {
  const borders: BorderDefinition[] = [];

  for (const file of cssFiles) {
    try {
      const css = await fs.readFile(path.join(projectRoot, file), "utf-8");

      // Parse :root block
      const rootTokens = parseBlock(css, ":root");
      for (const [name, value] of rootTokens) {
        const border = classifyBorderToken(name, value);
        if (border) borders.push(border);
      }

      // Check @theme blocks (Tailwind v4)
      const themeMatch = css.match(/@theme\s*(?:inline\s*)?\{([\s\S]*?)\}/);
      if (themeMatch) {
        const themeBlock = themeMatch[1];
        const propRegex = /(--[\w-]+)\s*:\s*([^;]+);/g;
        let match;
        while ((match = propRegex.exec(themeBlock)) !== null) {
          const name = match[1];
          const value = match[2].trim();
          if (!borders.find((b) => b.name === name.replace(/^--/, ""))) {
            const border = classifyBorderToken(name, value);
            if (border) borders.push(border);
          }
        }
      }
    } catch {
      // File not found
    }
  }

  return borders;
}

function classifyBorderToken(
  name: string,
  value: string
): BorderDefinition | null {
  const cleanName = name.replace(/^--/, "");

  // Skip color values
  if (
    value.includes("oklch") ||
    value.includes("hsl") ||
    value.includes("rgb") ||
    value.startsWith("#")
  ) {
    return null;
  }

  if (cleanName.includes("radius")) {
    return {
      name: cleanName,
      value,
      kind: "radius",
      source: "custom",
      isOverridden: false,
      cssVariable: name.startsWith("--") ? name : `--${name}`,
    };
  }

  if (cleanName.includes("border-width") || (cleanName.includes("border") && /^\d/.test(value))) {
    return {
      name: cleanName,
      value,
      kind: "width",
      source: "custom",
      isOverridden: false,
      cssVariable: name.startsWith("--") ? name : `--${name}`,
    };
  }

  return null;
}
