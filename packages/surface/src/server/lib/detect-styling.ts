import fs from "fs/promises";
import path from "path";
import type { FrameworkInfo } from "./detect-framework.js";

export interface StylingSystem {
  type: "tailwind-v4" | "tailwind-v3" | "css";
  /** Tailwind config path (v3 only) */
  configPath?: string;
  /** CSS files containing global styles/variables */
  cssFiles: string[];
  /** Whether dark mode is detected */
  hasDarkMode: boolean;
}

export async function detectStylingSystem(
  projectRoot: string,
  framework: FrameworkInfo
): Promise<StylingSystem> {
  const pkgPath = path.join(projectRoot, "package.json");
  let pkg: any = {};
  try {
    pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
  } catch {}

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  // Check for Tailwind
  if (deps.tailwindcss) {
    const version = deps.tailwindcss;
    const isV4 = version.startsWith("^4") || version.startsWith("~4") || version.startsWith("4");

    if (isV4) {
      const hasDarkMode = await checkDarkMode(projectRoot, framework.cssFiles);
      return {
        type: "tailwind-v4",
        cssFiles: framework.cssFiles,
        hasDarkMode,
      };
    }

    // Tailwind v3 — look for config file
    const configCandidates = [
      "tailwind.config.ts",
      "tailwind.config.js",
      "tailwind.config.mjs",
      "tailwind.config.cjs",
    ];
    let configPath: string | undefined;
    for (const candidate of configCandidates) {
      try {
        await fs.access(path.join(projectRoot, candidate));
        configPath = candidate;
        break;
      } catch {}
    }

    const hasDarkMode = await checkDarkMode(projectRoot, framework.cssFiles);
    return {
      type: "tailwind-v3",
      configPath,
      cssFiles: framework.cssFiles,
      hasDarkMode,
    };
  }

  // Non-Tailwind — all use the same CSS write path
  const hasDarkMode = await checkDarkMode(projectRoot, framework.cssFiles);
  return {
    type: "css",
    cssFiles: framework.cssFiles,
    hasDarkMode,
  };
}

async function checkDarkMode(projectRoot: string, cssFiles: string[]): Promise<boolean> {
  for (const file of cssFiles) {
    try {
      const css = await fs.readFile(path.join(projectRoot, file), "utf-8");
      if (css.includes(".dark") || css.includes('[data-theme="dark"]') || css.includes("prefers-color-scheme: dark")) {
        return true;
      }
    } catch {}
  }
  return false;
}

