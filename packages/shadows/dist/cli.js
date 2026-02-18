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
  console.log("");
  const pkgPath = path3.join(projectRoot, "package.json");
  if (!fs3.existsSync(pkgPath)) {
    console.log(`  ${red("\u2717")} No package.json found`);
    console.log(`    ${dim("Run this command from your project root.")}`);
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
  return { framework, styling, targetPort, toolPort, projectRoot };
}

// src/server/index.ts
import path9 from "path";
import fs10 from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";

// ../core/src/server/create-server.ts
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import httpProxy from "http-proxy";
import { WebSocketServer } from "ws";
import fs4 from "fs";
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
  const vite = await createViteServer({
    configFile: false,
    root: config.clientRoot,
    plugins: [react(), tailwindcss()],
    server: { middlewareMode: true },
    appType: "spa"
  });
  app.use(vite.middlewares);
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

// src/server/api/write-shadows.ts
import { Router } from "express";
import fs6 from "fs/promises";
import path5 from "path";

// src/server/scanner/presets/w3c-design-tokens.ts
import fs5 from "fs/promises";
import path4 from "path";
async function findDesignTokenFiles(projectRoot) {
  const candidates = [
    "tokens",
    "design-tokens",
    "src/tokens",
    "src/design-tokens",
    "styles/tokens",
    "."
  ];
  const found = [];
  for (const dir of candidates) {
    try {
      const fullDir = path4.join(projectRoot, dir);
      const entries = await fs5.readdir(fullDir);
      for (const entry of entries) {
        if (entry.endsWith(".tokens.json") || entry.endsWith(".tokens")) {
          found.push(path4.join(dir, entry));
        }
      }
    } catch {
    }
  }
  return found;
}
async function scanDesignTokenShadows(projectRoot, tokenFiles) {
  const files = tokenFiles || await findDesignTokenFiles(projectRoot);
  const tokens = [];
  for (const file of files) {
    try {
      const content = await fs5.readFile(path4.join(projectRoot, file), "utf-8");
      const parsed = JSON.parse(content);
      extractShadowTokens(parsed, [], file, tokens);
    } catch {
    }
  }
  return tokens;
}
function extractShadowTokens(obj, pathParts, filePath, results) {
  if (!obj || typeof obj !== "object") return;
  if (obj.$type === "shadow" && obj.$value !== void 0) {
    const tokenPath = pathParts.join(".");
    const name = pathParts[pathParts.length - 1] || tokenPath;
    results.push({
      name,
      value: obj.$value,
      cssValue: w3cShadowToCss(obj.$value),
      description: obj.$description,
      filePath,
      tokenPath
    });
    return;
  }
  const groupType = obj.$type;
  for (const [key, child] of Object.entries(obj)) {
    if (key.startsWith("$")) continue;
    if (child && typeof child === "object") {
      const childObj = child;
      if (groupType === "shadow" && childObj.$value !== void 0 && !childObj.$type) {
        const tokenPath = [...pathParts, key].join(".");
        results.push({
          name: key,
          value: childObj.$value,
          cssValue: w3cShadowToCss(childObj.$value),
          description: childObj.$description,
          filePath,
          tokenPath
        });
      } else {
        extractShadowTokens(childObj, [...pathParts, key], filePath, results);
      }
    }
  }
}
function w3cShadowToCss(value) {
  if (Array.isArray(value)) {
    return value.map(singleW3cToCss).join(", ");
  }
  return singleW3cToCss(value);
}
function singleW3cToCss(v) {
  const parts = [
    v.offsetX || "0px",
    v.offsetY || "0px",
    v.blur || "0px",
    v.spread || "0px",
    v.color || "rgb(0, 0, 0, 0.1)"
  ];
  return parts.join(" ");
}
function cssToW3cShadow(cssValue) {
  if (!cssValue || cssValue === "none") {
    return { offsetX: "0px", offsetY: "0px", blur: "0px", spread: "0px", color: "transparent" };
  }
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of cssValue) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  const shadows = parts.map(parseSingleCssToW3c).filter((s) => s !== null);
  if (shadows.length === 1) return shadows[0];
  return shadows;
}
function parseSingleCssToW3c(shadow) {
  const trimmed = shadow.trim();
  if (!trimmed) return null;
  const withoutInset = trimmed.replace(/^inset\s+/, "");
  let color = "rgb(0, 0, 0, 0.1)";
  let measurements = withoutInset;
  const colorPatterns = [
    /\s+((?:rgb|rgba|oklch|hsl|hsla)\([^)]+\))$/,
    /\s+(#[\da-fA-F]{3,8})$/,
    /\s+((?:black|white|transparent|currentColor))$/i
  ];
  for (const pattern of colorPatterns) {
    const match = measurements.match(pattern);
    if (match) {
      color = match[1];
      measurements = measurements.slice(0, match.index).trim();
      break;
    }
  }
  const dims = measurements.split(/\s+/);
  if (dims.length < 2) return null;
  return {
    offsetX: dims[0] || "0px",
    offsetY: dims[1] || "0px",
    blur: dims[2] || "0px",
    spread: dims[3] || "0px",
    color
  };
}
function buildDesignTokensJson(shadows) {
  const tokens = {};
  for (const shadow of shadows) {
    tokens[shadow.name] = {
      $type: "shadow",
      $value: cssToW3cShadow(shadow.value),
      ...shadow.description ? { $description: shadow.description } : {}
    };
  }
  return tokens;
}
async function writeDesignTokensFile(filePath, tokens) {
  const content = JSON.stringify(tokens, null, 2) + "\n";
  await fs5.writeFile(filePath, content, "utf-8");
}
async function updateDesignTokenShadow(filePath, tokenPath, newCssValue) {
  const content = await fs5.readFile(filePath, "utf-8");
  const tokens = JSON.parse(content);
  const pathParts = tokenPath.split(".");
  let current = tokens;
  for (let i = 0; i < pathParts.length - 1; i++) {
    current = current[pathParts[i]];
    if (!current) throw new Error(`Token path "${tokenPath}" not found`);
  }
  const lastKey = pathParts[pathParts.length - 1];
  if (!current[lastKey]) {
    throw new Error(`Token "${tokenPath}" not found`);
  }
  current[lastKey].$value = cssToW3cShadow(newCssValue);
  await fs5.writeFile(filePath, JSON.stringify(tokens, null, 2) + "\n", "utf-8");
}

