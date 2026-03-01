import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { detectFramework, type FrameworkInfo } from "./detect-framework.js";
import { detectStylingSystem, type StylingSystem } from "./detect-styling.js";
import { scanTokens, type TokenMap } from "./scan-tokens.js";
import { scanComponents, type ComponentRegistry } from "./scan-components.js";
import { scanShadows, type ShadowMap } from "./scan-shadows.js";
import { scanBorders, type BorderMap } from "./scan-borders.js";
import { scanGradients, type GradientMap } from "./scan-gradients.js";
import { scanSpacing, type SpacingMap } from "./scan-spacing.js";
import { scanUsages, type ComponentUsageMap } from "./scan-usages.js";

export interface ScanResult {
  framework: FrameworkInfo;
  tokens: TokenMap;
  components: ComponentRegistry;
  shadows: ShadowMap;
  borders: BorderMap;
  gradients: GradientMap;
  spacing: SpacingMap;
  styling: StylingSystem;
  usages: ComponentUsageMap;
}

let cachedScan: ScanResult | null = null;

/** Pre-detected values from CLI, set by createScanRouter. */
let predetectedFramework: FrameworkInfo | undefined;
let predetectedStyling: StylingSystem | undefined;

async function runScan(projectRoot: string): Promise<ScanResult> {
  const framework = predetectedFramework || await detectFramework(projectRoot);
  const styling = predetectedStyling || await detectStylingSystem(projectRoot, framework);
  const componentDir = framework.componentDirExists ? framework.componentDir : undefined;
  const [tokens, components, shadows, borders, gradients, spacing, usages] = await Promise.all([
    scanTokens(projectRoot, framework),
    scanComponents(projectRoot, componentDir),
    scanShadows(projectRoot, framework, styling),
    scanBorders(projectRoot, framework, styling),
    scanGradients(projectRoot, framework, styling),
    scanSpacing(projectRoot, framework, styling),
    scanUsages(projectRoot, framework),
  ]);

  cachedScan = { framework, tokens, components, shadows, borders, gradients, spacing, styling, usages };
  return cachedScan;
}

// ---------------------------------------------------------------------------
// Targeted rescan functions (for use by write endpoints)
// ---------------------------------------------------------------------------

/** Patch a single key in the cached scan result. */
export function patchCachedScan<K extends keyof ScanResult>(key: K, value: ScanResult[K]): void {
  if (cachedScan) {
    cachedScan = { ...cachedScan, [key]: value };
  }
}

export async function rescanTokens(projectRoot: string): Promise<TokenMap> {
  const scan = cachedScan || await runScan(projectRoot);
  const tokens = await scanTokens(projectRoot, scan.framework);
  patchCachedScan("tokens", tokens);
  return tokens;
}

export async function rescanShadows(projectRoot: string): Promise<ShadowMap> {
  const scan = cachedScan || await runScan(projectRoot);
  const shadows = await scanShadows(projectRoot, scan.framework, scan.styling);
  patchCachedScan("shadows", shadows);
  return shadows;
}

export async function rescanBorders(projectRoot: string): Promise<BorderMap> {
  const scan = cachedScan || await runScan(projectRoot);
  const borders = await scanBorders(projectRoot, scan.framework, scan.styling);
  patchCachedScan("borders", borders);
  return borders;
}

export async function rescanSpacing(projectRoot: string): Promise<SpacingMap> {
  const scan = cachedScan || await runScan(projectRoot);
  const spacing = await scanSpacing(projectRoot, scan.framework, scan.styling);
  patchCachedScan("spacing", spacing);
  return spacing;
}

