import fs from "fs";
import path from "path";
import process from "process";
import open from "open";
import { detectFramework } from "./server/lib/detect-framework.js";
import { detectStylingSystem, type StylingSystem } from "./server/lib/detect-styling.js";
import { createServer } from "./server/index.js";

// ANSI colors
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

async function main() {
  const args = process.argv.slice(2);
  let targetPort = 3000;
  let toolPort = 4400;

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

  const projectRoot = process.cwd();

  console.log("");
  console.log(`  ${bold("@designtools/codecanvas")}`);
  console.log(`  ${dim(projectRoot)}`);
  console.log("");

  // 1. Check package.json exists
  const pkgPath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(pkgPath)) {
    console.log(`  ${red("✗")} No package.json found in ${projectRoot}`);
    console.log(`    ${dim("Run this command from the root of the app you want to edit.")}`);
    console.log(`    ${dim("All file reads and writes are scoped to this directory.")}`);
    console.log("");
    process.exit(1);
  }

  // 2. Detect framework
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
    console.log(`  ${green("✓")} CSS files      ${framework.cssFiles[0]}`);
  } else {
    console.log(`  ${yellow("⚠")} CSS files      ${dim("no CSS files found")}`);
  }

  // 3. Detect styling system
  const styling = await detectStylingSystem(projectRoot, framework);

  const stylingLabels: Record<StylingSystem["type"], string> = {
    "tailwind-v4": "Tailwind CSS v4",
    "tailwind-v3": "Tailwind CSS v3",
    "bootstrap": "Bootstrap",
    "css-variables": "CSS Custom Properties",
    "plain-css": "Plain CSS",
    "unknown": "Unknown",
  };
  const stylingLabel = stylingLabels[styling.type];

  if (styling.type !== "unknown") {
    console.log(`  ${green("✓")} Styling        ${stylingLabel}`);
  } else {
    console.log(`  ${yellow("⚠")} Styling        ${dim("no styling system detected")}`);
  }

  console.log("");

  // 4. Wait for target dev server (retry for up to 15 seconds)
  const targetUrl = `http://localhost:${targetPort}`;
  let targetReachable = false;
  let waited = false;
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      await fetch(targetUrl, { signal: AbortSignal.timeout(2000) });
      targetReachable = true;
      break;
    } catch {
      if (attempt === 0) {
        process.stdout.write(`  ${dim("Waiting for dev server at " + targetUrl + "...")}`);
        waited = true;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (waited) process.stdout.write("\r\x1b[K");
  if (targetReachable) {
    console.log(`  ${green("✓")} Target         ${targetUrl}`);
  } else {
    console.log("");
    console.log(`  ${red("✗")} No dev server at ${targetUrl}`);
    console.log(`    ${dim("Start your dev server first, then run this command.")}`);
    console.log(`    ${dim(`Use --port to specify a different port.`)}`);
    console.log("");
    process.exit(1);
  }

  console.log(`  ${green("✓")} Tool           http://localhost:${toolPort}`);
  console.log("");
  console.log(`  ${dim("All file writes are scoped to:")} ${bold(projectRoot)}`);
  console.log("");

  // 5. Start server
  const server = await createServer({
    targetPort,
    toolPort,
    projectRoot,
    stylingType: styling.type,
  });

  server.listen(toolPort, () => {
    open(`http://localhost:${toolPort}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
