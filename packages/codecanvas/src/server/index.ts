import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { createWriteElementRouter } from "./api/write-element.js";
import { createTokensRouter } from "./api/write-tokens.js";
import { createComponentRouter } from "./api/write-component.js";
import { createScanRouter } from "./lib/scanner.js";

export interface ServerConfig {
  targetPort: number;
  toolPort: number;
  projectRoot: string;
  stylingType: string;
}

export async function createServer(config: ServerConfig) {
  const app = express();

  // JSON body parsing for API and scan routes
  app.use("/api", express.json());
  app.use("/scan", express.json());

  // API: config endpoint for the client SPA
  app.get("/api/config", (_req, res) => {
    res.json({
      targetUrl: `http://localhost:${config.targetPort}`,
      stylingType: config.stylingType,
      projectRoot: config.projectRoot,
    });
  });

  // API: write element changes
  app.use(
    "/api/write-element",
    createWriteElementRouter({
      projectRoot: config.projectRoot,
      stylingType: config.stylingType,
    })
  );

  // API: write token changes
  app.use("/api/tokens", createTokensRouter(config.projectRoot));

  // API: write component changes
  app.use("/api/component", createComponentRouter(config.projectRoot));

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

  // Scan router: /scan/all, /scan/tokens, /scan/components, /scan/rescan, /scan/resolve-route
  app.use("/scan", createScanRouter(config.projectRoot));

  // Determine if we're in dev or production
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDistPath = path.join(__dirname, "client");
  const isDev = !fs.existsSync(path.join(clientDistPath, "index.html"));

  if (isDev) {
    // Vite middleware mode — serve the client SPA via Vite
    const { createServer: createViteServer } = await import("vite");
    const viteRoot = path.resolve(__dirname, "../client");
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, "../../vite.config.ts"),
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);

    // Serve index.html for SPA — must come after Vite middlewares
    // so Vite handles module requests, but we handle HTML navigation
    app.use(async (req, res, next) => {
      try {
        const url = req.originalUrl || "/";
        const htmlPath = path.join(viteRoot, "index.html");
        let html = fs.readFileSync(htmlPath, "utf-8");
        html = await vite.transformIndexHtml(url, html);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
  } else {
    // Production — serve static files
    app.use(express.static(clientDistPath));
    app.use((_req, res) => {
      res.sendFile(path.join(clientDistPath, "index.html"));
    });
  }

  return app;
}
