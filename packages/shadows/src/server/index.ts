import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { createToolServer } from "@designtools/core/server";
import { createShadowsRouter } from "./api/write-shadows.js";
import { createShadowsScanRouter } from "./scanner/index.js";
import type { PreflightResult } from "@designtools/core/cli";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const packageRoot = fs.existsSync(path.join(__dirname, "../package.json"))
  ? path.resolve(__dirname, "..")
  : path.resolve(__dirname, "../..");

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

export async function startShadowsServer(preflight: PreflightResult) {
  const clientRoot = path.join(packageRoot, "src/client");
  const clientDistRoot = path.join(packageRoot, "dist/client");
  const actualInjectPath = resolveInjectScript();

  const { app, wss, projectRoot } = await createToolServer({
    targetPort: preflight.targetPort,
    toolPort: preflight.toolPort,
    clientRoot,
    clientDistRoot,
    injectScriptPath: actualInjectPath,
    setupRoutes: (app, projectRoot) => {
      app.use("/api/shadows", createShadowsRouter(projectRoot));
      app.use("/scan", createShadowsScanRouter(projectRoot));
    },
  });

  return { app, wss, projectRoot };
}
