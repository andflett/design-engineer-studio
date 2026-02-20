#!/usr/bin/env node

// ../core/src/cli/bootstrap.ts
import fs3 from "fs";
import path3 from "path";
import process2 from "process";

// ../core/src/scanner/detect-framework.ts
import fs from "fs/promises";
import path from "path";
async function detectFramework(projectRoot) {
  const pkgPath = path.join(projectRoot, "package.json");
  let pkg = {};
  try {
    pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
  } catch {
  }
  const deps = {
    ...pkg.dependencies,
    ...pkg.devDependencies
  };
  let name = "unknown";
  let appDirCandidates;
  let componentDirCandidates;
  if (deps.next) {
    name = "nextjs";
    appDirCandidates = ["app", "src/app"];
    componentDirCandidates = ["components/ui", "src/components/ui"];
  } else if (deps["@remix-run/react"] || deps["@remix-run/node"]) {
    name = "remix";
    appDirCandidates = ["app/routes", "src/routes"];
    componentDirCandidates = ["components/ui", "app/components/ui", "src/components/ui"];
  } else if (deps.vite) {
    name = "vite";
    appDirCandidates = ["src/pages", "src/routes", "src", "pages"];
    componentDirCandidates = ["components/ui", "src/components/ui"];
  } else {
    appDirCandidates = ["app", "src", "pages"];
    componentDirCandidates = ["components/ui", "src/components/ui"];
  }
  const appResult = await findDir(projectRoot, appDirCandidates);
  const componentResult = await findDir(projectRoot, componentDirCandidates);
  const componentFileCount = componentResult.exists ? await countFiles(projectRoot, componentResult.dir, ".tsx") : 0;
  return {
    name,
    appDir: appResult.dir,
    appDirExists: appResult.exists,
    componentDir: componentResult.dir,
    componentDirExists: componentResult.exists,
    componentFileCount,
    cssFiles: await findCssFiles(projectRoot)
  };
}
async function findDir(root, candidates) {
  for (const candidate of candidates) {
    const full = path.join(root, candidate);
    try {
      const stat = await fs.stat(full);
      if (stat.isDirectory()) return { dir: candidate, exists: true };
    } catch {
    }
  }
  return { dir: candidates[0], exists: false };
}
async function countFiles(root, dir, ext) {
  const full = path.join(root, dir);
  try {
    const entries = await fs.readdir(full);
    return entries.filter((e) => e.endsWith(ext)).length;
  } catch {
    return 0;
  }
}
async function findCssFiles(projectRoot) {
  const candidates = [
    "app/globals.css",
    "src/app/globals.css",
    "app/global.css",
    "src/globals.css",
    "src/index.css",
    "src/app.css",
    "styles/globals.css"
  ];
  const found = [];
  for (const candidate of candidates) {
    try {
      await fs.access(path.join(projectRoot, candidate));
      found.push(candidate);
    } catch {
    }
  }
  return found;
}

// ../core/src/scanner/detect-styling.ts
import fs2 from "fs/promises";
import path2 from "path";
async function detectStylingSystem(projectRoot, framework) {
  const pkgPath = path2.join(projectRoot, "package.json");
  let pkg = {};
  try {
    pkg = JSON.parse(await fs2.readFile(pkgPath, "utf-8"));
  } catch {
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.tailwindcss) {
    const version = deps.tailwindcss;
    const isV4 = version.startsWith("^4") || version.startsWith("~4") || version.startsWith("4");
    if (isV4) {
      const hasDarkMode3 = await checkDarkMode(projectRoot, framework.cssFiles);
      return {
        type: "tailwind-v4",
        cssFiles: framework.cssFiles,
        scssFiles: [],
        hasDarkMode: hasDarkMode3
      };
    }
    const configCandidates = [
      "tailwind.config.ts",
      "tailwind.config.js",
      "tailwind.config.mjs",
      "tailwind.config.cjs"
    ];
    let configPath;
    for (const candidate of configCandidates) {
      try {
        await fs2.access(path2.join(projectRoot, candidate));
        configPath = candidate;
        break;
      } catch {
      }
    }
    const hasDarkMode2 = await checkDarkMode(projectRoot, framework.cssFiles);
    return {
      type: "tailwind-v3",
      configPath,
      cssFiles: framework.cssFiles,
      scssFiles: [],
      hasDarkMode: hasDarkMode2
    };
  }
  if (deps.bootstrap) {
    const hasDarkMode2 = await checkDarkMode(projectRoot, framework.cssFiles);
    const scssFiles = await findBootstrapScssFiles(projectRoot);
    return {
      type: "bootstrap",
      cssFiles: framework.cssFiles,
      scssFiles,
      hasDarkMode: hasDarkMode2
    };
  }
  const hasDarkMode = await checkDarkMode(projectRoot, framework.cssFiles);
  const hasCustomProps = await checkCustomProperties(projectRoot, framework.cssFiles);
  if (hasCustomProps) {
    return {
      type: "css-variables",
      cssFiles: framework.cssFiles,
      scssFiles: [],
      hasDarkMode
    };
  }
  return {
    type: framework.cssFiles.length > 0 ? "plain-css" : "unknown",
    cssFiles: framework.cssFiles,
    scssFiles: [],
    hasDarkMode
  };
}
async function checkDarkMode(projectRoot, cssFiles) {
  for (const file of cssFiles) {
    try {
      const css = await fs2.readFile(path2.join(projectRoot, file), "utf-8");
      if (css.includes(".dark") || css.includes('[data-theme="dark"]') || css.includes("prefers-color-scheme: dark")) {
        return true;
      }
    } catch {
    }
  }
  return false;
}
async function checkCustomProperties(projectRoot, cssFiles) {
  for (const file of cssFiles) {
    try {
      const css = await fs2.readFile(path2.join(projectRoot, file), "utf-8");
      if (/--[\w-]+\s*:/.test(css)) {
        return true;
      }
    } catch {
    }
  }
  return false;
}
async function findBootstrapScssFiles(projectRoot) {
  const candidates = [
    "src/scss/_variables.scss",
    "src/scss/_custom.scss",
    "src/scss/custom.scss",
    "src/styles/_variables.scss",
    "src/styles/variables.scss",
    "assets/scss/_variables.scss",
    "scss/_variables.scss",
    "styles/_variables.scss"
  ];
  const found = [];
  for (const candidate of candidates) {
    try {
      await fs2.access(path2.join(projectRoot, candidate));
      found.push(candidate);
    } catch {
    }
  }
  return found;
}

