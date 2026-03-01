import fs from "fs/promises";
import path from "path";
import type { FrameworkInfo } from "./detect-framework.js";
import type { StylingSystem } from "./detect-styling.js";
import { parseBlock } from "./scan-tokens.js";

export interface SpacingDefinition {
  /** Display name: "spacing", "spacing-lg", etc. */
  name: string;
  /** Raw CSS value */
  value: string;
  /** Where this definition comes from */
  source: "custom" | "framework-preset";
  /** Whether the user has overridden this value */
  isOverridden: boolean;
  /** The CSS variable name */
  cssVariable: string;
  /** If true, this is the multiplier base (e.g. --spacing: 0.25rem) */
  isBase?: boolean;
}

export interface SpacingMap {
  spacing: SpacingDefinition[];
  /** CSS file path where custom spacing can be written */
  cssFilePath: string;
  /** Detected styling system info */
  stylingType: StylingSystem["type"];
}

/**
 * Tailwind v4 default spacing: a single --spacing base variable (0.25rem).
 * All spacing utilities are derived as multiples: spacing-4 = calc(4 * 0.25rem) = 1rem.
 */
const TAILWIND_SPACING_BASE: SpacingDefinition = {
  name: "spacing",
  value: "0.25rem",
  source: "framework-preset",
  isOverridden: false,
  cssVariable: "--spacing",
  isBase: true,
};

export async function scanSpacing(
  projectRoot: string,
  framework: FrameworkInfo,
  styling: StylingSystem
): Promise<SpacingMap> {
  const spacing: SpacingDefinition[] = [];
  const allCssFiles = framework.cssFiles.length > 0 ? framework.cssFiles : styling.cssFiles;
  const cssFilePath = allCssFiles[0] || "";

  // 1. Scan CSS files for custom spacing variables
  const customSpacing = await scanCustomSpacing(projectRoot, allCssFiles);
  const overriddenNames = new Set(customSpacing.map((s) => s.name));

  // 2. Add framework presets
  if (styling.type === "tailwind-v4") {
    // Tailwind v4 uses a single --spacing base variable
    if (!overriddenNames.has("spacing")) {
      spacing.push(TAILWIND_SPACING_BASE);
    }
  } else if (styling.type === "tailwind-v3") {
    // Tailwind v3 doesn't have a --spacing variable — spacing is baked into config.
    // We add a synthetic base for display purposes.
    if (!overriddenNames.has("spacing")) {
      spacing.push({
        ...TAILWIND_SPACING_BASE,
        source: "framework-preset",
      });
    }
  }

  // 3. Add custom spacing (these override presets)
  for (const custom of customSpacing) {
    spacing.push({ ...custom, isOverridden: true });
  }

  return { spacing, cssFilePath, stylingType: styling.type };
}

async function scanCustomSpacing(
  projectRoot: string,
  cssFiles: string[]
): Promise<SpacingDefinition[]> {
  const spacing: SpacingDefinition[] = [];

  for (const file of cssFiles) {
    try {
      const css = await fs.readFile(path.join(projectRoot, file), "utf-8");

      // Parse :root block
      const rootTokens = parseBlock(css, ":root");
      for (const [name, value] of rootTokens) {
        const s = classifySpacingToken(name, value);
        if (s) spacing.push(s);
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
          if (!spacing.find((s) => s.name === name.replace(/^--/, ""))) {
            const s = classifySpacingToken(name, value);
            if (s) spacing.push(s);
          }
        }
      }
    } catch {
      // File not found
    }
  }

  return spacing;
}

function classifySpacingToken(
  name: string,
  value: string
): SpacingDefinition | null {
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

  // Match --spacing or --spacing-*
  if (cleanName === "spacing" || cleanName.startsWith("spacing-")) {
    return {
      name: cleanName,
      value,
      source: "custom",
      isOverridden: false,
      cssVariable: name.startsWith("--") ? name : `--${name}`,
      isBase: cleanName === "spacing",
    };
  }

  return null;
}
