/**
 * Resolve Tailwind theme scales from project config (v3) or design system API (v4).
 * Returns null on failure — callers fall back to empty scales (no dropdowns).
 */

import fs from "fs/promises";
import path from "path";
import { createRequire } from "module";
import type { ResolvedTailwindTheme, ScaleEntry, ThemeScaleKey } from "../../shared/tailwind-theme.js";
import { SPACING_SCALE } from "../../shared/tailwind-parser.js";

// ---------------------------------------------------------------------------
// Tailwind v4: use @tailwindcss/node's __unstable__loadDesignSystem API
// ---------------------------------------------------------------------------

/** Variable prefix → theme scale name (v4 uses these CSS variable prefixes) */
const V4_PREFIX_MAP: Record<string, ThemeScaleKey> = {
  "--spacing": "spacing",
  "--text": "fontSize",
  "--font-size": "fontSize",
  "--font-weight": "fontWeight",
  "--leading": "lineHeight",
  "--line-height": "lineHeight",
  "--tracking": "letterSpacing",
  "--letter-spacing": "letterSpacing",
  "--radius": "borderRadius",
  "--border": "borderWidth",
  "--opacity": "opacity",
  "--shadow": "boxShadow",
};

/**
 * Classify a CSS variable name into a theme scale and extract the key.
 * Returns null if the variable doesn't match any known scale prefix.
 */
function classifyVar(name: string): { scale: ThemeScaleKey; key: string } | null {
  // Sort prefixes longest-first so --letter-spacing matches before --letter, --font-size before --font
  const prefixes = Object.keys(V4_PREFIX_MAP).sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (name.startsWith(prefix + "-")) {
      const key = name.slice(prefix.length + 1);
      return { scale: V4_PREFIX_MAP[prefix], key };
    }
  }
  return null;
}

/**
 * Check if a theme entry is a companion entry that should be filtered out.
 * E.g. --text-sm--line-height is a companion to --text-sm.
 */
function isCompanionEntry(name: string): boolean {
  return /--[^-]+--.+--/.test(name) || name.includes("--line-height") || name.includes("--letter-spacing");
}

/**
 * Check if a variable name should be skipped (not a scale entry).
 */
function shouldSkipEntry(name: string): boolean {
  // Skip --text-shadow-* (multi-value shadow, not a dimension)
  if (name.startsWith("--text-shadow")) return true;
  // Skip companion entries like --text-sm--line-height
  if (isCompanionEntry(name)) return true;
  return false;
}

/**
 * Generate spacing scale entries from a base spacing unit.
 * In v4, --spacing is a single base value (e.g. 0.25rem) and individual
 * spacing values are computed as multiples (p-4 = calc(var(--spacing) * 4)).
 */
function generateSpacingFromBase(baseValue: string): ScaleEntry[] {
  const match = baseValue.match(/^([\d.]+)(rem|px|em)$/);
  if (!match) return [];

  const base = parseFloat(match[1]);
  const unit = match[2];

  const entries: ScaleEntry[] = [];
  for (const key of SPACING_SCALE) {
    if (key === "px") {
      entries.push({ key: "px", value: "1px" });
      continue;
    }
    const multiplier = parseFloat(key);
    if (isNaN(multiplier)) continue;
    const value = base * multiplier;
    const formatted = `${parseFloat(value.toFixed(4))}${unit}`;
    entries.push({ key, value: formatted });
  }
  return entries;
}

export async function resolveTailwindV4Theme(
  projectRoot: string,
  cssFiles: string[],
): Promise<ResolvedTailwindTheme | null> {
  // Try the __unstable__loadDesignSystem API first (full theme resolution)
  const apiResult = await resolveTailwindV4ViaAPI(projectRoot, cssFiles);
  if (apiResult) return apiResult;

  // Fall back to manual @theme block parsing
  return resolveTailwindV4ViaParser(projectRoot, cssFiles);
}

/**
 * Use @tailwindcss/node's __unstable__loadDesignSystem to get the full resolved theme.
 * This is the same API Tailwind IntelliSense uses — returns all defaults + user overrides,
 * no tree-shaking.
 */