// ../core/src/cli/bootstrap.ts
var originalEmitWarning = process2.emitWarning;
process2.emitWarning = ((warning, ...args) => {
  if (typeof warning === "string" && warning.includes("util._extend")) return;
  return originalEmitWarning.call(process2, warning, ...args);
});
var green = (s) => `\x1B[32m${s}\x1B[0m`;
var yellow = (s) => `\x1B[33m${s}\x1B[0m`;
var red = (s) => `\x1B[31m${s}\x1B[0m`;
var dim = (s) => `\x1B[2m${s}\x1B[0m`;
var bold = (s) => `\x1B[1m${s}\x1B[0m`;
async function bootstrap(config) {
  const args = process2.argv.slice(2);
  let targetPort = config.defaultTargetPort;
  let toolPort = config.defaultToolPort;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" && args[i + 1]) {
      targetPort = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === "--tool-port" && args[i + 1]) {
      toolPort = parseInt(args[i + 1], 10);
      i++;
    }
  }
  const projectRoot = process2.cwd();
  console.log("");
  console.log(`  ${bold(config.name)}`);
  console.log(`  ${dim(projectRoot)}`);
  console.log("");
  const pkgPath = path3.join(projectRoot, "package.json");
  if (!fs3.existsSync(pkgPath)) {
    console.log(`  ${red("\u2717")} No package.json found in ${projectRoot}`);
    console.log(`    ${dim("Run this command from the root of the app you want to edit.")}`);
    console.log(`    ${dim("All file reads and writes are scoped to this directory.")}`);
    console.log("");
    process2.exit(1);
  }
  const framework = await detectFramework(projectRoot);
  const frameworkLabel = framework.name === "nextjs" ? "Next.js" : framework.name === "remix" ? "Remix" : framework.name === "vite" ? "Vite" : "Unknown";
  console.log(`  ${green("\u2713")} Framework      ${frameworkLabel}`);
  if (framework.appDirExists) {
    console.log(`  ${green("\u2713")} App dir        ${framework.appDir}/`);
  } else {
    console.log(`  ${yellow("\u26A0")} App dir        ${dim("not found \u2014 route detection won't be available")}`);
  }
  if (framework.componentDirExists) {
    console.log(
      `  ${green("\u2713")} Components     ${framework.componentDir}/ ${dim(`(${framework.componentFileCount} files)`)}`
    );
  } else {
    console.log(`  ${yellow("\u26A0")} Components     ${dim("not found \u2014 component editing won't be available")}`);
  }
  if (framework.cssFiles.length > 0) {
    console.log(`  ${green("\u2713")} CSS files      ${framework.cssFiles[0]}`);
  } else {
    console.log(`  ${yellow("\u26A0")} CSS files      ${dim("no CSS files found")}`);
  }
  const styling = await detectStylingSystem(projectRoot, framework);
  const stylingLabels = {
    "tailwind-v4": "Tailwind CSS v4",
    "tailwind-v3": "Tailwind CSS v3",
    "bootstrap": "Bootstrap",
    "css-variables": "CSS Custom Properties",
    "plain-css": "Plain CSS",
    "unknown": "Unknown"
  };
  const stylingLabel = stylingLabels[styling.type];
  if (styling.type !== "unknown") {
    console.log(`  ${green("\u2713")} Styling        ${stylingLabel}`);
  } else {
    console.log(`  ${yellow("\u26A0")} Styling        ${dim("no styling system detected")}`);
  }
  if (config.extraChecks) {
    const lines = await config.extraChecks(framework, projectRoot);
    for (const line of lines) {
      const icon = line.status === "ok" ? green("\u2713") : line.status === "warn" ? yellow("\u26A0") : red("\u2717");
      console.log(`  ${icon} ${line.label.padEnd(14)} ${line.detail}`);
      if (line.hint) {
        console.log(`    ${dim(line.hint)}`);
      }
      if (line.status === "error") {
        console.log("");
        process2.exit(1);
      }
    }
  }
  console.log("");
  const targetUrl = `http://localhost:${targetPort}`;
  let targetReachable = false;
  let waited = false;
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      await fetch(targetUrl, { signal: AbortSignal.timeout(2e3) });
      targetReachable = true;
      break;
    } catch {
      if (attempt === 0) {
        process2.stdout.write(`  ${dim("Waiting for dev server at " + targetUrl + "...")}`);
        waited = true;
      }
      await new Promise((r) => setTimeout(r, 1e3));
    }
  }
  if (waited) process2.stdout.write("\r\x1B[K");
  if (targetReachable) {
    console.log(`  ${green("\u2713")} Target         ${targetUrl}`);
  } else {
    console.log("");
    console.log(`  ${red("\u2717")} No dev server at ${targetUrl}`);
    console.log(`    ${dim("Start your dev server first, then run this command.")}`);
    console.log(`    ${dim(`Use --port to specify a different port.`)}`);
    console.log("");
    process2.exit(1);
  }
  console.log(`  ${green("\u2713")} Tool           http://localhost:${toolPort}`);
  console.log("");
  console.log(`  ${dim("All file writes are scoped to:")} ${bold(projectRoot)}`);
  console.log("");
  return { framework, styling, targetPort, toolPort, projectRoot };
}

// src/server/index.ts
import path9 from "path";
import fs11 from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";

