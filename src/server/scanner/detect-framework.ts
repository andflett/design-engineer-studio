import fs from "fs/promises";
import path from "path";

export interface FrameworkInfo {
  name: "nextjs" | "vite" | "remix" | "unknown";
  appDir: string; // where page files live
  componentDir: string; // where UI components live
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
  if (deps.next) {
    return {
      name: "nextjs",
      appDir: await findDir(projectRoot, ["app", "src/app"]),
      componentDir: await findDir(projectRoot, [
        "components/ui",
        "src/components/ui",
      ]),
      cssFiles: await findCssFiles(projectRoot),
    };
  }

  if (deps["@remix-run/react"] || deps["@remix-run/node"]) {
    return {
      name: "remix",
      appDir: await findDir(projectRoot, ["app/routes", "src/routes"]),
      componentDir: await findDir(projectRoot, [
        "components/ui",
        "app/components/ui",
        "src/components/ui",
      ]),
      cssFiles: await findCssFiles(projectRoot),
    };
  }

  if (deps.vite) {
    return {
      name: "vite",
      appDir: await findDir(projectRoot, [
        "src/pages",
        "src/routes",
        "src",
        "pages",
      ]),
      componentDir: await findDir(projectRoot, [
        "components/ui",
        "src/components/ui",
      ]),
      cssFiles: await findCssFiles(projectRoot),
    };
  }

  return {
    name: "unknown",
    appDir: await findDir(projectRoot, ["app", "src", "pages"]),
    componentDir: await findDir(projectRoot, [
      "components/ui",
      "src/components/ui",
    ]),
    cssFiles: await findCssFiles(projectRoot),
  };
}

async function findDir(
  root: string,
  candidates: string[]
): Promise<string> {
  for (const candidate of candidates) {
    const full = path.join(root, candidate);
    try {
      const stat = await fs.stat(full);
      if (stat.isDirectory()) return candidate;
    } catch {
      // doesn't exist
    }
  }
  return candidates[0]; // fallback to first candidate
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
