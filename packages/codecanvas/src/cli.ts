import fs from "fs";
import path from "path";
import process from "process";
import readline from "readline";
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
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;

/** Prompt the user to pick from a list or enter a custom value. */
async function promptPort(message: string, options: number[]): Promise<number> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("");
  console.log(`  ${yellow("?")} ${message}`);
  for (let i = 0; i < options.length; i++) {
    console.log(`    ${cyan(String(i + 1))}. http://localhost:${options[i]}`);
  }
  console.log(`    ${cyan(String(options.length + 1))}. Enter a different port`);
  console.log("");

  return new Promise((resolve) => {
    rl.question(`  ${dim("Choice [1]:")} `, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      if (!trimmed || trimmed === "1") {
        resolve(options[0]);
        return;
      }
      const idx = parseInt(trimmed, 10);
      if (idx >= 1 && idx <= options.length) {
        resolve(options[idx - 1]);
        return;
      }
      if (idx === options.length + 1) {
        // They want a custom port — parse it from the answer or ask again
        const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl2.question(`  ${dim("Port:")} `, (portAnswer) => {
          rl2.close();
          const port = parseInt(portAnswer.trim(), 10);
          resolve(port || options[0]);
        });
        return;
      }
      // Maybe they typed a port number directly
      const directPort = parseInt(trimmed, 10);
      if (directPort > 1000) {
        resolve(directPort);
        return;
      }
      resolve(options[0]);
    });
  });
}

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
  // Also scan nearby ports in case the dev server auto-picked a different one
  // (e.g. Next.js prints "Port 3000 is in use, using 3001 instead").
  const scanPorts = [targetPort, targetPort + 1, targetPort + 2];
  let targetReachable = false;
  let waited = false;

  /** Check which ports in the scan range have a reachable server. */
  async function findReachablePorts(): Promise<number[]> {
    const reachable: number[] = [];
    for (const port of scanPorts) {
      try {
        await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(1000) });
        reachable.push(port);
      } catch {
        // not reachable
      }
    }
    return reachable;
  }

  let reachablePorts: number[] = [];
  for (let attempt = 0; attempt < 15; attempt++) {
    reachablePorts = await findReachablePorts();
    if (reachablePorts.length > 0) {
      targetReachable = true;
      break;
    }
    if (attempt === 0) {
      process.stdout.write(`  ${dim("Waiting for dev server on port " + scanPorts.join("/") + "...")}`);
      waited = true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (waited) process.stdout.write("\r\x1b[K");

  if (!targetReachable) {
    console.log("");
    console.log(`  ${red("✗")} No dev server on port ${scanPorts.join(", ")}`);
    console.log(`    ${dim("Start your dev server first, then run this command.")}`);
    console.log(`    ${dim(`Use --port to specify a different port.`)}`);
    console.log("");
    process.exit(1);
  }

  if (reachablePorts.length === 1 && reachablePorts[0] === targetPort) {
    // Exact match on the requested port — no ambiguity
    console.log(`  ${green("✓")} Target         http://localhost:${targetPort}`);
  } else if (reachablePorts.length === 1) {
    // Only one port responded, but it's not the one they asked for
    const found = reachablePorts[0];
    console.log(`  ${yellow("⚠")} Target         http://localhost:${found} ${dim(`(port ${targetPort} not reachable, found server on ${found})`)}`);
    targetPort = found;
  } else {
    // Multiple ports are responding — ask the user which one is their app
    targetPort = await promptPort(
      `Multiple servers found. Which is your dev app?`,
      reachablePorts,
    );
    console.log(`  ${green("✓")} Target         http://localhost:${targetPort}`);
  }

  // 5. Start server
  const { app, viteDevServer } = await createServer({
    targetPort,
    toolPort,
    projectRoot,
    stylingType: styling.type,
  });

  // Try to listen on the tool port, auto-increment if busy
  const httpServer = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 5;

    function tryListen(port: number) {
      const server = app.listen(port);
      server.on("listening", () => {
        if (port !== toolPort) {
          console.log(`  ${yellow("⚠")} Tool           http://localhost:${port} ${dim(`(port ${toolPort} was busy)`)}`);
        } else {
          console.log(`  ${green("✓")} Tool           http://localhost:${port}`);
        }
        toolPort = port;
        resolve(server);
      });
      server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && attempts < maxAttempts) {
          attempts++;
          tryListen(port + 1);
        } else {
          reject(err);
        }
      });
    }
    tryListen(toolPort);
  });

  console.log("");
  console.log(`  ${dim("All file writes are scoped to:")} ${bold(projectRoot)}`);
  console.log("");

  open(`http://localhost:${toolPort}`);

  // Graceful shutdown — close Vite's HMR WebSocket and the HTTP server
  // so ports are released even if the process is killed abruptly.
  const shutdown = () => {
    console.log(`\n  ${dim("Shutting down...")}`);
    if (viteDevServer) {
      viteDevServer.close().catch(() => {});
    }
    httpServer.close(() => {
      process.exit(0);
    });
    // Force exit after 3s if close callbacks hang
    setTimeout(() => process.exit(0), 3000);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
