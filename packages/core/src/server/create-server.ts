import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import httpProxy from "http-proxy";
import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import open from "open";
import { createServer as createViteServer } from "vite";
import { transform } from "esbuild";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export interface ToolServerConfig {
  targetPort: number;
  toolPort: number;
  /** Absolute path to the tool's client source directory (for Vite dev mode) */
  clientRoot: string;
  /** Absolute path to the pre-built client directory (served as static files in production) */
  clientDistRoot?: string;
  /** Absolute path to the injection script file */
  injectScriptPath: string;
  /** URL path prefix for injection script (default: "/tool-inject.js") */
  injectScriptUrl?: string;
  /** Mount tool-specific routes before the Vite SPA fallback */
  setupRoutes?: (app: express.Express, projectRoot: string) => void;
}

export interface ToolServer {
  app: express.Express;
  wss: WebSocketServer;
  projectRoot: string;
}

export async function createToolServer(config: ToolServerConfig): Promise<ToolServer> {
  const app = express();
  const projectRoot = process.cwd();
  const targetUrl = `http://localhost:${config.targetPort}`;
  const injectScriptUrl = config.injectScriptUrl || "/tool-inject.js";

  app.use(express.json());

  // --- Serve the injected script (compile TS → JS if needed) ---
  let compiledInjectCache: string | null = null;
  app.get(injectScriptUrl, async (_req, res) => {
    try {
      if (!compiledInjectCache) {
        const raw = fs.readFileSync(config.injectScriptPath, "utf-8");
        if (config.injectScriptPath.endsWith(".ts")) {
          const result = await transform(raw, { loader: "ts" });
          compiledInjectCache = result.code;
        } else {
          compiledInjectCache = raw;
        }
      }
      res.type("application/javascript").send(compiledInjectCache);
    } catch (err: any) {
      console.error("Inject script compile error:", err.message);
      res.status(500).send(`/* Inject script compile error: ${err.message} */`);
    }
  });

  // --- Proxy to the target dev server ---
  app.use(
    "/proxy",
    createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      pathRewrite: { "^/proxy": "" },
      selfHandleResponse: true,
      on: {
        proxyRes: (proxyRes, _req, res) => {
          const contentType = proxyRes.headers["content-type"] || "";
          const isHtml = contentType.includes("text/html");

          if (isHtml) {
            const encoding = proxyRes.headers["content-encoding"];
            let stream: NodeJS.ReadableStream = proxyRes;
            if (encoding === "gzip") {
              stream = proxyRes.pipe(zlib.createGunzip());
            } else if (encoding === "br") {
              stream = proxyRes.pipe(zlib.createBrotliDecompress());
            } else if (encoding === "deflate") {
              stream = proxyRes.pipe(zlib.createInflate());
            }

            const chunks: Buffer[] = [];
            stream.on("data", (chunk: Buffer) => {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            stream.on("end", () => {
              const body = Buffer.concat(chunks).toString("utf-8");
              // Inject <base> so all relative URLs resolve through /proxy/
              let injected = body.replace(
                "<head>",
                `<head><base href="/proxy/">`
              );
              injected = injected.replace(
                "</body>",
                `<script src="${injectScriptUrl}"></script></body>`
              );
              const headers = { ...proxyRes.headers };
              delete headers["content-length"];
              delete headers["content-encoding"];
              delete headers["transfer-encoding"];
              res.writeHead(proxyRes.statusCode || 200, headers);
              res.end(injected);
            });
          } else {
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            proxyRes.pipe(res);
          }
        },
      },
    })
  );

  // --- Proxy target dev server assets ---
  app.use(
    createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      pathFilter: (p) => p.startsWith("/_next") || p.startsWith("/__nextjs"),
    })
  );

  // --- WebSocket proxy for target HMR ---
  const wsProxy = httpProxy.createProxyServer({
    target: targetUrl,
    ws: true,
  });
  wsProxy.on("error", (err) => {
    console.error("WS proxy error:", err.message);
  });

  // --- Tool-specific routes (must come before Vite SPA fallback) ---
  if (config.setupRoutes) {
    config.setupRoutes(app, projectRoot);
  }

  // --- Serve tool UI (pre-built static files or Vite dev server) ---
  const distRoot = config.clientDistRoot ? path.resolve(config.clientDistRoot) : null;
  const builtIndex = distRoot ? path.join(distRoot, "index.html") : null;
  const hasBuiltClient = builtIndex && fs.existsSync(builtIndex);

  if (hasBuiltClient) {
    // Production: serve pre-built static assets
    app.use(express.static(distRoot!));
    // SPA fallback: serve index.html for all unmatched routes
    app.use((_req, res) => {
      res.sendFile(builtIndex);
    });
  } else {
    // Development: run Vite dev server on source files
    const vite = await createViteServer({
      configFile: false,
      root: config.clientRoot,
      plugins: [react(), tailwindcss()],
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  // --- Start server ---
  const server = app.listen(config.toolPort, () => {
    console.log(`  Tool running at http://localhost:${config.toolPort}`);
    open(`http://localhost:${config.toolPort}`);
  });

  // --- WebSocket for tool live updates ---
  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "connected" }));
  });

  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "";
    if (url === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else if (url.startsWith("/_next") || url.startsWith("/__nextjs")) {
      wsProxy.ws(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  return { app, wss, projectRoot };
}
