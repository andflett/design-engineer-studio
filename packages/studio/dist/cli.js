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
  try {
    await fetch(targetUrl, { signal: AbortSignal.timeout(2e3) });
    console.log(`  ${green("\u2713")} Target         ${targetUrl}`);
  } catch {
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
      server: { middlewareMode: true },
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
function createElementRouter(projectRoot) {
  const router = Router3();
  router.post("/", async (req, res) => {
    try {
      const body = req.body;
      const fullPath = safePath(projectRoot, body.filePath);
      let source = await fs7.readFile(fullPath, "utf-8");
      if (body.type === "class") {
        source = replaceClassInElement(
          source,
          body.classIdentifier,
          body.oldClass,
          body.newClass,
          body.lineHint
        );
      } else if (body.type === "prop") {
        source = replacePropInElement(
          source,
          body.componentName,
          body.propName,
          body.propValue,
          body.lineHint,
          body.textHint
        );
      } else if (body.type === "addClass") {
        source = addClassToElement(
          source,
          body.classIdentifier,
          body.newClass,
          body.lineHint
        );
      }
      await fs7.writeFile(fullPath, source, "utf-8");
      res.json({ ok: true });
    } catch (err) {
      console.error("Element write error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  return router;
}
function replaceClassInElement(source, classIdentifier, oldClass, newClass, lineHint) {
  const lines = source.split("\n");
  const searchStart = lineHint ? Math.max(0, lineHint - 5) : 0;
  const searchEnd = lineHint ? Math.min(lines.length, lineHint + 5) : lines.length;
  let targetLineIdx = -1;
  for (let i = searchStart; i < searchEnd; i++) {
    if (lines[i].includes(classIdentifier)) {
      targetLineIdx = i;
      break;
    }
  }
  if (targetLineIdx === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(classIdentifier)) {
        targetLineIdx = i;
        break;
      }
    }
  }
  if (targetLineIdx === -1) {
    throw new Error(
      `Could not find element with class identifier "${classIdentifier}"`
    );
  }
  const oldEscaped = oldClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${oldEscaped}\\b`, "g");
  for (let i = Math.max(0, targetLineIdx - 2); i <= Math.min(lines.length - 1, targetLineIdx + 2); i++) {
    if (regex.test(lines[i])) {
      lines[i] = lines[i].replace(regex, newClass);
      return lines.join("\n");
    }
  }
  throw new Error(`Class "${oldClass}" not found near the identified element`);
}
function replacePropInElement(source, componentName, propName, propValue, lineHint, textHint) {
  const lines = source.split("\n");
  const candidateLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`<${componentName}`)) {
      candidateLines.push(i);
    }
  }
  if (candidateLines.length === 0) {
    throw new Error(`Component <${componentName}> not found`);
  }
  let componentLineIdx = candidateLines[0];
  if (textHint && candidateLines.length > 1) {
    for (const lineIdx of candidateLines) {
      const nearby = lines.slice(lineIdx, Math.min(lineIdx + 3, lines.length)).join(" ");
      if (nearby.includes(textHint)) {
        componentLineIdx = lineIdx;
        break;
      }
    }
  }
  if (lineHint && candidateLines.length > 1) {
    let closest = candidateLines[0];
    for (const c of candidateLines) {
      if (Math.abs(c - lineHint) < Math.abs(closest - lineHint)) closest = c;
    }
    componentLineIdx = closest;
  }
  let tagEnd = componentLineIdx;
  let depth = 0;
  for (let i = componentLineIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "<") depth++;
      if (ch === ">") {
        depth--;
        if (depth <= 0) {
          tagEnd = i;
          break;
        }
      }
    }
    if (depth <= 0) break;
  }
  const propRegex = new RegExp(`${propName}=["']([^"']*)["']`);
  for (let i = componentLineIdx; i <= tagEnd; i++) {
    if (propRegex.test(lines[i])) {
      lines[i] = lines[i].replace(propRegex, `${propName}="${propValue}"`);
      return lines.join("\n");
    }
  }
  const componentTag = lines[componentLineIdx];
  const insertPos = componentTag.indexOf(`<${componentName}`) + `<${componentName}`.length;
  lines[componentLineIdx] = componentTag.slice(0, insertPos) + ` ${propName}="${propValue}"` + componentTag.slice(insertPos);
  return lines.join("\n");
}
function addClassToElement(source, classIdentifier, newClass, lineHint) {
  const lines = source.split("\n");
  const searchStart = lineHint ? Math.max(0, lineHint - 5) : 0;
  const searchEnd = lineHint ? Math.min(lines.length, lineHint + 5) : lines.length;
  let targetLineIdx = -1;
  for (let i = searchStart; i < searchEnd; i++) {
    if (lines[i].includes(classIdentifier)) {
      targetLineIdx = i;
      break;
    }
  }
  if (targetLineIdx === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(classIdentifier)) {
        targetLineIdx = i;
        break;
      }
    }
  }
  if (targetLineIdx === -1) {
    throw new Error(`Could not find element with class identifier "${classIdentifier}"`);
  }
  const classNameRegex = /className="([^"]*)"/;
  for (let i = Math.max(0, targetLineIdx - 2); i <= Math.min(lines.length - 1, targetLineIdx + 2); i++) {
    const match = lines[i].match(classNameRegex);
    if (match) {
      const existingClasses = match[1];
      lines[i] = lines[i].replace(
        `className="${existingClasses}"`,
        `className="${existingClasses} ${newClass}"`
      );
      return lines.join("\n");
    }
  }
  throw new Error(`Could not find className near the identified element`);
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
  const n = name.replace(/^--/, "");
  const scaleMatch = n.match(/^([\w]+)-\d+$/);
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
    if (n === prefix || n.startsWith(`${prefix}-`)) return prefix;
  }
  if (["background", "foreground", "card", "card-foreground", "popover", "popover-foreground"].includes(n)) {
    return "surface";
  }
  if (["border", "input", "ring", "muted", "muted-foreground", "accent", "accent-foreground"].includes(n)) {
    return "utility";
  }
  if (n.startsWith("chart")) return "chart";
  if (n.startsWith("sidebar")) return "sidebar";
  if (n.startsWith("radius")) return "radius";
  if (n.startsWith("shadow")) return "shadow";
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
      const segments = routePath === "/" ? [] : routePath.replace(/^\//, "").split("/");
      const dir = path8.join(appDir, ...segments);
      const candidates = [
        path8.join(dir, "page.tsx"),
        path8.join(dir, "page.jsx"),
        path8.join(dir, "page.ts"),
        path8.join(dir, "page.js"),
        // Pages Router / Vite
        path8.join(dir, "index.tsx"),
        path8.join(dir, "index.jsx")
      ];
      if (segments.length > 0) {
        const last = segments[segments.length - 1];
        const parent = segments.slice(0, -1);
        candidates.push(
          path8.join(appDir, ...parent, `${last}.tsx`),
          path8.join(appDir, ...parent, `${last}.jsx`)
        );
      }
      for (const candidate of candidates) {
        try {
          await fs10.access(path8.join(projectRoot, candidate));
          res.json({ filePath: candidate });
          return;
        } catch {
        }
      }
      res.json({ filePath: null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  return router;
}

// src/server/index.ts
var __dirname = path9.dirname(fileURLToPath(import.meta.url));
var require2 = createRequire(import.meta.url);
var packageRoot = fs11.existsSync(path9.join(__dirname, "../package.json")) ? path9.resolve(__dirname, "..") : path9.resolve(__dirname, "../..");
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
  const clientDistRoot = path9.join(packageRoot, "dist/client");
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
