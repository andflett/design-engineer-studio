/**
 * Scan all page/layout files in the app directory for component usages.
 * Builds a map: componentName -> unique routes where it's used.
 *
 * This enables the "where is this component used?" explorer in the editor.
 */
import fs from "fs/promises";
import path from "path";
import type { FrameworkInfo } from "./detect-framework.js";

export interface ComponentUsageRoute {
  /** Route path as shown in the browser, e.g. "/dashboard" */
  route: string;
  /** Source file that defines this page, e.g. "app/(app)/dashboard/page.tsx" */
  file: string;
}

export interface ComponentUsageMap {
  /** componentName (PascalCase) -> list of unique routes */
  usages: Record<string, ComponentUsageRoute[]>;
}

const PAGE_EXTENSIONS = [".tsx", ".jsx", ".ts", ".js"];
const LAYOUT_FILES = ["layout", "page"];

export async function scanUsages(
  projectRoot: string,
  framework: FrameworkInfo
): Promise<ComponentUsageMap> {
  if (!framework.appDirExists) {
    return { usages: {} };
  }

  const absAppDir = path.join(projectRoot, framework.appDir);
  const usages: Record<string, Set<string>> = {};
  const routeFiles: { file: string; route: string }[] = [];

  // Walk the app directory to find all page/layout files and their routes
  await walkAppDir(absAppDir, absAppDir, "", routeFiles);

  // For each route file, find which components are imported and used
  for (const { file, route } of routeFiles) {
    const absFile = path.join(absAppDir, file);
    let source: string;
    try {
      source = await fs.readFile(absFile, "utf-8");
    } catch {
      continue;
    }

    const importedComponents = extractImportedComponents(source, framework.componentDir);

    for (const comp of importedComponents) {
      if (!usages[comp]) usages[comp] = new Set();
      usages[comp].add(route);
    }
  }

  // Convert sets to sorted arrays
  const result: Record<string, ComponentUsageRoute[]> = {};
  for (const [comp, routes] of Object.entries(usages)) {
    result[comp] = Array.from(routes)
      .sort()
      .map((route) => {
        const rf = routeFiles.find((r) => r.route === route);
        return {
          route,
          file: rf ? path.join(framework.appDir, rf.file) : "",
        };
      });
  }

  return { usages: result };
}

/**
 * Walk the Next.js app directory recursively, collecting page/layout files
 * and computing their route paths.
 */
async function walkAppDir(
  baseDir: string,
  currentDir: string,
  routePrefix: string,
  results: { file: string; route: string }[]
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  // Check for page/layout files in this directory
  for (const base of LAYOUT_FILES) {
    for (const ext of PAGE_EXTENSIONS) {
      const candidate = `${base}${ext}`;
      if (entries.some((e) => e.isFile() && e.name === candidate)) {
        const relFile = path.relative(baseDir, path.join(currentDir, candidate));
        const route = routePrefix || "/";
        results.push({ file: relFile, route });
      }
    }
  }

  // Recurse into subdirectories
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirName = entry.name;

    // Skip special Next.js directories
    if (dirName.startsWith("_") || dirName.startsWith(".")) continue;
    if (dirName === "api") continue;

    const subDir = path.join(currentDir, dirName);

    if (dirName.startsWith("(") && dirName.endsWith(")")) {
      // Route group — doesn't add to the URL path
      await walkAppDir(baseDir, subDir, routePrefix, results);
    } else if (dirName.startsWith("@")) {
      // Parallel route slot — doesn't add to URL but files inside do use parent route
      await walkAppDir(baseDir, subDir, routePrefix, results);
    } else {
      // Normal or dynamic segment
      let segment = dirName;
      // Dynamic segments show as their bracket name in the route
      // e.g. [slug] -> :slug for display, but we keep the bracket form
      const routePart = `${routePrefix}/${segment}`;
      await walkAppDir(baseDir, subDir, routePart, results);
    }
  }
}

/**
 * Extract component names imported from the component directory.
 * Looks for import statements that reference the component dir.
 */
function extractImportedComponents(
  source: string,
  componentDir: string
): string[] {
  const components: string[] = [];

  // Match import statements:
  // import { Button, Card } from "@/components/ui/button"
  // import { Button } from "../../components/ui/button"
  // import { Button } from "../components/ui/button"
  // Also handle: import Button from "..."
  const importRegex = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+["']([^"']+)["']/g;
  let match;

  // Normalize component dir for matching (e.g. "components/ui" -> various patterns)
  const compDirParts = componentDir.split("/");
  const compDirName = compDirParts[compDirParts.length - 1]; // "ui"
  const compDirParent = compDirParts.length > 1 ? compDirParts[compDirParts.length - 2] : ""; // "components"

  while ((match = importRegex.exec(source)) !== null) {
    const namedImports = match[1]; // "Button, Card"
    const defaultImport = match[2]; // "Button"
    const fromPath = match[3]; // "@/components/ui/button"

    // Check if this import comes from the component directory
    const isComponentImport = isFromComponentDir(fromPath, componentDir, compDirParent, compDirName);

    if (!isComponentImport) continue;

    if (namedImports) {
      // Parse named imports: "Button, Card as MyCard, type CardProps"
      const names = namedImports.split(",").map((s) => s.trim());
      for (const name of names) {
        // Skip type imports
        if (name.startsWith("type ")) continue;
        // Handle aliased imports: "Card as MyCard" -> "Card"
        const actualName = name.split(/\s+as\s+/)[0].trim();
        // Only include PascalCase names (components, not utilities)
        if (actualName && /^[A-Z]/.test(actualName)) {
          components.push(actualName);
        }
      }
    } else if (defaultImport && /^[A-Z]/.test(defaultImport)) {
      components.push(defaultImport);
    }
  }

  return components;
}

/**
 * Check if an import path refers to the component directory.
 */
function isFromComponentDir(
  importPath: string,
  componentDir: string,
  _parentDir: string,
  leafDir: string
): boolean {
  // @/ alias: @/components/ui/button
  if (importPath.startsWith("@/")) {
    const resolved = importPath.slice(2); // "components/ui/button"
    return resolved.startsWith(componentDir + "/") || resolved === componentDir;
  }

  // ~/alias (some projects): ~/components/ui/button
  if (importPath.startsWith("~/")) {
    const resolved = importPath.slice(2);
    return resolved.startsWith(componentDir + "/") || resolved === componentDir;
  }

  // Relative path: check if it ends with /components/ui/something or /ui/something
  if (importPath.startsWith(".")) {
    // Normalize: ../components/ui/button -> check if "components/ui" is in the path
    return importPath.includes(`/${componentDir}/`) || importPath.endsWith(`/${componentDir}`);
  }

  // Check for partial matches (e.g. the path contains /ui/ for componentDir "components/ui")
  if (importPath.includes(`/${leafDir}/`)) {
    return true;
  }

  return false;
}
