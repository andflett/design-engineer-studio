import fs from "fs/promises";
import path from "path";
import type { FrameworkInfo } from "@designtools/core/scanner";
import type { StylingSystem } from "@designtools/core/scanner/detect-styling";
import { parseBlock } from "@designtools/core/scanner/scan-tokens";
import { TAILWIND_SHADOW_PRESETS, type ShadowPreset } from "./presets/tailwind.js";
import {
  BOOTSTRAP_SHADOW_PRESETS,
  scanBootstrapScssOverrides,
  scanBootstrapCssOverrides,
} from "./presets/bootstrap.js";
import {
  scanDesignTokenShadows,
  findDesignTokenFiles,
} from "./presets/w3c-design-tokens.js";

export interface ShadowLayer {
  offsetX: string;
  offsetY: string;
  blur: string;
  spread: string;
  color: string;
  inset: boolean;
}

export interface ShadowDefinition {
  /** Display name: "shadow-md", "--shadow-card", etc. */
  name: string;
  /** Raw CSS value */
  value: string;
  /** Where this shadow comes from */
  source: "custom" | "framework-preset" | "design-token";
  /** Whether the user has overridden this value */
  isOverridden: boolean;
  /** Parsed individual shadow layers */
  layers: ShadowLayer[];
  /** The CSS variable name if applicable (e.g. "--shadow-md") */
  cssVariable?: string;
  /** Sass variable name for Bootstrap (e.g. "$box-shadow-sm") */
  sassVariable?: string;
  /** W3C Design Token path for token-sourced shadows */
  tokenPath?: string;
  /** Source file path for design tokens */
  tokenFilePath?: string;
}

export interface ShadowMap {
  shadows: ShadowDefinition[];
  /** CSS file path where custom shadows can be written */
  cssFilePath: string;
  /** Detected styling system info */
  stylingType: StylingSystem["type"];
  /** W3C Design Token files found in the project */
  designTokenFiles: string[];
}

export async function scanShadows(
  projectRoot: string,
  framework: FrameworkInfo,
  styling: StylingSystem
): Promise<ShadowMap> {
  const shadows: ShadowDefinition[] = [];
  // Prefer framework.cssFiles, fall back to styling.cssFiles, then styling.scssFiles
  const allCssFiles = framework.cssFiles.length > 0 ? framework.cssFiles : styling.cssFiles;
  const cssFilePath = allCssFiles[0] || styling.scssFiles?.[0] || "";

  // 1. Scan CSS files for custom shadow variables/values
  const customShadows = await scanCustomShadows(projectRoot, allCssFiles);

  // Track which preset names have been overridden
  const overriddenNames = new Set(customShadows.map(s => s.name));

  // 2. Add framework presets based on detected styling system
  if (styling.type === "tailwind-v4" || styling.type === "tailwind-v3") {
    addPresets(shadows, TAILWIND_SHADOW_PRESETS, overriddenNames);
  } else if (styling.type === "bootstrap") {
    await addBootstrapShadows(shadows, projectRoot, styling, overriddenNames);
  }

  // 3. Scan for W3C Design Token files (regardless of framework)
  const designTokenFiles = await findDesignTokenFiles(projectRoot);
  if (designTokenFiles.length > 0) {
    const tokenShadows = await scanDesignTokenShadows(projectRoot, designTokenFiles);
    for (const token of tokenShadows) {
      // Don't duplicate if already found via CSS scanning
      if (!overriddenNames.has(token.name)) {
        shadows.push({
          name: token.name,
          value: token.cssValue,
          source: "design-token",
          isOverridden: false,
          layers: parseShadowValue(token.cssValue),
          tokenPath: token.tokenPath,
          tokenFilePath: token.filePath,
        });
      }
    }
  }

  // 4. Add custom shadows (these override presets)
  for (const custom of customShadows) {
    shadows.push({
      ...custom,
      isOverridden: true,
    });
  }

  // Sort: custom first, then design tokens, then presets
  // Within framework-preset, use size-aware ordering (2xs < xs < sm < md < lg < xl < 2xl)
  // Within other groups, use natural sort
  const sizeOrder: Record<string, number> = {
    "2xs": 0, "xs": 1, "sm": 2, "": 3, "md": 4, "lg": 5, "xl": 6, "2xl": 7,
  };
  const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  shadows.sort((a, b) => {
    const order = { custom: 0, "design-token": 1, "framework-preset": 2 };
    const aOrder = order[a.source] ?? 3;
    const bOrder = order[b.source] ?? 3;
    if (aOrder !== bOrder) return aOrder - bOrder;

    // Extract size suffix (e.g. "shadow-2xl" → "2xl", "shadow" → "", "shadow-inner" → null)
    const extractSize = (name: string): string | null => {
      const match = name.match(/^[\w-]+-(\d*x[sl]|sm|md|lg)$/);
      if (match) return match[1];
      // Base name without suffix (e.g. "shadow" with no -sm/-lg)
      if (/^[a-z]+(-[a-z]+)*$/.test(name) && !name.includes("-inner") && !name.includes("-none")) {
        const parts = name.split("-");
        const last = parts[parts.length - 1];
        if (last in sizeOrder) return last;
        // Bare name like "shadow" maps to ""
        if (parts.length === 1 || !Object.keys(sizeOrder).includes(last)) return "";
      }
      return null;
    };

    const aSize = extractSize(a.name);
    const bSize = extractSize(b.name);

    // If both have size suffixes, sort by size
    if (aSize !== null && bSize !== null) {
      const aIdx = sizeOrder[aSize] ?? 99;
      const bIdx = sizeOrder[bSize] ?? 99;
      if (aIdx !== bIdx) return aIdx - bIdx;
    }

    return naturalCollator.compare(a.name, b.name);
  });

  return { shadows, cssFilePath, stylingType: styling.type, designTokenFiles };
}

