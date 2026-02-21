import fs from "fs/promises";
import path from "path";
import type { FrameworkInfo } from "./detect-framework.js";

export interface StylingSystem {
  type: "tailwind-v4" | "tailwind-v3" | "bootstrap" | "css-variables" | "plain-css" | "unknown";
  /** Tailwind config path (v3 only) */
  configPath?: string;
  /** CSS files containing global styles/variables */
  cssFiles: string[];
  /** Sass/SCSS files containing variables (Bootstrap) */
  scssFiles: string[];
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
        scssFiles: [],
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
      scssFiles: [],
      hasDarkMode,
    };
  }

  // Check for Bootstrap
  if (deps.bootstrap) {
    const hasDarkMode = await checkDarkMode(projectRoot, framework.cssFiles);
    const scssFiles = await findBootstrapScssFiles(projectRoot);
    return {
      type: "bootstrap",
      cssFiles: framework.cssFiles,
      scssFiles,
      hasDarkMode,
    };
  }

  // Check for CSS custom properties
  const hasDarkMode = await checkDarkMode(projectRoot, framework.cssFiles);
  const hasCustomProps = await checkCustomProperties(projectRoot, framework.cssFiles);

  if (hasCustomProps) {
    return {
      type: "css-variables",
      cssFiles: framework.cssFiles,
      scssFiles: [],
      hasDarkMode,
    };
  }

  return {
    type: framework.cssFiles.length > 0 ? "plain-css" : "unknown",
    cssFiles: framework.cssFiles,
    scssFiles: [],
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

async function checkCustomProperties(projectRoot: string, cssFiles: string[]): Promise<boolean> {
  for (const file of cssFiles) {
    try {
      const css = await fs.readFile(path.join(projectRoot, file), "utf-8");
      if (/--[\w-]+\s*:/.test(css)) {
        return true;
      }
    } catch {}
  }
  return false;
}

async function findBootstrapScssFiles(projectRoot: string): Promise<string[]> {
  const candidates = [
    "src/scss/_variables.scss",
    "src/scss/_custom.scss",
    "src/scss/custom.scss",
    "src/styles/_variables.scss",
    "src/styles/variables.scss",
    "assets/scss/_variables.scss",
    "scss/_variables.scss",
    "styles/_variables.scss",
  ];

  const found: string[] = [];
  for (const candidate of candidates) {
    try {
      await fs.access(path.join(projectRoot, candidate));
      found.push(candidate);
    } catch {}
  }
  return found;
}