export async function rescanGradients(projectRoot: string): Promise<GradientMap> {
  const scan = cachedScan || await runScan(projectRoot);
  const gradients = await scanGradients(projectRoot, scan.framework, scan.styling);
  patchCachedScan("gradients", gradients);
  return gradients;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createScanRouter(
  projectRoot: string,
  framework?: FrameworkInfo,
  styling?: StylingSystem,
) {
  // Store pre-detected values so runScan() can use them instead of re-detecting
  predetectedFramework = framework;
  predetectedStyling = styling;

  const router = Router();

  // Run initial scan
  runScan(projectRoot).then(() => {
    console.log("  Project scanned successfully");
  }).catch((err) => {
    console.error("  Scan error:", err.message);
  });

  router.get("/all", async (_req, res) => {
    try {
      const result = cachedScan || await runScan(projectRoot);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/tokens", async (_req, res) => {
    try {
      const result = cachedScan || await runScan(projectRoot);
      res.json(result.tokens);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/components", async (_req, res) => {
    try {
      const result = cachedScan || await runScan(projectRoot);
      res.json(result.components);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/gradients", async (_req, res) => {
    try {
      const result = cachedScan || await runScan(projectRoot);
      res.json(result.gradients);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/borders", async (_req, res) => {
    try {
      const result = cachedScan || await runScan(projectRoot);
      res.json(result.borders);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/spacing", async (_req, res) => {
    try {
      const result = cachedScan || await runScan(projectRoot);
      res.json(result.spacing);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/shadows", async (_req, res) => {
    try {
      const result = cachedScan || await runScan(projectRoot);
      res.json(result.shadows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/usages", async (_req, res) => {
    try {
      const result = cachedScan || await runScan(projectRoot);
      res.json(result.usages);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Full rescan — escape hatch
  router.post("/rescan", async (_req, res) => {
    try {
      const result = await runScan(projectRoot);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Targeted rescan endpoints
  router.post("/rescan/tokens", async (_req, res) => {
    try {
      const tokens = await rescanTokens(projectRoot);
      res.json(tokens);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/rescan/shadows", async (_req, res) => {
    try {
      const shadows = await rescanShadows(projectRoot);
      res.json(shadows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/rescan/borders", async (_req, res) => {
    try {
      const borders = await rescanBorders(projectRoot);
      res.json(borders);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/rescan/spacing", async (_req, res) => {
    try {
      const spacing = await rescanSpacing(projectRoot);
      res.json(spacing);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/rescan/gradients", async (_req, res) => {
    try {
      const gradients = await rescanGradients(projectRoot);
      res.json(gradients);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Resolve an iframe route path (e.g. "/") to the source file (e.g. "app/page.tsx")
  router.get("/resolve-route", async (req, res) => {
    try {
      const routePath = (req.query.path as string) || "/";
      const scan = cachedScan || await runScan(projectRoot);
      const appDir = scan.framework.appDir; // e.g. "app"

      const result = await resolveRouteToFile(projectRoot, appDir, routePath);
      res.json({ filePath: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

const PAGE_EXTENSIONS = [".tsx", ".jsx", ".ts", ".js"];

/**
 * Resolve an iframe URL path to the Next.js source file that renders it.
 * Handles route groups like (marketing), dynamic segments [slug],
 * catch-all [...slug], and optional catch-all [[...slug]].
 */
async function resolveRouteToFile(
  projectRoot: string,
  appDir: string,
  routePath: string
): Promise<string | null> {
  const segments = routePath === "/" ? [] : routePath.replace(/^\//, "").replace(/\/$/, "").split("/");
  const absAppDir = path.join(projectRoot, appDir);

  const result = await matchSegments(absAppDir, segments, 0);
  if (result) {
    return path.relative(projectRoot, result);
  }
  return null;
}

async function findPageFile(dir: string): Promise<string | null> {
  for (const ext of PAGE_EXTENSIONS) {
    const candidate = path.join(dir, `page${ext}`);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  for (const ext of PAGE_EXTENSIONS) {
    const candidate = path.join(dir, `index${ext}`);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  return null;
}

async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function matchSegments(
  currentDir: string,
  segments: string[],
  index: number
): Promise<string | null> {
  if (index >= segments.length) {
    const page = await findPageFile(currentDir);
    if (page) return page;

    const dirs = await listDirs(currentDir);
    for (const d of dirs) {
      if (d.startsWith("(") && d.endsWith(")")) {
        const page = await findPageFile(path.join(currentDir, d));
        if (page) return page;
      }
    }
    return null;
  }

  const segment = segments[index];
  const dirs = await listDirs(currentDir);

  if (dirs.includes(segment)) {
    const result = await matchSegments(path.join(currentDir, segment), segments, index + 1);
    if (result) return result;
  }

  for (const d of dirs) {
    if (d.startsWith("(") && d.endsWith(")")) {
      const result = await matchSegments(path.join(currentDir, d), segments, index);
      if (result) return result;
    }
  }

  for (const d of dirs) {
    if (d.startsWith("[") && d.endsWith("]") && !d.startsWith("[...") && !d.startsWith("[[")) {
      const result = await matchSegments(path.join(currentDir, d), segments, index + 1);
      if (result) return result;
    }
  }

  for (const d of dirs) {
    if (d.startsWith("[...") && d.endsWith("]")) {
      const page = await findPageFile(path.join(currentDir, d));
      if (page) return page;
    }
  }

  for (const d of dirs) {
    if (d.startsWith("[[...") && d.endsWith("]]")) {
      const page = await findPageFile(path.join(currentDir, d));
      if (page) return page;
    }
  }

  return null;
}
