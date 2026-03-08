/**
 * terminal-panel.tsx
 * xterm.js terminal that connects to /ws/terminal via WebSocket.
 * Hosts the real Claude CLI process via node-pty on the server.
 *
 * Layout:
 *   - Terminal (fills space, stays interactive for tool approvals etc.)
 *   - Compose area: bordered box with chips + textarea, then toolbar row
 *     - Chips (element + pending changes) live inside the composer box
 *     - Enter sends, Shift+Enter inserts newline
 *     - Terminal stays directly typeable for follow-ups / tool approvals
 */
import { useEffect, useRef, useState, useCallback } from "react";
import "@xterm/xterm/css/xterm.css";
import * as Select from "@radix-ui/react-select";
import { ChevronDown, CornerDownLeft } from "lucide-react";
import type { AiModel, ChangeIntent, SelectedElementData } from "../../shared/protocol.js";

interface TerminalPanelProps {
  toolPort: number;
  model: AiModel;
  element: SelectedElementData | null;
  pendingChanges: ChangeIntent[];
  onClearPendingChanges: () => void;
  onRemovePendingChange?: (index: number) => void;
}

async function loadXterm() {
  const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
    import("@xterm/xterm"),
    import("@xterm/addon-fit"),
    import("@xterm/addon-web-links"),
  ]);
  return { Terminal, FitAddon, WebLinksAddon };
}

/** Format element source as a short display label */
function elementLabel(el: SelectedElementData): string {
  if (el.source) {
    const file = el.source.file.split("/").pop() ?? el.source.file;
    return `${file}:${el.source.line}`;
  }
  return el.tag ?? "element";
}


/** Build the context block to inject for an element */
function buildElementContext(el: SelectedElementData): string {
  const src = el.source;
  const parts: string[] = [];
  if (src) parts.push(`[Element: ${src.file}:${src.line}]`);
  if (el.className) parts.push(`className: "${el.className}"`);
  const interesting = ["padding", "margin", "display", "border-radius", "font-size", "color", "background-color"];
  const compact = interesting
    .filter((p) => el.computed?.[p])
    .map((p) => `${p}: ${el.computed[p]}`)
    .join("  ");
  if (compact) parts.push(compact);
  return parts.join("\n") + "\n";
}

/** Build the context block for pending changes */
function buildChangesContext(changes: ChangeIntent[]): string {
  if (changes.length === 0) return "";
  const lines = changes.map((c) => `  ${c.property}: ${c.fromValue} → ${c.toValue}`);
  return `[${changes.length} change${changes.length !== 1 ? "s" : ""} to apply]\n${lines.join("\n")}\n`;
}

/**
 * Assemble the full context prefix.
 * Assembles element + pending changes context for a message.
 */
/** Build per-message context (element + pending changes only) */
function buildContextPrefix(
  attachedElement: SelectedElementData | null,
  pendingChanges: ChangeIntent[],
): string {
  const parts: string[] = [];
  if (attachedElement) parts.push(buildElementContext(attachedElement));
  if (pendingChanges.length > 0) parts.push(buildChangesContext(pendingChanges));
  return parts.join("\n\n---\n\n");
}

const CHIP_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  padding: "2px 5px 2px 7px",
  borderRadius: 4,
  fontSize: 10,
  background: "rgba(128,128,128,0.12)",
  border: "1px solid rgba(128,128,128,0.2)",
  color: "var(--studio-text-muted)",
  lineHeight: 1.4,
  maxWidth: 200,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  flexShrink: 0,
};

const CHIP_BTN_STYLE: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: "0 1px",
  cursor: "pointer",
  color: "var(--studio-text-dimmed)",
  fontSize: 12,
  lineHeight: 1,
  opacity: 0.5,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
};

