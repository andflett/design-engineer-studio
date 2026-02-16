import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import httpProxy from "http-proxy";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";
import { pipeline } from "stream/promises";
import open from "open";
import { createServer as createViteServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createTokensRouter } from "./api/write-tokens.js";
import { createComponentRouter } from "./api/write-component.js";
import { createElementRouter } from "./api/write-element.js";
import { createScanRouter } from "./scanner/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ServerOptions {
  targetPort: number;
  studioPort: number;
}

export async function startServer({ targetPort, studioPort }: ServerOptions) {
  const app = express();
  const projectRoot = process.cwd();
  const targetUrl = `http://localhost:${targetPort}`;
  const clientRoot = path.join(__dirname, "../../src/client");

  app.use(express.json());

  // --- API routes (file writing) ---
  app.use("/api/tokens", createTokensRouter(projectRoot));
  app.use("/api/component", createComponentRouter(projectRoot));
  app.use("/api/element", createElementRouter(projectRoot));

  // --- Scanner routes (project introspection) ---
  app.use("/scan", createScanRouter(projectRoot));

  // --- Serve the injected selection script ---
  app.get("/studio-inject.js", (_req, res) => {
    res.sendFile(path.join(__dirname, "../inject/selection.js"));
  });

  // --- Proxy to the target dev server ---
  // Intercept HTML responses to inject the selection script
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
            // Decompress if needed
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
              // Inject selection script before </body>
              const injected = body.replace(
                "</body>",
                `<script src="/studio-inject.js"></script></body>`
              );
              // Forward headers but remove encoding/length (we've decompressed)
              const headers = { ...proxyRes.headers };
              delete headers["content-length"];
              delete headers["content-encoding"];
              delete headers["transfer-encoding"];
              res.writeHead(proxyRes.statusCode || 200, headers);
              res.end(injected);
            });
          } else {
            // Pass through non-HTML responses
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            proxyRes.pipe(res);
          }
        },
      },
    })
  );

  // --- Proxy target dev server assets (/_next/*, __nextjs*, etc.) ---
  app.use(
    createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      pathFilter: (path) => path.startsWith("/_next") || path.startsWith("/__nextjs"),
    })
  );

  // --- WebSocket proxy for target dev server HMR ---
  const wsProxy = httpProxy.createProxyServer({
    target: targetUrl,
    ws: true,
  });
  wsProxy.on("error", (err) => {
    // Silence proxy errors (e.g. target not ready yet)
    console.error("WS proxy error:", err.message);
  });

  // --- Serve the studio UI via Vite dev server ---
  const vite = await createViteServer({
    configFile: false,
    root: clientRoot,
    plugins: [react(), tailwindcss()],
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  // --- Start server ---
  const server = app.listen(studioPort, () => {
    console.log(`  Studio running at http://localhost:${studioPort}`);
    open(`http://localhost:${studioPort}`);
  });

  // --- WebSocket for studio live updates ---
  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "connected" }));
  });

  // Handle all WebSocket upgrades in one place
  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "";

    if (url === "/ws") {
      // Studio's own WebSocket
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else if (url.startsWith("/_next") || url.startsWith("/__nextjs")) {
      // Forward HMR WebSocket to target dev server
      wsProxy.ws(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  // Export for scanner to push updates
  return { app, wss, projectRoot };
}
