import { Router } from "express";
import { detectFramework, type FrameworkInfo } from "@designtools/core/scanner";
import { scanTokens, type TokenMap } from "@designtools/core/scanner/scan-tokens";
import { detectStylingSystem, type StylingSystem } from "@designtools/core/scanner/detect-styling";
import { scanShadows, type ShadowMap } from "./scan-shadows.js";

interface ShadowsScanResult {
  framework: FrameworkInfo;
  styling: StylingSystem;
  tokens: TokenMap;
  shadows: ShadowMap;
}

let cachedScan: ShadowsScanResult | null = null;

async function runScan(projectRoot: string): Promise<ShadowsScanResult> {
  const framework = await detectFramework(projectRoot);
  const styling = await detectStylingSystem(projectRoot, framework);
  const [tokens, shadows] = await Promise.all([
    scanTokens(projectRoot, framework),
    scanShadows(projectRoot, framework, styling),
  ]);

  cachedScan = { framework, styling, tokens, shadows };
  return cachedScan;
}

export function createShadowsScanRouter(projectRoot: string) {
  const router = Router();

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

  return router;
}
