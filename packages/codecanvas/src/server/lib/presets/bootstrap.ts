import fs from "fs/promises";
import path from "path";
import type { ShadowPreset } from "./tailwind.js";

/**
 * Bootstrap 5 default shadow values.
 * Source: https://github.com/twbs/bootstrap/blob/main/scss/_variables.scss
 */
export const BOOTSTRAP_SHADOW_PRESETS: ShadowPreset[] = [
  {
    name: "box-shadow-sm",
    value: "0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)",
  },
  {
    name: "box-shadow",
    value: "0 0.5rem 1rem rgba(0, 0, 0, 0.15)",
  },
  {
    name: "box-shadow-lg",
    value: "0 1rem 3rem rgba(0, 0, 0, 0.175)",
  },
  {
    name: "box-shadow-inset",
    value: "inset 0 1px 2px rgba(0, 0, 0, 0.075)",
  },
];

/**
 * Bootstrap CSS custom property names (v5.3+).
 * Bootstrap exposes shadows as --bs-box-shadow-* CSS variables at runtime.
 */
export const BOOTSTRAP_CSS_VAR_PREFIX = "--bs-box-shadow";

export interface BootstrapShadowOverride {
  name: string;
  value: string;
  /** The Sass variable name, e.g. "$box-shadow-sm" */
  sassVariable: string;
  /** The CSS custom property, e.g. "--bs-box-shadow-sm" */
  cssVariable: string;
  /** File where the override was found */
  filePath: string;
}

/**
 * Scan SCSS files for Bootstrap shadow variable overrides.
 * Looks for patterns like: $box-shadow: 0 .5rem 1rem rgba($black, .15);
 */
export async function scanBootstrapScssOverrides(
  projectRoot: string,
  scssFiles: string[]
): Promise<BootstrapShadowOverride[]> {
  const overrides: BootstrapShadowOverride[] = [];

  for (const file of scssFiles) {
    try {
      const content = await fs.readFile(path.join(projectRoot, file), "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        // Match $box-shadow, $box-shadow-sm, $box-shadow-lg, $box-shadow-inset
        const match = line.match(
          /\$(box-shadow(?:-sm|-lg|-inset)?)\s*:\s*(.+?)(?:\s*!default)?\s*;/
        );
        if (match) {
          const sassName = match[1];
          let value = match[2].trim();

          // Resolve simple Sass color references to CSS equivalents
          value = resolveBootstrapSassColors(value);

          overrides.push({
            name: sassName,
            value,
            sassVariable: `$${sassName}`,
            cssVariable: `--bs-${sassName}`,
            filePath: file,
          });
        }
      }
    } catch {
      // File not found
    }
  }

  return overrides;
}

/**
 * Scan CSS files for Bootstrap CSS custom property overrides (v5.3+).
 * Looks for --bs-box-shadow-* in :root or [data-bs-theme] blocks.
 */
export async function scanBootstrapCssOverrides(
  projectRoot: string,
  cssFiles: string[]
): Promise<BootstrapShadowOverride[]> {
  const overrides: BootstrapShadowOverride[] = [];

  for (const file of cssFiles) {
    try {
      const content = await fs.readFile(path.join(projectRoot, file), "utf-8");

      // Match --bs-box-shadow* custom properties
      const propRegex = /(--bs-box-shadow(?:-sm|-lg|-inset)?)\s*:\s*([^;]+);/g;
      let match;
      while ((match = propRegex.exec(content)) !== null) {
        const cssVar = match[1];
        const value = match[2].trim();
        // Derive name from CSS var: --bs-box-shadow-sm -> box-shadow-sm
        const name = cssVar.replace(/^--bs-/, "");

        overrides.push({
          name,
          value,
          sassVariable: `$${name}`,
          cssVariable: cssVar,
          filePath: file,
        });
      }
    } catch {
      // File not found
    }
  }

  return overrides;
}

/**
 * Replace common Bootstrap Sass color variables with CSS equivalents.
 * This handles simple cases; complex Sass expressions are left as-is.
 */
function resolveBootstrapSassColors(value: string): string {
  return value
    .replace(/rgba\(\$black,\s*([\d.]+)\)/g, "rgba(0, 0, 0, $1)")
    .replace(/rgba\(\$white,\s*([\d.]+)\)/g, "rgba(255, 255, 255, $1)")
    .replace(/\$black/g, "#000")
    .replace(/\$white/g, "#fff");
}