function addPresets(
  shadows: ShadowDefinition[],
  presets: ShadowPreset[],
  overriddenNames: Set<string>
): void {
  for (const preset of presets) {
    if (!overriddenNames.has(preset.name)) {
      shadows.push({
        name: preset.name,
        value: preset.value,
        source: "framework-preset",
        isOverridden: false,
        layers: parseShadowValue(preset.value),
        cssVariable: `--${preset.name}`,
      });
    }
  }
}

async function addBootstrapShadows(
  shadows: ShadowDefinition[],
  projectRoot: string,
  styling: StylingSystem,
  overriddenNames: Set<string>
): Promise<void> {
  // First, scan for SCSS variable overrides
  const scssOverrides = await scanBootstrapScssOverrides(projectRoot, styling.scssFiles);
  const scssOverrideMap = new Map(scssOverrides.map(o => [o.name, o]));

  // Also scan CSS files for --bs-box-shadow-* overrides
  const cssOverrides = await scanBootstrapCssOverrides(projectRoot, styling.cssFiles);
  const cssOverrideMap = new Map(cssOverrides.map(o => [o.name, o]));

  for (const preset of BOOTSTRAP_SHADOW_PRESETS) {
    if (overriddenNames.has(preset.name)) continue;

    const scssOverride = scssOverrideMap.get(preset.name);
    const cssOverride = cssOverrideMap.get(preset.name);

    // Prefer CSS override > SCSS override > default preset
    const override = cssOverride || scssOverride;

    if (override) {
      shadows.push({
        name: preset.name,
        value: override.value,
        source: "framework-preset",
        isOverridden: true,
        layers: parseShadowValue(override.value),
        cssVariable: override.cssVariable,
        sassVariable: override.sassVariable,
      });
    } else {
      shadows.push({
        name: preset.name,
        value: preset.value,
        source: "framework-preset",
        isOverridden: false,
        layers: parseShadowValue(preset.value),
        cssVariable: `--bs-${preset.name}`,
        sassVariable: `$${preset.name}`,
      });
    }
  }
}

