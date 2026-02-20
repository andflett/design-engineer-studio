import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { createToolServer } from "@designtools/core/server";
import { createTokensRouter } from "./api/write-tokens.js";
import { createComponentRouter } from "./api/write-component.js";
import { createElementRouter, cleanupStaleMarkers } from "./api/write-element.js";
import { createStudioScanRouter } from "./scanner/index.js";
import type { PreflightResult } from "@designtools/core/cli";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Find package root — walk up from __dirname until we find package.json
function findPackageRoot(dir: string): string {
  let d = dir;
  while (d !== path.dirname(d)) {
    if (fs.existsSync(path.join(d, "package.json"))) return d;
    d = path.dirname(d);
  }
  return dir;
}
const packageRoot = findPackageRoot(__dirname);

// Dev mode: running from src/ via tsx; production: running from dist/ via npx
const isDev = __dirname.includes(path.sep + "src" + path.sep);

function resolveInjectScript(): string {
  // 1. Check for compiled inject script in this package's dist
  const compiledInject = path.join(packageRoot, "dist/inject/selection.js");
  if (fs.existsSync(compiledInject)) return compiledInject;

  // 2. Resolve from @designtools/core package location
  try {
    const corePkg = require.resolve("@designtools/core/package.json");
    const coreRoot = path.dirname(corePkg);
    const coreInject = path.join(coreRoot, "src/inject/selection.ts");
    if (fs.existsSync(coreInject)) return coreInject;
  } catch {}

  // 3. Fallback: sibling core package in monorepo
  const monorepoInject = path.join(packageRoot, "../core/src/inject/selection.ts");
  if (fs.existsSync(monorepoInject)) return monorepoInject;

  throw new Error(
    "Could not find inject script (selection.ts). Ensure @designtools/core is installed."
  );
}

export async function startStudioServer(preflight: PreflightResult) {
  const clientRoot = path.join(packageRoot, "src/client");
  const clientDistRoot = isDev ? undefined : path.join(packageRoot, "dist/client");
  const actualInjectPath = resolveInjectScript();

  const { app, wss, projectRoot } = await createToolServer({
    targetPort: preflight.targetPort,
    toolPort: preflight.toolPort,
    clientRoot,
    clientDistRoot,
    injectScriptPath: actualInjectPath,
    setupRoutes: (app, projectRoot) => {
      app.use("/api/tokens", createTokensRouter(projectRoot));
      app.use("/api/component", createComponentRouter(projectRoot));
      app.use("/api/element", createElementRouter(projectRoot));
      app.use("/scan", createStudioScanRouter(projectRoot));
    },
  });

  // Clean up any data-studio-eid markers left from a previous session
  cleanupStaleMarkers(projectRoot).catch(() => {});

  return { app, wss, projectRoot };
}