async function resolveTailwindV4ViaAPI(
  projectRoot: string,
  cssFiles: string[],
): Promise<ResolvedTailwindTheme | null> {
  try {
    const require = createRequire(path.join(projectRoot, "package.json"));

    let loadDesignSystem: (css: string, opts: { base: string }) => Promise<any>;
    try {
      const twNode = require("@tailwindcss/node");
      loadDesignSystem = twNode.__unstable__loadDesignSystem;
      if (typeof loadDesignSystem !== "function") return null;
    } catch {
      // @tailwindcss/node not available — not a v4 project or doesn't have it
      return null;
    }

    // Read the first CSS entry file
    const cssFile = cssFiles[0];
    if (!cssFile) return null;

    const fullPath = path.isAbsolute(cssFile)
      ? cssFile
      : path.join(projectRoot, cssFile);
    const css = await fs.readFile(fullPath, "utf-8");

    const designSystem = await loadDesignSystem(css, { base: projectRoot });
    if (!designSystem?.theme?.entries) return null;

    const entries: [string, { value: string }][] = designSystem.theme.entries();

    const theme: ResolvedTailwindTheme = {
      spacing: [],
      fontSize: [],
      fontWeight: [],
      lineHeight: [],
      letterSpacing: [],
      borderRadius: [],
      borderWidth: [],
      opacity: [],
      boxShadow: [],
    };

    let spacingBase: string | null = null;
    let hasAnyScale = false;

    for (const [name, entry] of entries) {
      const value = typeof entry === "object" && entry !== null ? entry.value : String(entry);

      // Check for --spacing base unit (single value, not --spacing-*)
      if (name === "--spacing") {
        spacingBase = value;
        continue;
      }

      if (shouldSkipEntry(name)) continue;

      const classified = classifyVar(name);
      if (classified) {
        theme[classified.scale].push({ key: classified.key, value });
        hasAnyScale = true;
      }
    }

    // Generate spacing from base unit if no explicit spacing entries were found
    if (spacingBase && theme.spacing.length === 0) {
      theme.spacing = generateSpacingFromBase(spacingBase);
      if (theme.spacing.length > 0) hasAnyScale = true;
    }

    return hasAnyScale ? theme : null;
  } catch (err) {
    console.warn("[resolve-theme] v4 API resolution failed:", (err as Error).message);
    return null;
  }
}

/**
 * Fallback: Extract @theme blocks from CSS text and parse variable declarations.
 * Handles `@theme { ... }` and `@theme inline { ... }`.
 */
function parseThemeBlocks(css: string): Map<string, string> {
  const vars = new Map<string, string>();
  const themeRegex = /@theme\s*(?:inline\s*)?\{/g;
  let match: RegExpExecArray | null;

  while ((match = themeRegex.exec(css)) !== null) {
    let depth = 1;
    let i = match.index + match[0].length;
    const start = i;

    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }

    const blockContent = css.slice(start, i - 1);

    // Parse CSS custom property declarations within the block
    const declRegex = /(--[\w-]+)\s*:\s*([^;]+);/g;
    let declMatch: RegExpExecArray | null;
    while ((declMatch = declRegex.exec(blockContent)) !== null) {
      vars.set(declMatch[1].trim(), declMatch[2].trim());
    }
  }

  return vars;
}

