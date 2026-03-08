/**
 * GET  /api/instructions  — return .claude/surface.md content
 * POST /api/instructions  — save .claude/surface.md content
 */

import { Router } from "express";
import {
  readSurfaceMd,
  writeSurfaceMd,
  ensureSurfaceInstructions,
} from "../lib/instruction-builder.js";

export function createInstructionsRouter(projectRoot: string, stylingType: string): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const content = await ensureSurfaceInstructions(projectRoot, stylingType);
      res.json({ content });
    } catch (err) {
      console.error("Failed to load instructions:", err);
      res.status(500).json({ error: "Failed to load instructions" });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const { content } = req.body as { content: string };
      await writeSurfaceMd(projectRoot, content);
      res.json({ ok: true });
    } catch (err) {
      console.error("Failed to save instructions:", err);
      res.status(500).json({ error: "Failed to save instructions" });
    }
  });

  return router;
}
