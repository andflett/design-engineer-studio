import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { createWriteElementRouter } from "./api/write-element.js";
import { createTokensRouter } from "./api/write-tokens.js";
import { createComponentRouter } from "./api/write-component.js";
import { createShadowsRouter } from "./api/write-shadows.js";
import { createGradientsRouter } from "./api/write-gradients.js";
import { createScanRouter } from "./lib/scanner.js";
import { createInstructionsRouter } from "./api/instructions.js";
import { createAgentChatRouter } from "./api/agent-chat.js";
import { createClassifyElementRouter } from "./api/classify-element.js";
import { createComponentStylesRouter } from "./api/component-styles.js";
import { ensureSurfaceInstructions } from "./lib/instruction-builder.js";
import type { FrameworkInfo } from "./lib/detect-framework.js";
import type { StylingSystem } from "./lib/detect-styling.js";
import type { ResolvedTailwindTheme } from "../shared/tailwind-theme.js";
import { resolveTailwindV3Theme, resolveTailwindV4Theme } from "./lib/resolve-tailwind-theme.js";

export interface ServerConfig {
  targetPort: number;
  toolPort: number;
  /** Full URL override for the target app (e.g. remote dev server). Overrides targetPort for iframe src. */
  targetUrl?: string;
  projectRoot: string;
  stylingType: string;
  /** Pre-detected framework info from CLI (avoids re-detection in scanner). */
  framework?: FrameworkInfo;
  /** Pre-detected styling system from CLI. */
  styling?: StylingSystem;
}

export async function createServer(config: ServerConfig) {
  const app = express();

  // Resolve Tailwind theme (non-blocking — null on failure)
  let tailwindTheme: ResolvedTailwindTheme | null = null;
  if (config.stylingType === "tailwind-v4" && config.styling?.cssFiles?.length) {
    tailwindTheme = await resolveTailwindV4Theme(config.projectRoot, config.styling.cssFiles);
  } else if (config.stylingType === "tailwind-v3" && config.styling?.configPath) {
    tailwindTheme = await resolveTailwindV3Theme(config.projectRoot, config.styling.configPath);
  }

  // JSON body parsing for API and scan routes
  app.use("/api", express.json());
  app.use("/scan", express.json());

  // API: config endpoint for the client SPA
  app.get("/api/config", (_req, res) => {
    res.json({
      targetUrl: config.targetUrl || `http://localhost:${config.targetPort}`,
      stylingType: config.stylingType,
      projectRoot: config.projectRoot,
      tailwindTheme,
      toolPort: config.toolPort,
    });
  });

  // API: write element changes
  app.use(
    "/api/write-element",
    createWriteElementRouter({
      projectRoot: config.projectRoot,
      stylingType: config.stylingType,
      cssFiles: config.styling?.cssFiles || [],
      tailwindTheme,
    })
  );

  // API: write token changes
  app.use("/api/tokens", createTokensRouter(config.projectRoot));

  // API: write component changes
  app.use("/api/component", createComponentRouter(config.projectRoot));

  // API: write shadow changes
  app.use("/api/shadows", createShadowsRouter(config.projectRoot));

  // API: write gradient changes
  app.use("/api/gradients", createGradientsRouter(config.projectRoot));

  // API: agent chat (Claude Agent SDK streaming)
  app.use("/api/agent", createAgentChatRouter(config.projectRoot));

  // API: classify element at source coordinates
  app.use("/api/classify-element", createClassifyElementRouter(config.projectRoot));

  // API: authored styles on element at source coordinates
  app.use("/api/component-styles", createComponentStylesRouter(config.projectRoot));

  // API: open file in the user's editor
  app.get("/api/open-file", (req, res) => {
    const file = req.query.file as string;
    const line = req.query.line as string | undefined;
    const col = req.query.col as string | undefined;
    if (!file) { res.status(400).json({ error: "Missing file" }); return; }

    const absPath = path.isAbsolute(file) ? file : path.join(config.projectRoot, file);

    // Try editors that support line:col, fall back to system open
    const lineCol = line ? `:${line}${col ? `:${col}` : ""}` : "";
    const platform = process.platform;

    // Detect common editors by checking running processes
    const tryOpen = () => {
      // Check for common CLI editors that support goto
      const editors = [
        { cmd: "code", arg: `--goto "${absPath}${lineCol}"` },
        { cmd: "cursor", arg: `--goto "${absPath}${lineCol}"` },
      ];

      // Try each editor, fall back to system open
      let idx = 0;
      const attempt = () => {
        if (idx >= editors.length) {
          // Fallback: system open (no line number support)
          const openCmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
          exec(`${openCmd} "${absPath}"`);
          res.json({ ok: true, editor: "system" });
          return;
        }
        const { cmd, arg } = editors[idx];
        exec(`which ${cmd}`, (err) => {
          if (!err) {
            exec(`${cmd} ${arg}`);
            res.json({ ok: true, editor: cmd });
          } else {
            idx++;
            attempt();
          }
        });
      };
      attempt();
    };

    tryOpen();
  });

  // Ensure .claude/surface.md + CLAUDE.md reference exist before anything else
  await ensureSurfaceInstructions(config.projectRoot, config.stylingType);

  // API: instructions (get/save .claude/surface.md)
  app.use(
    "/api/instructions",
    createInstructionsRouter(config.projectRoot, config.stylingType),
  );

  // Scan router: /scan/all, /scan/tokens, /scan/components, /scan/rescan, /scan/resolve-route
  app.use("/scan", createScanRouter(config.projectRoot, config.framework, config.styling));

  // Determine if we're in dev or production
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDistPath = path.join(__dirname, "client");
  const isDev = !fs.existsSync(path.join(clientDistPath, "index.html"));

  let viteDevServer: any = null;

  if (isDev) {
    // Vite middleware mode — serve the client SPA via Vite
    const { createServer: createViteServer } = await import("vite");
    const viteRoot = path.resolve(__dirname, "../client");
    viteDevServer = await createViteServer({
      configFile: path.resolve(__dirname, "../../vite.config.ts"),
      server: {
        middlewareMode: true,
        hmr: { port: 24679 },
      },
      appType: "custom",
    });
    app.use(viteDevServer.middlewares);

    // Serve index.html for SPA — must come after Vite middlewares
    // so Vite handles module requests, but we handle HTML navigation
    app.use(async (req, res, next) => {
      try {
        const url = req.originalUrl || "/";
        const htmlPath = path.join(viteRoot, "index.html");
        let html = fs.readFileSync(htmlPath, "utf-8");
        html = await viteDevServer.transformIndexHtml(url, html);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (err) {
        viteDevServer.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
  } else {
    // Production — serve static files
    app.use(express.static(clientDistPath));
    // SPA fallback — serve index.html for navigation routes, skip for asset requests
    app.use((req, res, next) => {
      // Don't serve index.html for requests that look like static assets
      if (req.path.includes(".") && !req.path.endsWith(".html")) {
        next();
        return;
      }
      const indexPath = path.join(clientDistPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        next();
      }
    });
  }

  return { app, viteDevServer };
}
