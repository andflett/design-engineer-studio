import fs from "fs/promises";
import path from "path";

export interface FrameworkInfo {
  name: "nextjs" | "vite" | "remix" | "unknown";
  appDir: string; // where page files live
  appDirExists: boolean;
  componentDir: string; // where UI components live
  componentDirExists: boolean;
  componentFileCount: number; // number of .tsx files in componentDir
  cssFiles: string[]; // candidate CSS files with tokens
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

  // Detect framework
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
  const componentResult = await findDir(projectRoot, componentDirCandidates);
  const componentFileCount = componentResult.exists
    ? await countFiles(projectRoot, componentResult.dir, ".tsx")
    : 0;

  return {
    name,
    appDir: appResult.dir,
    appDirExists: appResult.exists,
    componentDir: componentResult.dir,
    componentDirExists: componentResult.exists,
    componentFileCount,
    cssFiles: await findCssFiles(projectRoot),
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

async function countFiles(root: string, dir: string, ext: string): Promise<number> {
  const full = path.join(root, dir);
  try {
    const entries = await fs.readdir(full);
    return entries.filter((e) => e.endsWith(ext)).length;
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
