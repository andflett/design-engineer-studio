# In-Browser Terminal for Claude Code CLI

## Goal

Run the full Claude Code CLI in a browser-based terminal, working both locally and on OODA (cloud Sprites).

## Architecture

```
Browser (xterm.js) ←→ WebSocket ←→ PTY process (node-pty) ←→ Claude CLI
```

## Components

### 1. Frontend: xterm.js Terminal Emulator

Use `@xterm/xterm` + `@xterm/addon-fit` + `@xterm/addon-web-links`. Renders a real terminal in a DOM element with full ANSI color, cursor movement, and interactive input. Sends keystrokes over WebSocket, renders output received back.

### 2. Backend: WebSocket Server with PTY

Use `node-pty` to spawn a pseudo-terminal running `claude` (the CLI binary). Pipe PTY stdout → WebSocket → browser. Pipe WebSocket (keystrokes from browser) → PTY stdin. This gives the *real* CLI — streaming, interactive prompts, tool approval, everything.

### 3. Connection

- **Local:** WebSocket to `localhost:<port>`
- **OODA/Sprite:** WebSocket to the Sprite's Surface API server (add a `/ws/terminal` endpoint)

## Minimal Server Code (Node)

```typescript
import { WebSocketServer } from 'ws';
import * as pty from 'node-pty';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  const shell = pty.spawn('claude', [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 40,
    cwd: process.env.PROJECT_DIR || process.cwd(),
  });

  shell.onData((data) => ws.send(data));
  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg.toString());
      if (parsed.type === 'resize') {
        shell.resize(parsed.cols, parsed.rows);
        return;
      }
    } catch {
      // not JSON, treat as terminal input
    }
    shell.write(msg.toString());
  });
  ws.on('close', () => shell.kill());
});
```

## Minimal Client Code

```typescript
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

const term = new Terminal({ cursorBlink: true });
const fit = new FitAddon();
term.loadAddon(fit);
term.open(document.getElementById('terminal')!);
fit.fit();

const ws = new WebSocket('ws://localhost:8080');
ws.onmessage = (e) => term.write(e.data);
term.onData((data) => ws.send(data));

// Send resize events
new ResizeObserver(() => {
  fit.fit();
  ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
}).observe(document.getElementById('terminal')!);
```

## Key Considerations

- **Auth:** On OODA, gate the WebSocket endpoint behind existing auth (see [auth-approach.md](./auth-approach.md)). Anyone with access gets a full shell.
- **Message framing:** Raw bytes are terminal I/O, JSON objects are control messages (resize, etc). Parse JSON first, fall back to raw write.
- **Multiple sessions:** One PTY per WebSocket connection. Store in a Map if you need reconnection/session persistence.
- **Reconnection:** If the WebSocket drops, the PTY is still alive server-side. Reconnect and reattach by keeping a session ID → PTY map.
- **`node-pty` on Sprites:** Needs native compilation. Make sure the Sprite image has build tools, or prebuild the binary. Alternative: use Docker with a prebuilt image.

## Why This Over a Custom Agent Loop

A custom agent loop that sends prompts and gets responses essentially reimplements the CLI's conversation management. The PTY approach gives the *actual* CLI with zero reimplementation: streaming output, `/commands`, tool approval UI, context management, MCP servers, hooks — everything Claude Code supports today and in the future, automatically.