async function scanCustomShadows(
  projectRoot: string,
  cssFiles: string[]
): Promise<ShadowDefinition[]> {
  const shadows: ShadowDefinition[] = [];

  for (const file of cssFiles) {
    try {
      const css = await fs.readFile(path.join(projectRoot, file), "utf-8");

      // Parse :root block for shadow custom properties
      const rootTokens = parseBlock(css, ":root");
      for (const [name, value] of rootTokens) {
        if (name.includes("shadow") || isShadowValue(value)) {
          shadows.push({
            name: name.replace(/^--/, ""),
            value,
            source: "custom",
            isOverridden: true,
            layers: parseShadowValue(value),
            cssVariable: name,
          });
        }
      }

      // Also check @theme blocks (Tailwind v4)
      const themeMatch = css.match(/@theme\s*(?:inline\s*)?\{([\s\S]*?)\}/);
      if (themeMatch) {
        const themeBlock = themeMatch[1];
        const propRegex = /(--shadow[\w-]*)\s*:\s*([^;]+);/g;
        let match;
        while ((match = propRegex.exec(themeBlock)) !== null) {
          const name = match[1].replace(/^--/, "");
          // Don't duplicate if already found in :root
          if (!shadows.find(s => s.name === name)) {
            shadows.push({
              name,
              value: match[2].trim(),
              source: "custom",
              isOverridden: true,
              layers: parseShadowValue(match[2].trim()),
              cssVariable: match[1],
            });
          }
        }
      }
    } catch {
      // File not found
    }
  }

  return shadows;
}

function isShadowValue(value: string): boolean {
  // Check if a CSS value looks like a box-shadow
  return /\d+px\s+\d+px/.test(value) || value.includes("inset");
}

export function parseShadowValue(value: string): ShadowLayer[] {
  if (!value || value === "none") return [];

  // Split by comma, but not inside parentheses (for rgb/oklch colors)
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());

  return parts.map(parseSingleShadow).filter((s): s is ShadowLayer => s !== null);
}

function parseSingleShadow(shadow: string): ShadowLayer | null {
  const trimmed = shadow.trim();
  if (!trimmed) return null;

  const inset = trimmed.startsWith("inset");
  const withoutInset = inset ? trimmed.replace(/^inset\s*/, "") : trimmed;

  // Extract color (at the end, may be rgb/oklch/hex/named)
  let color = "rgb(0 0 0 / 0.1)";
  let measurements = withoutInset;

  // Try to find color at end: rgb(...), oklch(...), rgba(...), hsl(...), hex, or named
  const colorPatterns = [
    /\s+((?:rgb|rgba|oklch|hsl|hsla)\([^)]+\))$/,
    /\s+(#[\da-fA-F]{3,8})$/,
    /\s+((?:black|white|transparent|currentColor))$/i,
  ];

  for (const pattern of colorPatterns) {
    const match = measurements.match(pattern);
    if (match) {
      color = match[1];
      measurements = measurements.slice(0, match.index).trim();
      break;
    }
  }

  // Parse measurements: offsetX offsetY blur? spread?
  const parts = measurements.split(/\s+/);
  if (parts.length < 2) return null;

  return {
    offsetX: parts[0] || "0",
    offsetY: parts[1] || "0",
    blur: parts[2] || "0",
    spread: parts[3] || "0",
    color,
    inset,
  };
}

export function formatShadowValue(layers: ShadowLayer[]): string {
  if (layers.length === 0) return "none";
  return layers.map(formatSingleShadow).join(", ");
}

function formatSingleShadow(layer: ShadowLayer): string {
  const parts: string[] = [];
  if (layer.inset) parts.push("inset");
  parts.push(layer.offsetX);
  parts.push(layer.offsetY);
  parts.push(layer.blur);
  parts.push(layer.spread);
  parts.push(layer.color);
  return parts.join(" ");
}
