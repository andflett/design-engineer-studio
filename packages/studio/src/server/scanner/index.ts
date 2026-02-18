import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { detectFramework, type FrameworkInfo } from "@designtools/core/scanner";
import { scanTokens, type TokenMap } from "@designtools/core/scanner/scan-tokens";
import { scanComponents, type ComponentRegistry } from "./scan-components.js";

interface StudioScanResult {
  framework: FrameworkInfo;
  tokens: TokenMap;
  components: ComponentRegistry;
}

let cachedScan: StudioScanResult | null = null;

async function runScan(projectRoot: string): Promise<StudioScanResult> {
  const framework = await detectFramework(projectRoot);
  const [tokens, components] = await Promise.all([
    scanTokens(projectRoot, framework),
    scanComponents(projectRoot),
  ]);

  cachedScan = { framework, tokens, components };
  return cachedScan;
}

export function createStudioScanRouter(projectRoot: string) {
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

      // Next.js App Router: /foo/bar → app/foo/bar/page.tsx
      const segments = routePath === "/" ? [] : routePath.replace(/^\//, "").split("/");
      const dir = path.join(appDir, ...segments);

      const candidates = [
        path.join(dir, "page.tsx"),
        path.join(dir, "page.jsx"),
        path.join(dir, "page.ts"),
        path.join(dir, "page.js"),
        // Pages Router / Vite
        path.join(dir, "index.tsx"),
        path.join(dir, "index.jsx"),
      ];

      // Also try the route as a direct file (e.g. "src/pages/about.tsx")
      if (segments.length > 0) {
        const last = segments[segments.length - 1];
        const parent = segments.slice(0, -1);
        candidates.push(
          path.join(appDir, ...parent, `${last}.tsx`),
          path.join(appDir, ...parent, `${last}.jsx`)
        );
      }

      for (const candidate of candidates) {
        try {
          await fs.access(path.join(projectRoot, candidate));
          res.json({ filePath: candidate });
          return;
        } catch {
          // try next
        }
      }

      res.json({ filePath: null });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