// src/server/api/write-shadows.ts
function createShadowsRouter(projectRoot) {
  const router = Router();
  router.post("/", async (req, res) => {
    try {
      const { filePath, variableName, value, selector } = req.body;
      const fullPath = path5.join(projectRoot, filePath);
      if (selector === "scss") {
        let scss = await fs6.readFile(fullPath, "utf-8");
        scss = writeShadowToScss(scss, variableName, value);
        await fs6.writeFile(fullPath, scss, "utf-8");
      } else if (selector === "@theme") {
        let css = await fs6.readFile(fullPath, "utf-8");
        css = writeShadowToTheme(css, variableName, value);
        await fs6.writeFile(fullPath, css, "utf-8");
      } else {
        let css = await fs6.readFile(fullPath, "utf-8");
        css = writeShadowToSelector(css, selector, variableName, value);
        await fs6.writeFile(fullPath, css, "utf-8");
      }
      res.json({ ok: true, filePath, variableName, value });
    } catch (err) {
      console.error("Shadow write error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  router.post("/create", async (req, res) => {
    try {
      const { filePath, variableName, value, selector } = req.body;
      const fullPath = path5.join(projectRoot, filePath);
      if (selector === "scss") {
        let scss;
        try {
          scss = await fs6.readFile(fullPath, "utf-8");
        } catch {
          scss = "";
        }
        scss = addShadowToScss(scss, variableName, value);
        await fs6.writeFile(fullPath, scss, "utf-8");
      } else if (selector === "@theme") {
        let css = await fs6.readFile(fullPath, "utf-8");
        css = addShadowToTheme(css, variableName, value);
        await fs6.writeFile(fullPath, css, "utf-8");
      } else {
        let css = await fs6.readFile(fullPath, "utf-8");
        css = addShadowToSelector(css, selector, variableName, value);
        await fs6.writeFile(fullPath, css, "utf-8");
      }
      res.json({ ok: true, filePath, variableName, value });
    } catch (err) {
      console.error("Shadow create error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  router.post("/design-token", async (req, res) => {
    try {
      const { filePath, tokenPath, value } = req.body;
      const fullPath = path5.join(projectRoot, filePath);
      await updateDesignTokenShadow(fullPath, tokenPath, value);
      res.json({ ok: true, filePath, tokenPath, value });
    } catch (err) {
      console.error("Design token write error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  router.post("/export-tokens", async (req, res) => {
    try {
      const { filePath, shadows } = req.body;
      const fullPath = path5.join(projectRoot, filePath);
      const tokens = buildDesignTokensJson(shadows);
      await fs6.mkdir(path5.dirname(fullPath), { recursive: true });
      await writeDesignTokensFile(fullPath, tokens);
      res.json({ ok: true, filePath, tokenCount: shadows.length });
    } catch (err) {
      console.error("Token export error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  return router;
}
function writeShadowToSelector(css, selector, variableName, newValue) {
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
  const varEscaped = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenRegex = new RegExp(`(${varEscaped}\\s*:\\s*)([^;]+)(;)`, "g");
  if (!tokenRegex.test(block)) {
    throw new Error(`Variable "${variableName}" not found in "${selector}" block`);
  }
  block = block.replace(tokenRegex, `$1${newValue}$3`);
  return css.slice(0, openBrace + 1) + block + css.slice(blockEnd - 1);
}
function writeShadowToTheme(css, variableName, newValue) {
  const themeMatch = css.match(/@theme\s*\{/);
  if (!themeMatch) {
    throw new Error("No @theme block found in CSS file");
  }
  const blockStart = themeMatch.index;
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
  const varEscaped = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenRegex = new RegExp(`(${varEscaped}\\s*:\\s*)([^;]+)(;)`, "g");
  if (tokenRegex.test(block)) {
    block = block.replace(tokenRegex, `$1${newValue}$3`);
  } else {
    block = block.trimEnd() + `
  ${variableName}: ${newValue};
`;
  }
  return css.slice(0, openBrace + 1) + block + css.slice(blockEnd - 1);
}
function addShadowToSelector(css, selector, variableName, value) {
  const selectorEscaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockStart = css.search(new RegExp(`${selectorEscaped}\\s*\\{`));
  if (blockStart === -1) {
    return css + `
${selector} {
  ${variableName}: ${value};
}
`;
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
  const block = css.slice(openBrace + 1, blockEnd - 1);
  const newBlock = block.trimEnd() + `
  ${variableName}: ${value};
`;
  return css.slice(0, openBrace + 1) + newBlock + css.slice(blockEnd - 1);
}
function addShadowToTheme(css, variableName, value) {
  const themeMatch = css.match(/@theme\s*\{/);
  if (!themeMatch) {
    return css + `
@theme {
  ${variableName}: ${value};
}
`;
  }
  return writeShadowToTheme(css, variableName, value);
}
function writeShadowToScss(scss, variableName, newValue) {
  const varEscaped = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `(${varEscaped}\\s*:\\s*)(.+?)(\\s*(?:!default)?\\s*;)`,
    "g"
  );
  if (!regex.test(scss)) {
    throw new Error(`Sass variable "${variableName}" not found in SCSS file`);
  }
  return scss.replace(regex, `$1${newValue}$3`);
}
function addShadowToScss(scss, variableName, value) {
  const line = `${variableName}: ${value};
`;
  return scss.endsWith("\n") ? scss + line : scss + "\n" + line;
}

// src/server/scanner/index.ts
import { Router as Router2 } from "express";

// ../core/src/scanner/scan-tokens.ts
import fs7 from "fs/promises";
import path6 from "path";
async function scanTokens(projectRoot, framework) {
  if (framework.cssFiles.length === 0) {
    return { tokens: [], cssFilePath: "", groups: {} };
  }
  const cssFilePath = framework.cssFiles[0];
  const fullPath = path6.join(projectRoot, cssFilePath);
  const css = await fs7.readFile(fullPath, "utf-8");
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

// src/server/scanner/scan-shadows.ts
import fs9 from "fs/promises";
import path8 from "path";

// src/server/scanner/presets/tailwind.ts
var TAILWIND_SHADOW_PRESETS = [
  {
    name: "shadow-2xs",
    value: "0 1px rgb(0 0 0 / 0.05)"
  },
  {
    name: "shadow-xs",
    value: "0 1px 2px 0 rgb(0 0 0 / 0.05)"
  },
  {
    name: "shadow-sm",
    value: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"
  },
  {
    name: "shadow",
    value: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)"
  },
  {
    name: "shadow-md",
    value: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)"
  },
  {
    name: "shadow-lg",
    value: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"
  },
  {
    name: "shadow-xl",
    value: "0 25px 50px -12px rgb(0 0 0 / 0.25)"
  },
  {
    name: "shadow-2xl",
    value: "0 50px 100px -20px rgb(0 0 0 / 0.25)"
  },
  {
    name: "shadow-inner",
    value: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)"
  },
  {
    name: "shadow-none",
    value: "none"
  }
];

// src/server/scanner/presets/bootstrap.ts
import fs8 from "fs/promises";
import path7 from "path";
var BOOTSTRAP_SHADOW_PRESETS = [
  {
    name: "box-shadow-sm",
    value: "0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)"
  },
  {
    name: "box-shadow",
    value: "0 0.5rem 1rem rgba(0, 0, 0, 0.15)"
  },
  {
    name: "box-shadow-lg",
    value: "0 1rem 3rem rgba(0, 0, 0, 0.175)"
  },
  {
    name: "box-shadow-inset",
    value: "inset 0 1px 2px rgba(0, 0, 0, 0.075)"
  }
];
async function scanBootstrapScssOverrides(projectRoot, scssFiles) {
  const overrides = [];
  for (const file of scssFiles) {
    try {
      const content = await fs8.readFile(path7.join(projectRoot, file), "utf-8");
      const lines = content.split("\n");
      for (const line of lines) {
        const match = line.match(
          /\$(box-shadow(?:-sm|-lg|-inset)?)\s*:\s*(.+?)(?:\s*!default)?\s*;/
        );
        if (match) {
          const sassName = match[1];
          let value = match[2].trim();
          value = resolveBootstrapSassColors(value);
          overrides.push({
            name: sassName,
            value,
            sassVariable: `$${sassName}`,
            cssVariable: `--bs-${sassName}`,
            filePath: file
          });
        }
      }
    } catch {
    }
  }
  return overrides;
}
async function scanBootstrapCssOverrides(projectRoot, cssFiles) {
  const overrides = [];
  for (const file of cssFiles) {
    try {
      const content = await fs8.readFile(path7.join(projectRoot, file), "utf-8");
      const propRegex = /(--bs-box-shadow(?:-sm|-lg|-inset)?)\s*:\s*([^;]+);/g;
      let match;
      while ((match = propRegex.exec(content)) !== null) {
        const cssVar = match[1];
        const value = match[2].trim();
        const name = cssVar.replace(/^--bs-/, "");
        overrides.push({
          name,
          value,
          sassVariable: `$${name}`,
          cssVariable: cssVar,
          filePath: file
        });
      }
    } catch {
    }
  }
  return overrides;
}
function resolveBootstrapSassColors(value) {
  return value.replace(/rgba\(\$black,\s*([\d.]+)\)/g, "rgba(0, 0, 0, $1)").replace(/rgba\(\$white,\s*([\d.]+)\)/g, "rgba(255, 255, 255, $1)").replace(/\$black/g, "#000").replace(/\$white/g, "#fff");
}

// src/server/scanner/scan-shadows.ts
async function scanShadows(projectRoot, framework, styling) {
  const shadows = [];
  const cssFilePath = framework.cssFiles[0] || "";
  const customShadows = await scanCustomShadows(projectRoot, framework.cssFiles);
  const overriddenNames = new Set(customShadows.map((s) => s.name));
  if (styling.type === "tailwind-v4" || styling.type === "tailwind-v3") {
    addPresets(shadows, TAILWIND_SHADOW_PRESETS, overriddenNames);
  } else if (styling.type === "bootstrap") {
    await addBootstrapShadows(shadows, projectRoot, styling, overriddenNames);
  }
  const designTokenFiles = await findDesignTokenFiles(projectRoot);
  if (designTokenFiles.length > 0) {
    const tokenShadows = await scanDesignTokenShadows(projectRoot, designTokenFiles);
    for (const token of tokenShadows) {
      if (!overriddenNames.has(token.name)) {
        shadows.push({
          name: token.name,
          value: token.cssValue,
          source: "design-token",
          isOverridden: false,
          layers: parseShadowValue(token.cssValue),
          tokenPath: token.tokenPath,
          tokenFilePath: token.filePath
        });
      }
    }
  }
  for (const custom of customShadows) {
    shadows.push({
      ...custom,
      isOverridden: true
    });
  }
  shadows.sort((a, b) => {
    const order = { custom: 0, "design-token": 1, "framework-preset": 2 };
    const aOrder = order[a.source] ?? 3;
    const bOrder = order[b.source] ?? 3;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  });
  return { shadows, cssFilePath, stylingType: styling.type, designTokenFiles };
}
function addPresets(shadows, presets, overriddenNames) {
  for (const preset of presets) {
    if (!overriddenNames.has(preset.name)) {
      shadows.push({
        name: preset.name,
        value: preset.value,
        source: "framework-preset",
        isOverridden: false,
        layers: parseShadowValue(preset.value)
      });
    }
  }
}
async function addBootstrapShadows(shadows, projectRoot, styling, overriddenNames) {
  const scssOverrides = await scanBootstrapScssOverrides(projectRoot, styling.scssFiles);
  const scssOverrideMap = new Map(scssOverrides.map((o) => [o.name, o]));
  const cssOverrides = await scanBootstrapCssOverrides(projectRoot, styling.cssFiles);
  const cssOverrideMap = new Map(cssOverrides.map((o) => [o.name, o]));
  for (const preset of BOOTSTRAP_SHADOW_PRESETS) {
    if (overriddenNames.has(preset.name)) continue;
    const scssOverride = scssOverrideMap.get(preset.name);
    const cssOverride = cssOverrideMap.get(preset.name);
    const override = cssOverride || scssOverride;
    if (override) {
      shadows.push({
        name: preset.name,
        value: override.value,
        source: "framework-preset",
        isOverridden: true,
        layers: parseShadowValue(override.value),
        cssVariable: override.cssVariable,
        sassVariable: override.sassVariable
      });
    } else {
      shadows.push({
        name: preset.name,
        value: preset.value,
        source: "framework-preset",
        isOverridden: false,
        layers: parseShadowValue(preset.value),
        cssVariable: `--bs-${preset.name}`,
        sassVariable: `$${preset.name}`
      });
    }
  }
}
async function scanCustomShadows(projectRoot, cssFiles) {
  const shadows = [];
  for (const file of cssFiles) {
    try {
      const css = await fs9.readFile(path8.join(projectRoot, file), "utf-8");
      const rootTokens = parseBlock(css, ":root");
      for (const [name, value] of rootTokens) {
        if (name.includes("shadow") || isShadowValue(value)) {
          shadows.push({
            name: name.replace(/^--/, ""),
            value,
            source: "custom",
            isOverridden: true,
            layers: parseShadowValue(value),
            cssVariable: name
          });
        }
      }
      const themeMatch = css.match(/@theme\s*\{([\s\S]*?)\}/);
      if (themeMatch) {
        const themeBlock = themeMatch[1];
        const propRegex = /(--shadow[\w-]*)\s*:\s*([^;]+);/g;
        let match;
        while ((match = propRegex.exec(themeBlock)) !== null) {
          const name = match[1].replace(/^--/, "");
          if (!shadows.find((s) => s.name === name)) {
            shadows.push({
              name,
              value: match[2].trim(),
              source: "custom",
              isOverridden: true,
              layers: parseShadowValue(match[2].trim()),
              cssVariable: match[1]
            });
          }
        }
      }
    } catch {
    }
  }
  return shadows;
}
function isShadowValue(value) {
  return /\d+px\s+\d+px/.test(value) || value.includes("inset");
}
function parseShadowValue(value) {
  if (!value || value === "none") return [];
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.map(parseSingleShadow).filter((s) => s !== null);
}
function parseSingleShadow(shadow) {
  const trimmed = shadow.trim();
  if (!trimmed) return null;
  const inset = trimmed.startsWith("inset");
  const withoutInset = inset ? trimmed.replace(/^inset\s*/, "") : trimmed;
  let color = "rgb(0 0 0 / 0.1)";
  let measurements = withoutInset;
  const colorPatterns = [
    /\s+((?:rgb|rgba|oklch|hsl|hsla)\([^)]+\))$/,
    /\s+(#[\da-fA-F]{3,8})$/,
    /\s+((?:black|white|transparent|currentColor))$/i
  ];
  for (const pattern of colorPatterns) {
    const match = measurements.match(pattern);
    if (match) {
      color = match[1];
      measurements = measurements.slice(0, match.index).trim();
      break;
    }
  }
  const parts = measurements.split(/\s+/);
  if (parts.length < 2) return null;
  return {
    offsetX: parts[0] || "0",
    offsetY: parts[1] || "0",
    blur: parts[2] || "0",
    spread: parts[3] || "0",
    color,
    inset
  };
}

// src/server/scanner/index.ts
var cachedScan = null;
async function runScan(projectRoot) {
  const framework = await detectFramework(projectRoot);
  const styling = await detectStylingSystem(projectRoot, framework);
  const [tokens, shadows] = await Promise.all([
    scanTokens(projectRoot, framework),
    scanShadows(projectRoot, framework, styling)
  ]);
  cachedScan = { framework, styling, tokens, shadows };
  return cachedScan;
}
function createShadowsScanRouter(projectRoot) {
  const router = Router2();
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
  router.get("/shadows", async (_req, res) => {
    try {
      const result = cachedScan || await runScan(projectRoot);
      res.json(result.shadows);
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
  return router;
}

// src/server/index.ts
var __dirname = path9.dirname(fileURLToPath(import.meta.url));
var require2 = createRequire(import.meta.url);
var packageRoot = fs10.existsSync(path9.join(__dirname, "../package.json")) ? path9.resolve(__dirname, "..") : path9.resolve(__dirname, "../..");
function resolveInjectScript() {
  const compiledInject = path9.join(packageRoot, "dist/inject/selection.js");
  if (fs10.existsSync(compiledInject)) return compiledInject;
  try {
    const corePkg = require2.resolve("@designtools/core/package.json");
    const coreRoot = path9.dirname(corePkg);
    const coreInject = path9.join(coreRoot, "src/inject/selection.ts");
    if (fs10.existsSync(coreInject)) return coreInject;
  } catch {
  }
  const monorepoInject = path9.join(packageRoot, "../core/src/inject/selection.ts");
  if (fs10.existsSync(monorepoInject)) return monorepoInject;
  throw new Error(
    "Could not find inject script (selection.ts). Ensure @designtools/core is installed."
  );
}
async function startShadowsServer(preflight) {
  const clientRoot = path9.join(packageRoot, "src/client");
  const actualInjectPath = resolveInjectScript();
  const { app, wss, projectRoot } = await createToolServer({
    targetPort: preflight.targetPort,
    toolPort: preflight.toolPort,
    clientRoot,
    injectScriptPath: actualInjectPath,
    setupRoutes: (app2, projectRoot2) => {
      app2.use("/api/shadows", createShadowsRouter(projectRoot2));
      app2.use("/scan", createShadowsScanRouter(projectRoot2));
    }
  });
  return { app, wss, projectRoot };
}

// src/cli.ts
bootstrap({
  name: "Design Tools \u2014 Shadows",
  defaultTargetPort: 3e3,
  defaultToolPort: 4410,
  extraChecks: async (framework) => {
    const lines = [];
    if (framework.cssFiles.length > 0) {
      lines.push({
        status: "ok",
        label: "Shadows",
        detail: "Will scan CSS files for shadow definitions"
      });
    }
    return lines;
  }
}).then((result) => {
  startShadowsServer(result).catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
});
