import { Router } from "express";
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

  return router;
}