async function resolveTailwindV4ViaParser(
  projectRoot: string,
  cssFiles: string[],
): Promise<ResolvedTailwindTheme | null> {
  try {
    const allVars = new Map<string, string>();

    for (const cssFile of cssFiles) {
      const fullPath = path.isAbsolute(cssFile)
        ? cssFile
        : path.join(projectRoot, cssFile);
      try {
        const css = await fs.readFile(fullPath, "utf-8");
        const themeVars = parseThemeBlocks(css);
        for (const [k, v] of themeVars) {
          allVars.set(k, v);
        }
      } catch {
        // File not found — skip
      }
    }

    if (allVars.size === 0) return null;

    const theme: ResolvedTailwindTheme = {
      spacing: [],
      fontSize: [],
      fontWeight: [],
      lineHeight: [],
      letterSpacing: [],
      borderRadius: [],
      borderWidth: [],
      opacity: [],
      boxShadow: [],
    };

    let spacingBase: string | null = null;
    let hasAnyScale = false;

    for (const [name, value] of allVars) {
      // Check for --spacing base unit
      if (name === "--spacing") {
        spacingBase = value;
        continue;
      }

      if (shouldSkipEntry(name)) continue;

      const classified = classifyVar(name);
      if (classified) {
        theme[classified.scale].push({ key: classified.key, value });
        hasAnyScale = true;
      }
    }

    // Generate spacing from base unit if no explicit spacing entries
    if (spacingBase && theme.spacing.length === 0) {
      theme.spacing = generateSpacingFromBase(spacingBase);
      if (theme.spacing.length > 0) hasAnyScale = true;
    }

    return hasAnyScale ? theme : null;
  } catch (err) {
    console.warn("[resolve-theme] v4 theme resolution failed:", (err as Error).message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tailwind v3: resolve config via resolveConfig
// ---------------------------------------------------------------------------

/** Default Tailwind v3 theme values for common scales */
const V3_SCALE_KEYS: Record<string, ThemeScaleKey> = {
  spacing: "spacing",
  fontSize: "fontSize",
  fontWeight: "fontWeight",
  lineHeight: "lineHeight",
  letterSpacing: "letterSpacing",
  borderRadius: "borderRadius",
  borderWidth: "borderWidth",
  opacity: "opacity",
  boxShadow: "boxShadow",
};

export async function resolveTailwindV3Theme(
  projectRoot: string,
  configPath: string,
): Promise<ResolvedTailwindTheme | null> {
  try {
    const require = createRequire(path.join(projectRoot, "package.json"));

    // Load resolveConfig from the project's tailwindcss
    let resolveConfig: (config: any) => any;
    try {
      resolveConfig = require("tailwindcss/resolveConfig");
    } catch {
      console.warn("[resolve-theme] Could not load tailwindcss/resolveConfig");
      return null;
    }

    // Load the project's config file
    const absConfigPath = path.isAbsolute(configPath)
      ? configPath
      : path.join(projectRoot, configPath);

    let userConfig: any;
    try {
      // Try direct require first (works for .js and .cjs)
      userConfig = require(absConfigPath);
      // Handle ES module default export
      if (userConfig && userConfig.__esModule && userConfig.default) {
        userConfig = userConfig.default;
      }
    } catch {
      // Try jiti for .ts configs
      try {
        const jitiModule = require("jiti");
        const jiti = typeof jitiModule === "function" ? jitiModule(absConfigPath) : jitiModule.default(absConfigPath);
        userConfig = jiti(absConfigPath);
        if (userConfig && userConfig.default) {
          userConfig = userConfig.default;
        }
      } catch {
        console.warn("[resolve-theme] Could not load config:", absConfigPath);
        return null;
      }
    }

    const resolved = resolveConfig(userConfig);
    if (!resolved?.theme) return null;

    const theme: ResolvedTailwindTheme = {
      spacing: [],
      fontSize: [],
      fontWeight: [],
      lineHeight: [],
      letterSpacing: [],
      borderRadius: [],
      borderWidth: [],
      opacity: [],
      boxShadow: [],
    };

    for (const [themeKey, scaleKey] of Object.entries(V3_SCALE_KEYS)) {
      const scaleObj = resolved.theme[themeKey];
      if (!scaleObj || typeof scaleObj !== "object") continue;

      for (const [key, val] of Object.entries(scaleObj)) {
        if (val == null) continue;
        // fontSize can be [size, { lineHeight }] tuples
        const value = Array.isArray(val) ? String(val[0]) : String(val);
        theme[scaleKey].push({ key, value });
      }
    }

    // Check if theme has any non-empty scale
    const hasAny = Object.values(theme).some((arr) => arr.length > 0);
    return hasAny ? theme : null;
  } catch (err) {
    console.warn("[resolve-theme] v3 theme resolution failed:", (err as Error).message);
    return null;
  }
}
