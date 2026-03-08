/**
 * terminal-server.ts
 * Attaches a WebSocket server to the existing httpServer.
 * Each WebSocket connection spawns one node-pty process running `claude`.
 */
import { WebSocketServer } from "ws";
import * as pty from "node-pty";
import { execSync } from "child_process";
import type { Server } from "http";

/**
 * Resolve the full path of a binary by searching PATH.
 * node-pty's posix_spawnp uses the env PATH, but can fail if the
 * PATH in process.env doesn't include nvm/volta/fnm directories.
 * Running `which` in a subshell gets the shell's resolved path.
 */
function resolveBinary(name: string): string {
  try {
    return execSync(`which ${name}`, { encoding: "utf-8", shell: process.env.SHELL || "/bin/bash" }).trim();
  } catch {
    return name;
  }
}

export function setupTerminalServer(httpServer: Server, projectRoot: string) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/terminal" });

  // Resolve claude binary once at startup (not per-connection)
  const claudeBin = resolveBinary("claude");

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url!, "http://localhost");
    const model = url.searchParams.get("model") ?? "claude-sonnet-4-6";

    let shell: ReturnType<typeof pty.spawn> | null = null;

    try {
      shell = pty.spawn(claudeBin, ["--model", model], {
        name: "xterm-256color",
        cols: 120,
        rows: 40,
        cwd: projectRoot,
        env: { ...process.env } as Record<string, string>,
      });
    } catch (err) {
      // claude CLI not found or failed to spawn — send error to client
      ws.send(`\r\n\x1b[31mFailed to start claude CLI: ${String(err)}\x1b[0m\r\n`);
      ws.send(`\r\n\x1b[33mMake sure the Claude CLI is installed and available in PATH.\x1b[0m\r\n`);
      ws.send(`\r\n\x1b[2mInstall: npm install -g @anthropic-ai/claude-code\x1b[0m\r\n`);
      ws.close();
      return;
    }

    shell.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    });

    shell.onExit(() => {
      if (ws.readyState === ws.OPEN) {
        ws.close();
      }
    });

    ws.on("message", (msg) => {
      if (!shell) return;
      const str = msg.toString();
      try {
        const parsed = JSON.parse(str);
        if (parsed.type === "resize" && typeof parsed.cols === "number" && typeof parsed.rows === "number") {
          shell.resize(parsed.cols, parsed.rows);
          return;
        }
        if (parsed.type === "inject" && typeof parsed.text === "string") {
          shell.write(parsed.text);
          return;
        }
      } catch {
        // Not JSON — pass raw input to PTY (keyboard input)
      }
      shell.write(str);
    });

    ws.on("close", () => {
      if (shell) {
        shell.kill();
        shell = null;
      }
    });

    ws.on("error", () => {
      if (shell) {
        shell.kill();
        shell = null;
      }
    });
  });
}
