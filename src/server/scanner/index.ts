import { Router } from "express";
import { detectFramework, type FrameworkInfo } from "./detect-framework.js";
import { scanTokens, type TokenMap } from "./scan-tokens.js";
import { scanComponents, type ComponentRegistry } from "./scan-components.js";
import { scanRoutes, type RouteMap } from "./scan-routes.js";

interface ScanResult {
  framework: FrameworkInfo;
  tokens: TokenMap;
  components: ComponentRegistry;
  routes: RouteMap;
}

let cachedScan: ScanResult | null = null;

async function runScan(projectRoot: string): Promise<ScanResult> {
  const framework = await detectFramework(projectRoot);
  const [tokens, components, routes] = await Promise.all([
    scanTokens(projectRoot, framework),
    scanComponents(projectRoot),
    scanRoutes(projectRoot, framework),
  ]);

  cachedScan = { framework, tokens, components, routes };
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

  router.get("/routes", async (_req, res) => {
    try {
      const result = cachedScan || await runScan(projectRoot);
      res.json(result.routes);
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

  return router;
}
