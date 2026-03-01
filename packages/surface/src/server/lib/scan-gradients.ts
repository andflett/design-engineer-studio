import fs from "fs/promises";
import path from "path";
import type { FrameworkInfo } from "./detect-framework.js";
import type { StylingSystem } from "./detect-styling.js";
import { parseBlock } from "./scan-tokens.js";

export interface GradientDefinition {
  name: string;
  value: string;
  cssVariable: string;
}

export interface GradientMap {
  gradients: GradientDefinition[];
  cssFilePath: string;
  stylingType: StylingSystem["type"];
}

export async function scanGradients(
  projectRoot: string,
  framework: FrameworkInfo,
  styling: StylingSystem
): Promise<GradientMap> {
  const gradients: GradientDefinition[] = [];
  const allCssFiles = framework.cssFiles.length > 0 ? framework.cssFiles : styling.cssFiles;
  const cssFilePath = allCssFiles[0] || "";

  for (const file of allCssFiles) {
    try {
      const css = await fs.readFile(path.join(projectRoot, file), "utf-8");

      // Parse :root block
      const rootTokens = parseBlock(css, ":root");
      for (const [name, value] of rootTokens) {
        if (isGradientValue(name, value)) {
          gradients.push({
            name: name.replace(/^--/, ""),
            value,
            cssVariable: name,
          });
        }
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
          if (
            isGradientValue(name, value) &&
            !gradients.find((g) => g.cssVariable === name)
          ) {
            gradients.push({
              name: name.replace(/^--/, ""),
              value,
              cssVariable: name,
            });
          }
        }
      }
    } catch {
      // File not found
    }
  }

  return { gradients, cssFilePath, stylingType: styling.type };
}

function isGradientValue(name: string, value: string): boolean {
  if (name.includes("gradient")) return true;
  if (
    value.includes("linear-gradient") ||
    value.includes("radial-gradient") ||
    value.includes("conic-gradient")
  ) {
    return true;
  }
  return false;
}
