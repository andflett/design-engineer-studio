import fs from "fs/promises";
import path from "path";

export interface FrameworkInfo {
  name: "nextjs" | "vite" | "remix" | "unknown";
  appDir: string;
  appDirExists: boolean;
  componentDir: string;
  componentDirExists: boolean;
  componentFileCount: number;
  cssFiles: string[];
  /** Directories found during fallback scan, with file counts. Used by CLI prompts. */
  fallbackComponentDirs: { dir: string; fileCount: number }[];
  /** CSS files found during fallback scan. Used by CLI prompts. */
  fallbackCssFiles: string[];
}

export async function detectFramework(
  projectRoot: string
): Promise<FrameworkInfo> {
  const pkgPath = path.join(projectRoot, "package.json");
  let pkg: any = {};

  try {
    pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
  } catch {
    // No package.json — unknown framework
  }

  const deps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  let name: FrameworkInfo["name"] = "unknown";
  let appDirCandidates: string[];
  let componentDirCandidates: string[];

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
  let componentResult = await findDir(projectRoot, componentDirCandidates);
  let componentFileCount = componentResult.exists
    ? await countComponentFiles(projectRoot, componentResult.dir)
    : 0;

  // Fallback: scan common parent directories for component files with data-slot
  let fallbackComponentDirs: { dir: string; fileCount: number }[] = [];
  if (!componentResult.exists) {
    fallbackComponentDirs = await scanForComponentDirs(projectRoot);
    if (fallbackComponentDirs.length > 0) {
      // Pick the directory with the most data-slot hits
      const best = fallbackComponentDirs[0];
      componentResult = { dir: best.dir, exists: true };
      componentFileCount = best.fileCount;
    }
  }

  // Find CSS files with hardcoded candidates first
  let cssFiles = await findCssFiles(projectRoot);

  // Fallback: scan common directories for CSS files with custom properties
  let fallbackCssFiles: string[] = [];
  if (cssFiles.length === 0) {
    fallbackCssFiles = await scanForCssFiles(projectRoot);
    if (fallbackCssFiles.length > 0) {
      cssFiles = fallbackCssFiles;
    }
  }

  return {
    name,
    appDir: appResult.dir,
    appDirExists: appResult.exists,
    componentDir: componentResult.dir,
    componentDirExists: componentResult.exists,
    componentFileCount,
    cssFiles,
    fallbackComponentDirs,
    fallbackCssFiles,
  };
}

async function findDir(
  root: string,
  candidates: string[]
): Promise<{ dir: string; exists: boolean }> {
  for (const candidate of candidates) {
    const full = path.join(root, candidate);
    try {
      const stat = await fs.stat(full);
      if (stat.isDirectory()) return { dir: candidate, exists: true };
    } catch {
      // doesn't exist
    }
  }
  return { dir: candidates[0], exists: false };
}

/** Count .tsx and .jsx files in a directory. */
async function countComponentFiles(root: string, dir: string): Promise<number> {
  const full = path.join(root, dir);
  try {
    const entries = await fs.readdir(full);
    return entries.filter((e) => e.endsWith(".tsx") || e.endsWith(".jsx")).length;
  } catch {
    return 0;
  }
}

async function findCssFiles(projectRoot: string): Promise<string[]> {
  const candidates = [
    "app/globals.css",
    "src/app/globals.css",
    "app/global.css",
    "src/globals.css",
    "src/index.css",
    "src/app.css",
    "styles/globals.css",
  ];

  const found: string[] = [];
  for (const candidate of candidates) {
    try {
      await fs.access(path.join(projectRoot, candidate));
      found.push(candidate);
    } catch {
      // doesn't exist
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Fallback scanning
// ---------------------------------------------------------------------------

const COMPONENT_SCAN_DIRS = [
  "components",
  "src/components",
  "lib",
  "src/lib",
  "ui",
  "src/ui",
];

/**
 * Scan common parent directories for subdirectories containing .tsx/.jsx files
 * with `data-slot` strings. Returns directories sorted by hit count (descending).
 */
async function scanForComponentDirs(
  projectRoot: string
): Promise<{ dir: string; fileCount: number }[]> {
  const results: { dir: string; fileCount: number }[] = [];

  for (const parentDir of COMPONENT_SCAN_DIRS) {
    const fullParent = path.join(projectRoot, parentDir);
    let stat;
    try {
      stat = await fs.stat(fullParent);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    // Check files directly in this directory
    const hits = await countDataSlotFiles(fullParent);
    if (hits > 0) {
      results.push({ dir: parentDir, fileCount: hits });
    }

    // Also check immediate subdirectories (e.g. components/ui)
    try {
      const entries = await fs.readdir(fullParent, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const subDir = path.join(parentDir, entry.name);
        const subHits = await countDataSlotFiles(path.join(projectRoot, subDir));
        if (subHits > 0) {
          results.push({ dir: subDir, fileCount: subHits });
        }
      }
    } catch {
      // ignore
    }
  }

  // Sort by fileCount descending
  results.sort((a, b) => b.fileCount - a.fileCount);
  return results;
}

/**
 * Count .tsx/.jsx files in a directory that contain "data-slot".
 * Uses a fast string check — no AST parsing.
 */
async function countDataSlotFiles(dirPath: string): Promise<number> {
  let count = 0;
  try {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      if (!file.endsWith(".tsx") && !file.endsWith(".jsx")) continue;
      try {
        const content = await fs.readFile(path.join(dirPath, file), "utf-8");
        if (content.includes("data-slot")) {
          count++;
        }
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    // directory not readable
  }
  return count;
}

const CSS_SCAN_DIRS = [
  "app",
  "src/app",
  "src",
  "styles",
  "assets",
  "theme",
  "css",
];

const CSS_CUSTOM_PROPERTY_RE = /--[\w-]+\s*:/;

/**
 * Scan common directories for .css files that contain CSS custom properties.
 */
async function scanForCssFiles(projectRoot: string): Promise<string[]> {
  const found: string[] = [];

  for (const dir of CSS_SCAN_DIRS) {
    const fullDir = path.join(projectRoot, dir);
    let entries: string[];
    try {
      entries = await fs.readdir(fullDir) as unknown as string[];
    } catch {
      continue;
    }

    for (const file of entries) {
      if (!file.endsWith(".css")) continue;
      const relPath = path.join(dir, file);
      // Skip files already found
      if (found.includes(relPath)) continue;
      try {
        const content = await fs.readFile(path.join(projectRoot, relPath), "utf-8");
        if (CSS_CUSTOM_PROPERTY_RE.test(content)) {
          found.push(relPath);
        }
      } catch {
        // skip
      }
    }
  }

  return found;
}
