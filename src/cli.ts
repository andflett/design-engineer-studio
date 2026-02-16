import fs from "fs";
import path from "path";
import { startServer } from "./server/index.js";
import { detectFramework } from "./server/scanner/index.js";

// ANSI colors
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

const args = process.argv.slice(2);
let targetPort = 3000;
let studioPort = 4400;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && args[i + 1]) {
    targetPort = parseInt(args[i + 1], 10);
    i++;
  }
  if (args[i] === "--studio-port" && args[i + 1]) {
    studioPort = parseInt(args[i + 1], 10);
    i++;
  }
}

async function preflight() {
  const projectRoot = process.cwd();

  console.log("");
  console.log(`  ${bold("Design Engineer Studio")}`);
  console.log("");

  // 1. Check package.json exists
  const pkgPath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(pkgPath)) {
    console.log(`  ${red("✗")} No package.json found`);
    console.log(`    ${dim("Run this command from your project root.")}`);
    console.log("");
    process.exit(1);
  }

  // 2. Detect framework and report
  const framework = await detectFramework(projectRoot);

  const frameworkLabel =
    framework.name === "nextjs"
      ? "Next.js"
      : framework.name === "remix"
        ? "Remix"
        : framework.name === "vite"
          ? "Vite"
          : "Unknown";

  console.log(`  ${green("✓")} Framework      ${frameworkLabel}`);

  if (framework.appDirExists) {
    console.log(`  ${green("✓")} App dir        ${framework.appDir}/`);
  } else {
    console.log(`  ${yellow("⚠")} App dir        ${dim("not found — route detection won't be available")}`);
  }

  if (framework.componentDirExists) {
    console.log(
      `  ${green("✓")} Components     ${framework.componentDir}/ ${dim(`(${framework.componentFileCount} files)`)}`
    );
  } else {
    console.log(`  ${yellow("⚠")} Components     ${dim("not found — component editing won't be available")}`);
  }

  if (framework.cssFiles.length > 0) {
    console.log(`  ${green("✓")} CSS tokens     ${framework.cssFiles[0]}`);
  } else {
    console.log(`  ${yellow("⚠")} CSS tokens     ${dim("no CSS files found — token editing won't be available")}`);
  }

  console.log("");

  // 3. Check target dev server is running
  const targetUrl = `http://localhost:${targetPort}`;
  try {
    await fetch(targetUrl, { signal: AbortSignal.timeout(2000) });
    console.log(`  ${green("✓")} Target         ${targetUrl}`);
  } catch {
    console.log(`  ${red("✗")} No dev server at ${targetUrl}`);
    console.log(`    ${dim("Start your dev server first, then run this command.")}`);
    console.log(`    ${dim(`Use --port to specify a different port.`)}`);
    console.log("");
    process.exit(1);
  }

  console.log(`  ${green("✓")} Studio         http://localhost:${studioPort}`);
  console.log("");
}

preflight().then(() => {
  startServer({ targetPort, studioPort }).catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
});
