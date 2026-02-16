import fs from "fs/promises";
import path from "path";
import type { FrameworkInfo } from "./detect-framework.js";

export interface RouteEntry {
  urlPath: string; // e.g. "/" or "/dashboard"
  filePath: string; // e.g. "app/page.tsx"
}

export interface RouteMap {
  routes: RouteEntry[];
}

export async function scanRoutes(
  projectRoot: string,
  framework: FrameworkInfo
): Promise<RouteMap> {
  if (framework.name === "nextjs") {
    return scanNextJsRoutes(projectRoot, framework.appDir);
  }

  // Generic fallback
  return scanGenericRoutes(projectRoot, framework.appDir);
}

async function scanNextJsRoutes(
  projectRoot: string,
  appDir: string
): Promise<RouteMap> {
  const routes: RouteEntry[] = [];
  const fullAppDir = path.join(projectRoot, appDir);

  try {
    await scanNextJsDir(fullAppDir, appDir, "", routes);
  } catch {
    // app dir doesn't exist
  }

  return { routes };
}

async function scanNextJsDir(
  fullDir: string,
  appDir: string,
  urlPrefix: string,
  routes: RouteEntry[]
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(fullDir, { withFileTypes: true });
  } catch {
    return;
  }

  // Check for page.tsx in this directory
  const hasPage = entries.some(
    (e) => e.isFile() && (e.name === "page.tsx" || e.name === "page.jsx")
  );

  if (hasPage) {
    const pageFile = entries.find(
      (e) => e.name === "page.tsx" || e.name === "page.jsx"
    )!;
    routes.push({
      urlPath: urlPrefix || "/",
      filePath: path.join(
        appDir,
        urlPrefix.replace(/^\//, ""),
        pageFile.name
      ),
    });
  }

  // Recurse into subdirectories
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_") || entry.name === "node_modules") continue;

    let segment = entry.name;

    // Route groups: (group) → no URL segment
    if (segment.startsWith("(") && segment.endsWith(")")) {
      await scanNextJsDir(
        path.join(fullDir, segment),
        appDir,
        urlPrefix,
        routes
      );
      continue;
    }

    // Dynamic segments: [slug] → :slug
    if (segment.startsWith("[") && segment.endsWith("]")) {
      segment = `:${segment.slice(1, -1)}`;
    }

    // API routes — skip
    if (segment === "api") continue;

    await scanNextJsDir(
      path.join(fullDir, entry.name),
      appDir,
      `${urlPrefix}/${segment}`,
      routes
    );
  }
}

async function scanGenericRoutes(
  projectRoot: string,
  srcDir: string
): Promise<RouteMap> {
  const routes: RouteEntry[] = [];
  const fullDir = path.join(projectRoot, srcDir);

  try {
    const files = await fs.readdir(fullDir, { withFileTypes: true });
    for (const file of files) {
      if (file.isFile() && (file.name.endsWith(".tsx") || file.name.endsWith(".jsx"))) {
        const name = file.name.replace(/\.(tsx|jsx)$/, "");
        const urlPath = name === "index" ? "/" : `/${name}`;
        routes.push({
          urlPath,
          filePath: path.join(srcDir, file.name),
        });
      }
    }
  } catch {
    // dir doesn't exist
  }

  return { routes };
}
