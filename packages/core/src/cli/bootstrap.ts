import fs from "fs";
import path from "path";
import process from "process";
import { detectFramework, type FrameworkInfo } from "../scanner/detect-framework.js";
import { detectStylingSystem, type StylingSystem } from "../scanner/detect-styling.js";

// Suppress known deprecation warnings from dependencies (e.g. http-proxy using util._extend)
const originalEmitWarning = process.emitWarning;
process.emitWarning = ((warning: string | Error, ...args: any[]) => {
  if (typeof warning === "string" && warning.includes("util._extend")) return;
  return originalEmitWarning.call(process, warning, ...args);
}) as typeof process.emitWarning;

// ANSI colors
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

export interface ToolConfig {
  name: string;
  defaultTargetPort: number;
  defaultToolPort: number;
  /** Additional preflight checks beyond the common ones */
  extraChecks?: (framework: FrameworkInfo, projectRoot: string) => Promise<PreflightLine[]>;
}

interface PreflightLine {
  status: "ok" | "warn" | "error";
  label: string;
  detail: string;
  hint?: string;
}

export interface PreflightResult {
  framework: FrameworkInfo;
  styling: StylingSystem;
  targetPort: number;
  toolPort: number;
  projectRoot: string;
}

export async function bootstrap(config: ToolConfig): Promise<PreflightResult> {
  const args = process.argv.slice(2);
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

  const projectRoot = process.cwd();

  console.log("");
  console.log(`  ${bold(config.name)}`);
  console.log("");

  // 1. Check package.json exists
  const pkgPath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(pkgPath)) {
    console.log(`  ${red("✗")} No package.json found`);
    console.log(`    ${dim("Run this command from your project root.")}`);
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

  // 4. Tool-specific extra checks
  if (config.extraChecks) {
    const lines = await config.extraChecks(framework, projectRoot);
    for (const line of lines) {
      const icon = line.status === "ok" ? green("✓") : line.status === "warn" ? yellow("⚠") : red("✗");
      console.log(`  ${icon} ${line.label.padEnd(14)} ${line.detail}`);
      if (line.hint) {
        console.log(`    ${dim(line.hint)}`);
      }
      if (line.status === "error") {
        console.log("");
        process.exit(1);
      }
    }
  }

  console.log("");

  // 4. Check target dev server
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

  console.log(`  ${green("✓")} Tool           http://localhost:${toolPort}`);
  console.log("");

  return { framework, styling, targetPort, toolPort, projectRoot };
}