// ../core/src/server/create-server.ts
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import httpProxy from "http-proxy";
import { WebSocketServer } from "ws";
import fs4 from "fs";
import path4 from "path";
import zlib from "zlib";
import open from "open";
import { createServer as createViteServer } from "vite";
import { transform } from "esbuild";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
async function createToolServer(config) {
  const app = express();
  const projectRoot = process.cwd();
  const targetUrl = `http://localhost:${config.targetPort}`;
  const injectScriptUrl = config.injectScriptUrl || "/tool-inject.js";
  app.use(express.json());
  let compiledInjectCache = null;
  app.get(injectScriptUrl, async (_req, res) => {
    try {
      if (!compiledInjectCache) {
        const raw = fs4.readFileSync(config.injectScriptPath, "utf-8");
        if (config.injectScriptPath.endsWith(".ts")) {
          const result = await transform(raw, { loader: "ts" });
          compiledInjectCache = result.code;
        } else {
          compiledInjectCache = raw;
        }
      }
      res.type("application/javascript").send(compiledInjectCache);
    } catch (err) {
      console.error("Inject script compile error:", err.message);
      res.status(500).send(`/* Inject script compile error: ${err.message} */`);
    }
  });
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
            let stream = proxyRes;
            if (encoding === "gzip") {
              stream = proxyRes.pipe(zlib.createGunzip());
            } else if (encoding === "br") {
              stream = proxyRes.pipe(zlib.createBrotliDecompress());
            } else if (encoding === "deflate") {
              stream = proxyRes.pipe(zlib.createInflate());
            }
            const chunks = [];
            stream.on("data", (chunk) => {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            stream.on("end", () => {
              const body = Buffer.concat(chunks).toString("utf-8");
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
        }
      }
    })
  );
  app.use(
    createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      pathFilter: (p) => p.startsWith("/_next") || p.startsWith("/__nextjs")
    })
  );
  const wsProxy = httpProxy.createProxyServer({
    target: targetUrl,
    ws: true
  });
  wsProxy.on("error", (err) => {
    console.error("WS proxy error:", err.message);
  });
  if (config.setupRoutes) {
    config.setupRoutes(app, projectRoot);
  }
  const distRoot = config.clientDistRoot ? path4.resolve(config.clientDistRoot) : null;
  const builtIndex = distRoot ? path4.join(distRoot, "index.html") : null;
  const hasBuiltClient = builtIndex && fs4.existsSync(builtIndex);
  if (hasBuiltClient) {
    app.use(express.static(distRoot, { dotfiles: "allow" }));
    app.use((_req, res) => {
      res.sendFile(builtIndex, { dotfiles: "allow" });
    });
  } else {
    const vite = await createViteServer({
      configFile: false,
      root: config.clientRoot,
      plugins: [react(), tailwindcss()],
      server: {
        middlewareMode: true,
        hmr: { server: void 0, port: config.toolPort + 1 }
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }
  const server = app.listen(config.toolPort, () => {
    console.log(`  Tool running at http://localhost:${config.toolPort}`);
    open(`http://localhost:${config.toolPort}`);
  });
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

// ../core/src/server/safe-path.ts
import path5 from "path";
function safePath(projectRoot, filePath) {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("File path is required");
  }
  if (path5.isAbsolute(filePath)) {
    throw new Error(
      `Absolute paths are not allowed: "${filePath}". Paths must be relative to the project root.`
    );
  }
  const resolvedRoot = path5.resolve(projectRoot);
  const resolvedPath = path5.resolve(resolvedRoot, filePath);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(resolvedRoot + path5.sep)) {
    throw new Error(
      `Path "${filePath}" resolves outside the project directory. Refusing to write.`
    );
  }
  return resolvedPath;
}

// src/server/api/write-tokens.ts
import { Router } from "express";
import fs5 from "fs/promises";
function createTokensRouter(projectRoot) {
  const router = Router();
  router.post("/", async (req, res) => {
    try {
      const { filePath, token, value, selector } = req.body;
      const fullPath = safePath(projectRoot, filePath);
      let css = await fs5.readFile(fullPath, "utf-8");
      css = replaceTokenInBlock(css, selector, token, value);
      await fs5.writeFile(fullPath, css, "utf-8");
      res.json({ ok: true, filePath, token, value });
    } catch (err) {
      console.error("Token write error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  return router;
}
function replaceTokenInBlock(css, selector, token, newValue) {
  const selectorEscaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockStart = css.search(new RegExp(`${selectorEscaped}\\s*\\{`));
  if (blockStart === -1) {
    throw new Error(`Selector "${selector}" not found in CSS file`);
  }
  const openBrace = css.indexOf("{", blockStart);
  let depth = 1;
  let pos = openBrace + 1;
  while (depth > 0 && pos < css.length) {
    if (css[pos] === "{") depth++;
    if (css[pos] === "}") depth--;
    pos++;
  }
  const blockEnd = pos;
  let block = css.slice(openBrace + 1, blockEnd - 1);
  const tokenEscaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenRegex = new RegExp(
    `(${tokenEscaped}\\s*:\\s*)([^;]+)(;)`,
    "g"
  );
  if (!tokenRegex.test(block)) {
    throw new Error(`Token "${token}" not found in "${selector}" block`);
  }
  block = block.replace(tokenRegex, `$1${newValue}$3`);
  return css.slice(0, openBrace + 1) + block + css.slice(blockEnd - 1);
}

// src/server/api/write-component.ts
import { Router as Router2 } from "express";
import fs6 from "fs/promises";
function createComponentRouter(projectRoot) {
  const router = Router2();
  router.post("/", async (req, res) => {
    try {
      const { filePath, oldClass, newClass, variantContext } = req.body;
      const fullPath = safePath(projectRoot, filePath);
      let source = await fs6.readFile(fullPath, "utf-8");
      source = replaceClassInComponent(source, oldClass, newClass, variantContext);
      await fs6.writeFile(fullPath, source, "utf-8");
      res.json({ ok: true, filePath, oldClass, newClass });
    } catch (err) {
      console.error("Component write error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  return router;
}
function replaceClassInComponent(source, oldClass, newClass, variantContext) {
  if (variantContext) {
    const variantIndex = source.indexOf(`${variantContext}:`);
    if (variantIndex === -1) {
      const quotedIndex = source.indexOf(`"${variantContext}":`);
      if (quotedIndex === -1) {
        throw new Error(`Variant context "${variantContext}" not found`);
      }
    }
  }
  const oldClassEscaped = oldClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const classRegex = new RegExp(
    `(["'\`][^"'\`]*?)\\b${oldClassEscaped}\\b([^"'\`]*?["'\`])`,
    "g"
  );
  let replaced = false;
  if (variantContext) {
    const variantPattern = new RegExp(
      `(${variantContext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"\\s]*:[\\s]*)(["'\`])([^"'\`]*?)\\b${oldClassEscaped}\\b([^"'\`]*?)(\\2)`,
      "g"
    );
    if (variantPattern.test(source)) {
      source = source.replace(
        variantPattern,
        `$1$2$3${newClass}$4$5`
      );
      replaced = true;
    }
    if (!replaced) {
      const quotedVariantPattern = new RegExp(
        `(["']${variantContext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']\\s*:\\s*)(["'\`])([^"'\`]*?)\\b${oldClassEscaped}\\b([^"'\`]*?)(\\2)`,
        "g"
      );
      if (quotedVariantPattern.test(source)) {
        source = source.replace(
          quotedVariantPattern,
          `$1$2$3${newClass}$4$5`
        );
        replaced = true;
      }
    }
  }
  if (!replaced) {
    const count = (source.match(classRegex) || []).length;
    if (count === 0) {
      throw new Error(
        `Class "${oldClass}" not found in component file`
      );
    }
    if (count > 1 && !variantContext) {
      throw new Error(
        `Class "${oldClass}" found ${count} times. Provide variantContext to narrow.`
      );
    }
    source = source.replace(classRegex, `$1${newClass}$2`);
  }
  return source;
}

// src/server/api/write-element.ts
import { Router as Router3 } from "express";
import fs7 from "fs/promises";
import crypto from "crypto";
import * as recast from "recast";
import { visit, namedTypes as n } from "ast-types";
var b = recast.types.builders;
var babelTsParser;
async function getParser() {
  if (!babelTsParser) {
    babelTsParser = await import("recast/parsers/babel-ts.js");
  }
  return babelTsParser;
}
function parseSource(source, parser) {
  return recast.parse(source, { parser });
}
function printSource(ast) {
  return recast.print(ast).code;
}
function createElementRouter(projectRoot) {
  const router = Router3();
  router.post("/", async (req, res) => {
    try {
      const body = req.body;
      const fullPath = safePath(projectRoot, body.filePath);
      let source = await fs7.readFile(fullPath, "utf-8");
      const parser = await getParser();
      if (body.type === "class") {
        const result = replaceClassInElement(source, parser, {
          eid: body.eid,
          oldClass: body.oldClass,
          newClass: body.newClass,
          tag: body.tag,
          textHint: body.textHint,
          lineHint: body.lineHint
        });
        source = result.source;
        await fs7.writeFile(fullPath, source, "utf-8");
        res.json({ ok: true, eid: result.eid });
      } else if (body.type === "prop") {
        source = replacePropInElement(
          source,
          parser,
          body.componentName,
          body.propName,
          body.propValue,
          body.lineHint,
          body.textHint
        );
        await fs7.writeFile(fullPath, source, "utf-8");
        res.json({ ok: true });
      } else if (body.type === "addClass") {
        const result = addClassToElement(source, parser, {
          eid: body.eid,
          newClass: body.newClass,
          tag: body.tag,
          textHint: body.textHint,
          lineHint: body.lineHint
        });
        source = result.source;
        await fs7.writeFile(fullPath, source, "utf-8");
        res.json({ ok: true, eid: result.eid });
      } else if (body.type === "instanceOverride") {
        const result = overrideClassOnInstance(source, parser, {
          eid: body.eid,
          componentName: body.componentName,
          oldClass: body.oldClass,
          newClass: body.newClass,
          textHint: body.textHint,
          lineHint: body.lineHint
        });
        source = result.source;
        await fs7.writeFile(fullPath, source, "utf-8");
        res.json({ ok: true, eid: result.eid });
      } else if (body.type === "markElement") {
        const result = markElementInSource(source, parser, {
          componentName: body.componentName,
          tag: body.tag,
          textHint: body.textHint,
          lineHint: body.lineHint
        });
        if (result.modified) {
          await fs7.writeFile(fullPath, result.source, "utf-8");
        }
        res.json({ ok: true, eid: result.eid });
      } else if (body.type === "removeMarker") {
        source = removeMarker(source, body.eid);
        await fs7.writeFile(fullPath, source, "utf-8");
        res.json({ ok: true });
      }
    } catch (err) {
      console.error("Element write error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  return router;
}
async function cleanupStaleMarkers(projectRoot) {
  const ignore = /* @__PURE__ */ new Set(["node_modules", ".next", "dist", ".git"]);
  const exts = /* @__PURE__ */ new Set([".tsx", ".jsx", ".html"]);
  async function walk(dir) {
    let entries;
    try {
      entries = await fs7.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignore.has(entry.name)) continue;
      const full = dir + "/" + entry.name;
      if (entry.isDirectory()) {
        await walk(full);
      } else if (exts.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
        const content = await fs7.readFile(full, "utf-8");
        if (content.includes("data-studio-eid=")) {
          const cleaned = content.replace(/ data-studio-eid="[^"]*"/g, "");
          await fs7.writeFile(full, cleaned, "utf-8");
        }
      }
    }
  }
  await walk(projectRoot);
}
function generateEid() {
  return "s" + crypto.randomBytes(4).toString("hex");
}
function removeMarker(source, eid) {
  return source.replace(
    new RegExp(` data-studio-eid="${eid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "g"),
    ""
  );
}
function getTagName(node) {
  if (n.JSXIdentifier.check(node.name)) {
    return node.name.name;
  }
  if (n.JSXMemberExpression.check(node.name)) {
    return getTagName({ name: node.name.object }) + "." + node.name.property.name;
  }
  return "";
}
function findAttr(openingElement, attrName) {
  for (const attr of openingElement.attributes) {
    if (n.JSXAttribute.check(attr) && n.JSXIdentifier.check(attr.name) && attr.name.name === attrName) {
      return attr;
    }
  }
  return null;
}
function findElementAtLine(ast, lineHint) {
  let best = null;
  let bestDist = Infinity;
  visit(ast, {
    visitJSXOpeningElement(path10) {
      const loc = path10.node.loc;
      if (loc) {
        const dist = Math.abs(loc.start.line - lineHint);
        if (dist < bestDist) {
          bestDist = dist;
          best = path10;
        }
      }
      this.traverse(path10);
    }
  });
  return bestDist <= 3 ? best : null;
}
function findElementByEid(ast, eid) {
  let found = null;
  visit(ast, {
    visitJSXOpeningElement(path10) {
      const attr = findAttr(path10.node, "data-studio-eid");
      if (attr) {
        const val = n.StringLiteral.check(attr.value) || n.Literal.check(attr.value) ? attr.value.value : null;
        if (val === eid) {
          found = path10;
          return false;
        }
      }
      this.traverse(path10);
    }
  });
  return found;
}
function findElementByScoring(ast, opts) {
  let pascalComponent = null;
  if (opts.componentName) {
    pascalComponent = opts.componentName.includes("-") ? opts.componentName.replace(/(^|-)([a-z])/g, (_m, _sep, c) => c.toUpperCase()) : opts.componentName;
  }
  let bestPath = null;
  let bestScore = -Infinity;
  visit(ast, {
    visitJSXOpeningElement(path10) {
      let score = 0;
      const tagName = getTagName(path10.node);
      if (pascalComponent && tagName === pascalComponent) {
        score += 10;
      } else if (opts.tag && tagName.toLowerCase() === opts.tag.toLowerCase()) {
        score += 3;
      }
      if (opts.textHint && opts.textHint.length >= 2) {
        const parent = path10.parent;
        if (n.JSXElement.check(parent.node)) {
          for (const child of parent.node.children) {
            if (n.JSXText.check(child) && child.value.includes(opts.textHint)) {
              score += 15;
              break;
            }
          }
        }
      }
      if (score > 0 && score > bestScore) {
        bestScore = score;
        bestPath = path10;
      }
      this.traverse(path10);
    }
  });
  return bestPath;
}
function findElement(ast, opts) {
  if (opts.eid) {
    const found = findElementByEid(ast, opts.eid);
    if (found) return found;
  }
  if (opts.lineHint !== void 0) {
    const found = findElementAtLine(ast, opts.lineHint);
    if (found) return found;
  }
  return findElementByScoring(ast, opts);
}
function addEidAttribute(openingElement, eid) {
  openingElement.attributes.push(
    b.jsxAttribute(
      b.jsxIdentifier("data-studio-eid"),
      b.stringLiteral(eid)
    )
  );
}
function replaceClassInAttr(openingElement, oldClass, newClass) {
  const attr = findAttr(openingElement, "className");
  if (!attr) return false;
  if (n.StringLiteral.check(attr.value) || n.Literal.check(attr.value)) {
    const val = attr.value.value;
    const regex = classBoundaryRegex(oldClass, "g");
    if (regex.test(val)) {
      attr.value = b.stringLiteral(val.replace(classBoundaryRegex(oldClass, "g"), newClass));
      return true;
    }
    return false;
  }
  if (n.JSXExpressionContainer.check(attr.value)) {
    return replaceClassInExpression(attr.value.expression, oldClass, newClass);
  }
  return false;
}
function replaceClassInExpression(expr, oldClass, newClass) {
  if (n.StringLiteral.check(expr) || n.Literal.check(expr)) {
    if (typeof expr.value === "string") {
      const regex = classBoundaryRegex(oldClass);
      if (regex.test(expr.value)) {
        expr.value = expr.value.replace(classBoundaryRegex(oldClass, "g"), newClass);
        return true;
      }
    }
    return false;
  }
  if (n.TemplateLiteral.check(expr)) {
    for (const quasi of expr.quasis) {
      const regex = classBoundaryRegex(oldClass);
      if (regex.test(quasi.value.raw)) {
        quasi.value = {
          raw: quasi.value.raw.replace(classBoundaryRegex(oldClass, "g"), newClass),
          cooked: (quasi.value.cooked || quasi.value.raw).replace(classBoundaryRegex(oldClass, "g"), newClass)
        };
        return true;
      }
    }
    return false;
  }
  if (n.CallExpression.check(expr)) {
    for (const arg of expr.arguments) {
      if (replaceClassInExpression(arg, oldClass, newClass)) return true;
    }
    return false;
  }
  if (n.ConditionalExpression.check(expr)) {
    if (replaceClassInExpression(expr.consequent, oldClass, newClass)) return true;
    if (replaceClassInExpression(expr.alternate, oldClass, newClass)) return true;
    return false;
  }
  if (n.LogicalExpression.check(expr)) {
    if (replaceClassInExpression(expr.left, oldClass, newClass)) return true;
    if (replaceClassInExpression(expr.right, oldClass, newClass)) return true;
    return false;
  }
  if (n.ArrayExpression.check(expr)) {
    for (const el of expr.elements) {
      if (el && replaceClassInExpression(el, oldClass, newClass)) return true;
    }
    return false;
  }
  return false;
}
function appendClassToAttr(openingElement, newClass) {
  const attr = findAttr(openingElement, "className");
  if (!attr) return false;
  if (n.StringLiteral.check(attr.value) || n.Literal.check(attr.value)) {
    const val = attr.value.value;
    attr.value = b.stringLiteral(val + " " + newClass);
    return true;
  }
  if (n.JSXExpressionContainer.check(attr.value)) {
    return appendClassToExpression(attr.value.expression, newClass);
  }
  return false;
}
function appendClassToExpression(expr, newClass) {
  if (n.StringLiteral.check(expr) || n.Literal.check(expr)) {
    if (typeof expr.value === "string") {
      expr.value = expr.value + " " + newClass;
      return true;
    }
    return false;
  }
  if (n.TemplateLiteral.check(expr)) {
    const last = expr.quasis[expr.quasis.length - 1];
    if (last) {
      last.value = {
        raw: last.value.raw + " " + newClass,
        cooked: (last.value.cooked || last.value.raw) + " " + newClass
      };
      return true;
    }
    return false;
  }
  if (n.CallExpression.check(expr)) {
    for (const arg of expr.arguments) {
      if ((n.StringLiteral.check(arg) || n.Literal.check(arg)) && typeof arg.value === "string") {
        arg.value = arg.value + " " + newClass;
        return true;
      }
    }
    return false;
  }
  return false;
}
function addClassNameAttr(openingElement, className) {
  openingElement.attributes.push(
    b.jsxAttribute(
      b.jsxIdentifier("className"),
      b.stringLiteral(className)
    )
  );
}
function classBoundaryRegex(cls, flags = "") {
  const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<=^|[\\s"'\`])${escaped}(?=$|[\\s"'\`])`, flags);
}
function markElementInSource(source, parser, opts) {
  const ast = parseSource(source, parser);
  const elementPath = findElement(ast, {
    tag: opts.tag,
    textHint: opts.textHint,
    componentName: opts.componentName,
    lineHint: opts.lineHint
  });
  if (!elementPath) {
    const eid2 = generateEid();
    return { source, eid: eid2, modified: false };
  }
  const existingMarker = findAttr(elementPath.node, "data-studio-eid");
  if (existingMarker) {
    const val = n.StringLiteral.check(existingMarker.value) || n.Literal.check(existingMarker.value) ? existingMarker.value.value : null;
    if (val) return { source, eid: val, modified: false };
  }
  const eid = generateEid();
  addEidAttribute(elementPath.node, eid);
  return { source: printSource(ast), eid, modified: true };
}
function replaceClassInElement(source, parser, opts) {
  const ast = parseSource(source, parser);
  const elementPath = findElement(ast, opts);
  if (!elementPath) {
    throw new Error(`Could not find element with class "${opts.oldClass}" in source`);
  }
  const replaced = replaceClassInAttr(elementPath.node, opts.oldClass, opts.newClass);
  if (!replaced) {
    throw new Error(`Class "${opts.oldClass}" not found on the identified element`);
  }
  let eid = opts.eid || "";
  if (!eid) {
    const existingMarker = findAttr(elementPath.node, "data-studio-eid");
    if (existingMarker) {
      eid = existingMarker.value.value;
    } else {
      eid = generateEid();
      addEidAttribute(elementPath.node, eid);
    }
  }
  return { source: printSource(ast), eid };
}
function addClassToElement(source, parser, opts) {
  const ast = parseSource(source, parser);
  const elementPath = findElement(ast, opts);
  if (!elementPath) {
    throw new Error("Could not find target element in source");
  }
  const classAttr = findAttr(elementPath.node, "className");
  if (classAttr) {
    const appended = appendClassToAttr(elementPath.node, opts.newClass);
    if (!appended) {
      throw new Error("Could not append class to className attribute");
    }
  } else {
    addClassNameAttr(elementPath.node, opts.newClass);
  }
  let eid = opts.eid || "";
  if (!eid) {
    const existingMarker = findAttr(elementPath.node, "data-studio-eid");
    if (existingMarker) {
      eid = existingMarker.value.value;
    } else {
      eid = generateEid();
      addEidAttribute(elementPath.node, eid);
    }
  }
  return { source: printSource(ast), eid };
}
function overrideClassOnInstance(source, parser, opts) {
  const ast = parseSource(source, parser);
  const elementPath = findElement(ast, {
    eid: opts.eid,
    lineHint: opts.lineHint,
    componentName: opts.componentName,
    textHint: opts.textHint
  });
  if (!elementPath) {
    throw new Error(`Component <${opts.componentName}> not found`);
  }
  const classAttr = findAttr(elementPath.node, "className");
  if (classAttr) {
    const replaced = replaceClassInAttr(elementPath.node, opts.oldClass, opts.newClass);
    if (!replaced) {
      appendClassToAttr(elementPath.node, opts.newClass);
    }
  } else {
    addClassNameAttr(elementPath.node, opts.newClass);
  }
  let eid = opts.eid || "";
  if (!eid) {
    const existingMarker = findAttr(elementPath.node, "data-studio-eid");
    if (existingMarker) {
      eid = existingMarker.value.value;
    } else {
      eid = generateEid();
      addEidAttribute(elementPath.node, eid);
    }
  }
  return { source: printSource(ast), eid };
}
function replacePropInElement(source, parser, componentName, propName, propValue, lineHint, textHint) {
  const ast = parseSource(source, parser);
  const elementPath = findElement(ast, {
    lineHint,
    textHint,
    componentName
  });
  if (!elementPath) {
    throw new Error(`Component <${componentName}> not found`);
  }
  const existingProp = findAttr(elementPath.node, propName);
  if (existingProp) {
    existingProp.value = b.stringLiteral(propValue);
  } else {
    elementPath.node.attributes.push(
      b.jsxAttribute(
        b.jsxIdentifier(propName),
        b.stringLiteral(propValue)
      )
    );
  }
  return printSource(ast);
}

// src/server/scanner/index.ts
import { Router as Router4 } from "express";
import fs10 from "fs/promises";
import path8 from "path";

// ../core/src/scanner/scan-tokens.ts
import fs8 from "fs/promises";
import path6 from "path";
async function scanTokens(projectRoot, framework) {
  if (framework.cssFiles.length === 0) {
    return { tokens: [], cssFilePath: "", groups: {} };
  }
  const cssFilePath = framework.cssFiles[0];
  const fullPath = path6.join(projectRoot, cssFilePath);
  const css = await fs8.readFile(fullPath, "utf-8");
  const rootTokens = parseBlock(css, ":root");
  const darkTokens = parseBlock(css, ".dark");
  const tokenMap = /* @__PURE__ */ new Map();
  for (const [name, value] of rootTokens) {
    const def = {
      name,
      category: categorizeToken(name, value),
      group: getTokenGroup(name),
      lightValue: value,
      darkValue: darkTokens.get(name) || "",
      colorFormat: detectColorFormat(value)
    };
    tokenMap.set(name, def);
  }
  for (const [name, value] of darkTokens) {
    if (!tokenMap.has(name)) {
      tokenMap.set(name, {
        name,
        category: categorizeToken(name, value),
        group: getTokenGroup(name),
        lightValue: "",
        darkValue: value,
        colorFormat: detectColorFormat(value)
      });
    }
  }
  const tokens = Array.from(tokenMap.values());
  const groups = {};
  for (const token of tokens) {
    if (!groups[token.group]) groups[token.group] = [];
    groups[token.group].push(token);
  }
  return { tokens, cssFilePath, groups };
}
function parseBlock(css, selector) {
  const tokens = /* @__PURE__ */ new Map();
  const selectorEscaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockStart = css.search(new RegExp(`${selectorEscaped}\\s*\\{`));
  if (blockStart === -1) return tokens;
  const openBrace = css.indexOf("{", blockStart);
  let depth = 1;
  let pos = openBrace + 1;
  while (depth > 0 && pos < css.length) {
    if (css[pos] === "{") depth++;
    if (css[pos] === "}") depth--;
    pos++;
  }
  const block = css.slice(openBrace + 1, pos - 1);
  const propRegex = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = propRegex.exec(block)) !== null) {
    tokens.set(match[1], match[2].trim());
  }
  return tokens;
}
function categorizeToken(name, value) {
  if (value.includes("oklch") || value.includes("hsl") || value.includes("rgb") || value.startsWith("#")) {
    return "color";
  }
  if (name.includes("radius")) return "radius";
  if (name.includes("shadow")) return "shadow";
  if (name.includes("spacing")) return "spacing";
  if (name.includes("font") || name.includes("text") || name.includes("tracking") || name.includes("leading")) {
    return "typography";
  }
  if (value.endsWith("rem") || value.endsWith("px") || value.endsWith("em")) {
    if (name.includes("radius")) return "radius";
    return "spacing";
  }
  return "other";
}
function getTokenGroup(name) {
  const n2 = name.replace(/^--/, "");
  const scaleMatch = n2.match(/^([\w]+)-\d+$/);
  if (scaleMatch) return scaleMatch[1];
  const semanticPrefixes = [
    "primary",
    "secondary",
    "neutral",
    "success",
    "destructive",
    "warning"
  ];
  for (const prefix of semanticPrefixes) {
    if (n2 === prefix || n2.startsWith(`${prefix}-`)) return prefix;
  }
  if (["background", "foreground", "card", "card-foreground", "popover", "popover-foreground"].includes(n2)) {
    return "surface";
  }
  if (["border", "input", "ring", "muted", "muted-foreground", "accent", "accent-foreground"].includes(n2)) {
    return "utility";
  }
  if (n2.startsWith("chart")) return "chart";
  if (n2.startsWith("sidebar")) return "sidebar";
  if (n2.startsWith("radius")) return "radius";
  if (n2.startsWith("shadow")) return "shadow";
  return "other";
}
function detectColorFormat(value) {
  if (value.includes("oklch")) return "oklch";
  if (value.includes("hsl")) return "hsl";
  if (value.includes("rgb")) return "rgb";
  if (value.startsWith("#")) return "hex";
  return null;
}

// src/server/scanner/scan-components.ts
import fs9 from "fs/promises";
import path7 from "path";
async function scanComponents(projectRoot) {
  const componentDirs = [
    "components/ui",
    "src/components/ui"
  ];
  let componentDir = "";
  for (const dir of componentDirs) {
    try {
      await fs9.access(path7.join(projectRoot, dir));
      componentDir = dir;
      break;
    } catch {
    }
  }
  if (!componentDir) {
    return { components: [] };
  }
  const fullDir = path7.join(projectRoot, componentDir);
  const files = await fs9.readdir(fullDir);
  const tsxFiles = files.filter((f) => f.endsWith(".tsx"));
  const components = [];
  for (const file of tsxFiles) {
    const filePath = path7.join(componentDir, file);
    const source = await fs9.readFile(path7.join(projectRoot, filePath), "utf-8");
    const entry = parseComponent(source, filePath);
    if (entry) {
      components.push(entry);
    }
  }
  return { components };
}
function parseComponent(source, filePath) {
  const cvaMatch = source.match(
    /const\s+(\w+)\s*=\s*cva\(\s*(["'`])([\s\S]*?)\2\s*,\s*\{/
  );
  const slotMatch = source.match(/data-slot=["'](\w+)["']/);
  if (!slotMatch) return null;
  const dataSlot = slotMatch[1];
  const name = dataSlot.charAt(0).toUpperCase() + dataSlot.slice(1);
  if (!cvaMatch) {
    return {
      name,
      filePath,
      dataSlot,
      baseClasses: "",
      variants: [],
      tokenReferences: extractTokenReferences(source)
    };
  }
  const baseClasses = cvaMatch[3].trim();
  const variants = parseVariants(source);
  const tokenReferences = extractTokenReferences(source);
  return {
    name,
    filePath,
    dataSlot,
    baseClasses,
    variants,
    tokenReferences
  };
}
function parseVariants(source) {
  const dimensions = [];
  const variantsBlock = source.match(/variants\s*:\s*\{([\s\S]*?)\}\s*,?\s*defaultVariants/);
  if (!variantsBlock) return dimensions;
  const block = variantsBlock[1];
  const dimRegex = /(\w+)\s*:\s*\{([^}]+)\}/g;
  let dimMatch;
  while ((dimMatch = dimRegex.exec(block)) !== null) {
    const dimName = dimMatch[1];
    const dimBody = dimMatch[2];
    const options = [];
    const classes = {};
    const optRegex = /["']?([\w-]+)["']?\s*:\s*\n?\s*["'`]([^"'`]*)["'`]/g;
    let optMatch;
    while ((optMatch = optRegex.exec(dimBody)) !== null) {
      options.push(optMatch[1]);
      classes[optMatch[1]] = optMatch[2].trim();
    }
    const defaultMatch = source.match(
      new RegExp(`${dimName}\\s*:\\s*["'](\\w+)["']`, "g")
    );
    const defaultValues = defaultMatch || [];
    const defaultVariantsSection = source.match(
      /defaultVariants\s*:\s*\{([^}]+)\}/
    );
    let defaultVal = options[0] || "";
    if (defaultVariantsSection) {
      const defMatch = defaultVariantsSection[1].match(
        new RegExp(`${dimName}\\s*:\\s*["'](\\w+)["']`)
      );
      if (defMatch) defaultVal = defMatch[1];
    }
    if (options.length > 0) {
      dimensions.push({
        name: dimName,
        options,
        default: defaultVal,
        classes
      });
    }
  }
  return dimensions;
}
function extractTokenReferences(source) {
  const tokens = /* @__PURE__ */ new Set();
  const classStrings = source.match(/["'`][^"'`]*["'`]/g) || [];
  for (const str of classStrings) {
    const tokenPattern = /(?:bg|text|border|ring|shadow|outline|fill|stroke)-([a-z][\w-]*(?:\/\d+)?)/g;
    let match;
    while ((match = tokenPattern.exec(str)) !== null) {
      const val = match[1];
      if (!val.match(/^\d/) && // not a number
      !["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "full", "none"].includes(val) && !val.startsWith("[")) {
        tokens.add(val.split("/")[0]);
      }
    }
  }
  return Array.from(tokens);
}

// src/server/scanner/index.ts
var cachedScan = null;
async function runScan(projectRoot) {
  const framework = await detectFramework(projectRoot);
  const [tokens, components] = await Promise.all([
    scanTokens(projectRoot, framework),
    scanComponents(projectRoot)
  ]);
  cachedScan = { framework, tokens, components };
  return cachedScan;
}
function createStudioScanRouter(projectRoot) {
  const router = Router4();
  runScan(projectRoot).then(() => {
    console.log("  Project scanned successfully");
  }).catch((err) => {
    console.error("  Scan error:", err.message);
  });
  router.get("/all", async (_req, res) => {
    try {
      const result = cachedScan || await runScan(projectRoot);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  router.get("/tokens", async (_req, res) => {
    try {
      const result = cachedScan || await runScan(projectRoot);
      res.json(result.tokens);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  router.get("/components", async (_req, res) => {
    try {
      const result = cachedScan || await runScan(projectRoot);
      res.json(result.components);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  router.post("/rescan", async (_req, res) => {
    try {
      const result = await runScan(projectRoot);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  router.get("/resolve-route", async (req, res) => {
    try {
      const routePath = req.query.path || "/";
      const scan = cachedScan || await runScan(projectRoot);
      const appDir = scan.framework.appDir;
      const result = await resolveRouteToFile(projectRoot, appDir, routePath);
      res.json({ filePath: result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  return router;
}
var PAGE_EXTENSIONS = [".tsx", ".jsx", ".ts", ".js"];
async function resolveRouteToFile(projectRoot, appDir, routePath) {
  const segments = routePath === "/" ? [] : routePath.replace(/^\//, "").replace(/\/$/, "").split("/");
  const absAppDir = path8.join(projectRoot, appDir);
  const result = await matchSegments(absAppDir, segments, 0);
  if (result) {
    return path8.relative(projectRoot, result);
  }
  return null;
}
async function findPageFile(dir) {
  for (const ext of PAGE_EXTENSIONS) {
    const candidate = path8.join(dir, `page${ext}`);
    try {
      await fs10.access(candidate);
      return candidate;
    } catch {
    }
  }
  for (const ext of PAGE_EXTENSIONS) {
    const candidate = path8.join(dir, `index${ext}`);
    try {
      await fs10.access(candidate);
      return candidate;
    } catch {
    }
  }
  return null;
}
async function listDirs(dir) {
  try {
    const entries = await fs10.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}
async function matchSegments(currentDir, segments, index) {
  if (index >= segments.length) {
    const page = await findPageFile(currentDir);
    if (page) return page;
    const dirs2 = await listDirs(currentDir);
    for (const d of dirs2) {
      if (d.startsWith("(") && d.endsWith(")")) {
        const page2 = await findPageFile(path8.join(currentDir, d));
        if (page2) return page2;
      }
    }
    return null;
  }
  const segment = segments[index];
  const dirs = await listDirs(currentDir);
  if (dirs.includes(segment)) {
    const result = await matchSegments(path8.join(currentDir, segment), segments, index + 1);
    if (result) return result;
  }
  for (const d of dirs) {
    if (d.startsWith("(") && d.endsWith(")")) {
      const result = await matchSegments(path8.join(currentDir, d), segments, index);
      if (result) return result;
    }
  }
  for (const d of dirs) {
    if (d.startsWith("[") && d.endsWith("]") && !d.startsWith("[...") && !d.startsWith("[[")) {
      const result = await matchSegments(path8.join(currentDir, d), segments, index + 1);
      if (result) return result;
    }
  }
  for (const d of dirs) {
    if (d.startsWith("[...") && d.endsWith("]")) {
      const page = await findPageFile(path8.join(currentDir, d));
      if (page) return page;
    }
  }
  for (const d of dirs) {
    if (d.startsWith("[[...") && d.endsWith("]]")) {
      const page = await findPageFile(path8.join(currentDir, d));
      if (page) return page;
    }
  }
  return null;
}

// src/server/index.ts
var __dirname = path9.dirname(fileURLToPath(import.meta.url));
var require2 = createRequire(import.meta.url);
function findPackageRoot(dir) {
  let d = dir;
  while (d !== path9.dirname(d)) {
    if (fs11.existsSync(path9.join(d, "package.json"))) return d;
    d = path9.dirname(d);
  }
  return dir;
}
var packageRoot = findPackageRoot(__dirname);
var isDev = __dirname.includes(path9.sep + "src" + path9.sep);
function resolveInjectScript() {
  const compiledInject = path9.join(packageRoot, "dist/inject/selection.js");
  if (fs11.existsSync(compiledInject)) return compiledInject;
  try {
    const corePkg = require2.resolve("@designtools/core/package.json");
    const coreRoot = path9.dirname(corePkg);
    const coreInject = path9.join(coreRoot, "src/inject/selection.ts");
    if (fs11.existsSync(coreInject)) return coreInject;
  } catch {
  }
  const monorepoInject = path9.join(packageRoot, "../core/src/inject/selection.ts");
  if (fs11.existsSync(monorepoInject)) return monorepoInject;
  throw new Error(
    "Could not find inject script (selection.ts). Ensure @designtools/core is installed."
  );
}
async function startStudioServer(preflight) {
  const clientRoot = path9.join(packageRoot, "src/client");
  const clientDistRoot = isDev ? void 0 : path9.join(packageRoot, "dist/client");
  const actualInjectPath = resolveInjectScript();
  const { app, wss, projectRoot } = await createToolServer({
    targetPort: preflight.targetPort,
    toolPort: preflight.toolPort,
    clientRoot,
    clientDistRoot,
    injectScriptPath: actualInjectPath,
    setupRoutes: (app2, projectRoot2) => {
      app2.use("/api/tokens", createTokensRouter(projectRoot2));
      app2.use("/api/component", createComponentRouter(projectRoot2));
      app2.use("/api/element", createElementRouter(projectRoot2));
      app2.use("/scan", createStudioScanRouter(projectRoot2));
    }
  });
  cleanupStaleMarkers(projectRoot).catch(() => {
  });
  return { app, wss, projectRoot };
}

// src/cli.ts
bootstrap({
  name: "Design Engineer Studio",
  defaultTargetPort: 3e3,
  defaultToolPort: 4400
}).then((result) => {
  startStudioServer(result).catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
});
