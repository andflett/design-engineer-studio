import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { detectFramework, type FrameworkInfo } from "./detect-framework.js";
import { detectStylingSystem, type StylingSystem } from "./detect-styling.js";
import { scanTokens, type TokenMap } from "./scan-tokens.js";
import { scanComponents, type ComponentRegistry } from "./scan-components.js";
import { scanShadows, type ShadowMap } from "./scan-shadows.js";

export interface ScanResult {
  framework: FrameworkInfo;
  tokens: TokenMap;
  components: ComponentRegistry;
  shadows: ShadowMap;
  styling: StylingSystem;
}

let cachedScan: ScanResult | null = null;

async function runScan(projectRoot: string): Promise<ScanResult> {
  const framework = await detectFramework(projectRoot);
  const styling = await detectStylingSystem(projectRoot, framework);
  const [tokens, components, shadows] = await Promise.all([
    scanTokens(projectRoot, framework),
    scanComponents(projectRoot),
    scanShadows(projectRoot, framework, styling),
  ]);

  cachedScan = { framework, tokens, components, shadows, styling };
  return cachedScan;
}

export function createScanRouter(projectRoot: string) {
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

  router.get("/shadows", async (_req, res) => {
    try {
      const result = cachedScan || await runScan(projectRoot);
      res.json(result.shadows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/rescan", async (_req, res) => {
    try {
      const result = await runScan(projectRoot);
      res.json(result);
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