export function TerminalPanel({
  toolPort,
  model,
  element,
  pendingChanges,
  onClearPendingChanges,
  onRemovePendingChange,
}: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<any>(null);
  const fitRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [connected, setConnected] = useState(false);
  const [currentModel, setCurrentModel] = useState<AiModel>(model);
  const [message, setMessage] = useState("");

  // Attached element chip — auto-set when element changes, dismissible
  const [attachedElement, setAttachedElement] = useState<SelectedElementData | null>(null);
  useEffect(() => {
    setAttachedElement(element);
  }, [element?.source?.file, element?.source?.line, element?.source?.col]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [message]);

  const connect = useCallback(
    async (m: AiModel) => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (termRef.current) {
        termRef.current.dispose();
        termRef.current = null;
      }
      if (!containerRef.current) return;

      const { Terminal, FitAddon, WebLinksAddon } = await loadXterm();

      const term = new Terminal({
        theme: {
          background: "#0d0d0d",
          foreground: "#e8e8e8",
          cursor: "#e8e8e8",
          selectionBackground: "rgba(255,255,255,0.2)",
          black: "#1a1a1a",
          brightBlack: "#555",
          red: "#e06c75",
          brightRed: "#e06c75",
          green: "#98c379",
          brightGreen: "#98c379",
          yellow: "#e5c07b",
          brightYellow: "#e5c07b",
          blue: "#61afef",
          brightBlue: "#61afef",
          magenta: "#c678dd",
          brightMagenta: "#c678dd",
          cyan: "#56b6c2",
          brightCyan: "#56b6c2",
          white: "#d0d0d0",
          brightWhite: "#ffffff",
        },
        fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Menlo, monospace',
        fontSize: 12,
        lineHeight: 1.4,
        cursorBlink: true,
        allowProposedApi: true,
      });

      const fit = new FitAddon();
      const webLinks = new WebLinksAddon();
      term.loadAddon(fit);
      term.loadAddon(webLinks);

      containerRef.current.innerHTML = "";
      term.open(containerRef.current);
      fit.fit();

      termRef.current = term;
      fitRef.current = fit;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//localhost:${toolPort}/ws/terminal?model=${m}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      };
      ws.onmessage = (event) => term.write(event.data);
      ws.onclose = () => {
        setConnected(false);
        term.write("\r\n\x1b[2m[Session closed]\x1b[0m\r\n");
      };
      ws.onerror = () => {
        setConnected(false);
        term.write("\r\n\x1b[31m[Connection error]\x1b[0m\r\n");
      };

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
      });

      const observer = new ResizeObserver(() => {
        if (fitRef.current) {
          fitRef.current.fit();
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
          }
        }
      });
      if (containerRef.current) observer.observe(containerRef.current);

      const originalDispose = term.dispose.bind(term);
      term.dispose = () => {
        observer.disconnect();
        originalDispose();
      };
    },
    [toolPort]
  );

  useEffect(() => {
    connect(currentModel);
    return () => {
      wsRef.current?.close();
      termRef.current?.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleModelChange = useCallback(
    (m: AiModel) => {
      setCurrentModel(m);
      connect(m);
    },
    [connect]
  );

  /** Inject raw text into the PTY stdin */
  const inject = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "inject", text }));
      termRef.current?.focus();
    }
  }, []);

  /**
   * Send the composed message.
   * Uses terminal.paste() — xterm's built-in API that handles bracketedPasteMode
   * correctly (same as Cmd+V). Then sends \r as a raw WebSocket message, which
   * follows the same path as a real keyboard Enter keypress.
   */
  const handleSend = useCallback(() => {
    const userMessage = message.trim();
    const context = buildContextPrefix(attachedElement, pendingChanges);
    if (!context && !userMessage) return;

    const parts: string[] = [];
    if (context) parts.push(context);
    if (userMessage) parts.push(userMessage);
    const fullText = parts.join("\n\n---\n\n");

    if (!termRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;

    // Paste the content via xterm's paste API (handles bracketedPasteMode).
    // Delay Enter to allow the PTY/Ink to fully process the pasted content.
    const term = termRef.current;
    const ws = wsRef.current;
    term.paste(fullText);
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("\r");
      }
    }, 150);
    textareaRef.current?.focus();

    setMessage("");
    setAttachedElement(null);
    onClearPendingChanges();
  }, [message, attachedElement, pendingChanges, onClearPendingChanges]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const hasContext = !!attachedElement || pendingChanges.length > 0;
  const canSend = connected && (hasContext || message.trim().length > 0);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        background: "#0d0d0d",
      }}
    >
      {/* Terminal — stays fully interactive */}
      <div
        ref={containerRef}
        style={{ flex: 1, minHeight: 0, padding: 4, overflow: "hidden" }}
      />

      {/* Compose area */}
      <div
        style={{
          borderTop: "1px solid var(--studio-border)",
          background: "var(--studio-surface)",
          padding: "8px 10px 10px",
          flexShrink: 0,
        }}
      >
        {/* Composer box: chips + textarea in a single bordered container */}
        <div
          style={{
            border: "1px solid var(--studio-border)",
            borderRadius: 7,
            background: "var(--studio-surface-hover)",
            overflow: "hidden",
          }}
          onClick={() => textareaRef.current?.focus()}
        >
          {/* Chips row — only when there's context attached */}
          {hasContext && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                padding: "7px 10px 0",
              }}
            >
              {/* Element chip */}
              {attachedElement && (
                <div
                  style={CHIP_STYLE}
                  title={
                    attachedElement.source
                      ? `${attachedElement.source.file}:${attachedElement.source.line}`
                      : undefined
                  }
                >
                  <span style={{ opacity: 0.45, fontSize: 9 }}>⬡</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
                    {elementLabel(attachedElement)}
                  </span>
                  <button
                    style={CHIP_BTN_STYLE}
                    onMouseDown={(e) => e.preventDefault()} // prevent textarea blur
                    onClick={() => setAttachedElement(null)}
                    title="Remove element context"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Change chips */}
              {pendingChanges.map((c, i) => (
                <div
                  key={i}
                  style={{
                    ...CHIP_STYLE,
                    color: "var(--studio-accent)",
                    borderColor: "color-mix(in srgb, var(--studio-accent) 30%, transparent)",
                    background: "color-mix(in srgb, var(--studio-accent) 8%, transparent)",
                  }}
                  title={`${c.property}: ${c.fromValue} → ${c.toValue}`}
                >
                  <span style={{ opacity: 0.6, fontSize: 9 }}>↑</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
                    {c.property}: {c.toValue}
                  </span>
                  <button
                    style={{ ...CHIP_BTN_STYLE, color: "var(--studio-accent)" }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onRemovePendingChange?.(i)}
                    title="Remove this change"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              attachedElement
                ? "Ask about this element… (Enter to send, Shift+Enter for newline)"
                : "Ask Claude… (Enter to send, Shift+Enter for newline)"
            }
            rows={1}
            style={{
              display: "block",
              width: "100%",
              resize: "none",
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--studio-text)",
              fontSize: 12,
              lineHeight: 1.5,
              padding: hasContext ? "6px 10px 8px" : "8px 10px",
              fontFamily: "inherit",
              minHeight: 34,
              maxHeight: 120,
              overflowY: "auto",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Toolbar row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          {/* Model selector */}
          <Select.Root value={currentModel} onValueChange={(v) => handleModelChange(v as AiModel)}>
            <Select.Trigger
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                height: 24,
                padding: "0 7px",
                fontSize: 11,
                background: "var(--studio-surface-hover)",
                border: "1px solid var(--studio-border)",
                borderRadius: 5,
                color: "var(--studio-text)",
                cursor: "pointer",
                outline: "none",
                whiteSpace: "nowrap",
              }}
            >
              <Select.Value />
              <Select.Icon style={{ display: "flex", alignItems: "center", opacity: 0.5 }}>
                <ChevronDown size={10} />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                className="studio-popup-dark"
                position="popper"
                sideOffset={5}
                style={{ zIndex: 9999, minWidth: 120 }}
              >
                <Select.Viewport>
                  {(["sonnet", "opus"] as AiModel[]).map((m) => (
                    <Select.Item key={m} value={m} className="studio-select-item">
                      <Select.ItemText>
                        {m === "sonnet" ? "Claude Sonnet" : "Claude Opus"}
                      </Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>

          {/* Connection status dot */}
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: connected ? "var(--studio-success)" : "var(--studio-border)",
              display: "inline-block",
              flexShrink: 0,
            }}
            title={connected ? "Connected" : "Disconnected"}
          />

          <div style={{ flex: 1 }} />

          {/* Attach element button — shown when element is selected but not attached */}
          {element && !attachedElement && (
            <button
              className="studio-icon-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setAttachedElement(element);
                textareaRef.current?.focus();
              }}
              style={{ fontSize: 10, padding: "0 8px", height: 24, width: "auto" }}
              title="Attach selected element as context"
            >
              + Element
            </button>
          )}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              padding: "0 10px",
              height: 24,
              background: canSend ? "var(--studio-accent)" : "var(--studio-surface-hover)",
              color: canSend ? "#fff" : "var(--studio-text-dimmed)",
              border: "none",
              borderRadius: 4,
              cursor: canSend ? "pointer" : "default",
              opacity: canSend ? 1 : 0.5,
              fontWeight: 500,
              letterSpacing: "0.02em",
              transition: "background 0.15s, opacity 0.15s",
            }}
            title="Send message (Enter)"
          >
            Send
            <CornerDownLeft size={10} style={{ opacity: 0.7 }} />
          </button>
        </div>
      </div>
    </div>
  );
}
