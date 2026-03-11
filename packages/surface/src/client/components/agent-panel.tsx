/**
 * agent-panel.tsx
 * Chat UI using AI Elements components + @ai-sdk/react useChat hook.
 * Connects to POST /api/agent/chat which bridges to Claude Agent SDK.
 *
 * Input design matches terminal-panel: compose box with chips, textarea,
 * toolbar row with model select + AllowEdits toggle + send button.
 */
import { useState, useRef, useMemo, useCallback, useEffect, Fragment } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import * as Select from "@radix-ui/react-select";
import type { AiModel, ChangeIntent, SelectedElementData } from "../../shared/protocol.js";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "./ai-elements/conversation.js";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "./ai-elements/message.js";
import {
  MessageSquare, Brain, ShieldCheck, ShieldX, Terminal, FileEdit, Pencil,
  Search, FolderSearch, FileText, CheckCircle2, XCircle, Loader2, ChevronDown,
  CornerDownLeft, Code2,
} from "lucide-react";

// ── Compact tool call row ────────────────────────────────────────────────────

const TOOL_META: Record<string, { icon: typeof Terminal; label: string; getDesc: (input: any) => string }> = {
  Bash:  { icon: Terminal,     label: "$",     getDesc: (i) => i?.command ?? "" },
  Read:  { icon: FileText,     label: "Read",  getDesc: (i) => shortPath(i?.file_path) },
  Edit:  { icon: FileEdit,     label: "Edit",  getDesc: (i) => shortPath(i?.file_path) },
  Write: { icon: Pencil,       label: "Write", getDesc: (i) => shortPath(i?.file_path) },
  Glob:  { icon: FolderSearch, label: "Glob",  getDesc: (i) => i?.pattern ?? "" },
  Grep:  { icon: Search,       label: "Grep",  getDesc: (i) => {
    const pat = i?.pattern ?? "";
    const path = i?.path ? ` in ${shortPath(i.path)}` : "";
    return `/${pat}/${path}`;
  }},
};

function shortPath(p?: string): string {
  if (!p) return "";
  const parts = p.split("/");
  return parts.length > 3 ? ".../" + parts.slice(-3).join("/") : p;
}

/** State icon for a tool part */
function stateIcon(state: string) {
  switch (state) {
    case "output-available":
      return <CheckCircle2 size={12} style={{ color: "var(--studio-success)" }} />;
    case "output-error":
    case "output-denied":
      return <XCircle size={12} style={{ color: "var(--studio-danger)" }} />;
    default:
      return <Loader2 size={12} className="studio-spin" style={{ color: "var(--studio-text-dimmed)" }} />;
  }
}

/** Compact inline tool call — shows icon + command/path + status */
function AgentToolRow({ toolName, input, state }: { toolName?: string; input: any; state: string }) {
  const name = toolName ?? (input as any)?.toolName ?? "Tool";
  const meta = TOOL_META[name];
  const Icon = meta?.icon ?? Terminal;
  const desc = meta?.getDesc(input) ?? JSON.stringify(input ?? {}).slice(0, 120);
  const label = meta?.label ?? name;
  const isBash = name === "Bash";

  return (
    <div className="studio-tool-row">
      <Icon size={12} className="studio-tool-row-icon" />
      {!isBash && <span className="studio-tool-row-label">{label}</span>}
      <code className="studio-tool-row-desc">{desc}</code>
      <span className="studio-tool-row-status">{stateIcon(state)}</span>
    </div>
  );
}

// ── Permission request ───────────────────────────────────────────────────────

interface PermissionRequest {
  type: "permission-request";
  requestId: string;
  toolName: string;
  input: Record<string, unknown>;
  description?: string;
}

// ── Chip styles (shared with terminal-panel) ─────────────────────────────────

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

// ── Main component ───────────────────────────────────────────────────────────

interface AgentPanelProps {
  toolPort: number;
  model: AiModel;
  element: SelectedElementData | null;
  elementMode?: "component" | "instance";
  pendingChanges: ChangeIntent[];
  onClearPendingChanges: () => void;
  onRemovePendingChange?: (index: number) => void;
  inLoop?: boolean;
  hasDynamicContent?: boolean;
  dataOrigin?: "local" | "external";
  iteratorExpression?: string;
}

function elementLabel(el: SelectedElementData, mode?: "component" | "instance"): string {
  const modeLabel = mode === "instance" ? " (instance)" : mode === "component" ? " (component)" : "";
  if (el.source) {
    const file = el.source.file.split("/").pop() ?? el.source.file;
    return `${file}:${el.source.line}${modeLabel}`;
  }
  return (el.tag ?? "element") + modeLabel;
}

function getPermissionRequests(message: { parts: any[] }): PermissionRequest[] {
  const requests: PermissionRequest[] = [];
  for (const part of message.parts) {
    if (part.type.startsWith("data")) {
      const dataArr = (part as any).data;
      if (Array.isArray(dataArr)) {
        for (const item of dataArr) {
          if (item && item.type === "permission-request") {
            requests.push(item as PermissionRequest);
          }
        }
      }
    }
  }
  return requests;
}

export function AgentPanel({
  toolPort,
  model: initialModel,
  element,
  elementMode,
  pendingChanges,
  onClearPendingChanges,
  onRemovePendingChange,
  inLoop = false,
  hasDynamicContent = false,
  dataOrigin,
  iteratorExpression,
}: AgentPanelProps) {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(initialModel);
  const [allowEdits, setAllowEdits] = useState(true);
  const [permissionDecisions, setPermissionDecisions] = useState<Record<string, "allow" | "deny">>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const elementRef = useRef(element);
  const pendingChangesRef = useRef(pendingChanges);
  const modelRef = useRef(selectedModel);
  const classificationRef = useRef({ inLoop, hasDynamicContent, dataOrigin, iteratorExpression });
  elementRef.current = element;
  pendingChangesRef.current = pendingChanges;
  modelRef.current = selectedModel;
  classificationRef.current = { inLoop, hasDynamicContent, dataOrigin, iteratorExpression };

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/agent/chat`,
        body: () => ({
          model: modelRef.current,
          context: {
            element: elementRef.current,
            elementMode,
            pendingChanges: pendingChangesRef.current,
            classification: classificationRef.current,
          },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    id: "agent-chat",
  });

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  // Auto-approve permission requests when allowEdits is on
  useEffect(() => {
    if (!allowEdits) return;
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const req of getPermissionRequests(message)) {
        if (!permissionDecisions[req.requestId]) {
          handlePermissionResponse(req.requestId, "allow");
        }
      }
    }
  }, [messages, allowEdits]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSend = status !== "streaming" && (input.trim().length > 0 || pendingChanges.length > 0);

  const handleSubmit = useCallback(() => {
    if (!canSend) return;
    sendMessage({ text: input });
    setInput("");
    if (pendingChanges.length > 0) {
      onClearPendingChanges();
    }
  }, [input, canSend, pendingChanges, sendMessage, onClearPendingChanges]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handlePermissionResponse = useCallback(async (requestId: string, decision: "allow" | "deny") => {
    setPermissionDecisions((prev) => ({ ...prev, [requestId]: decision }));
    try {
      await fetch("/api/agent/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, decision }),
      });
    } catch {
      setPermissionDecisions((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    }
  }, []);

  // Derive current activity for the status bar
  const currentActivity = useMemo<{ icon: typeof Brain; label: string; desc?: string } | null>(() => {
    if (status !== "streaming") return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== "assistant") continue;

      // In-progress tool call
      for (let j = msg.parts.length - 1; j >= 0; j--) {
        const p = msg.parts[j] as any;
        if (
          p.type?.startsWith("tool-") &&
          p.type !== "tool-input-streaming" &&
          p.state !== "output-available" &&
          p.state !== "output-error" &&
          p.state !== "output-denied"
        ) {
          const meta = TOOL_META[p.toolName];
          return {
            icon: meta?.icon ?? Terminal,
            label: meta?.label ?? p.toolName,
            desc: meta?.getDesc(p.input) ?? "",
          };
        }
      }

      // Reasoning streaming
      if (msg.parts.some((p: any) => p.type === "reasoning" && p.state === "streaming")) {
        return { icon: Brain, label: "Reasoning" };
      }

      // No content yet — thinking
      const hasContent = msg.parts.some((p: any) =>
        p.type === "text" ? (p.text?.length ?? 0) > 0 : p.type.startsWith("tool-")
      );
      if (!hasContent) return { icon: Brain, label: "Thinking" };

      return null;
    }
    return { icon: Brain, label: "Thinking" };
  }, [messages, status]);

  const hasContext = !!element || pendingChanges.length > 0;

  return (
    <div className="studio-agent-panel" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Conversation message list */}
      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<MessageSquare className="size-8" />}
              title="Chat with Claude"
              description="Ask Claude to edit code, explain elements, or apply changes"
            />
          ) : (
            messages.map((message) => {
              const permRequests = message.role === "assistant" ? getPermissionRequests(message) : [];

              return (
                <Fragment key={message.id}>
                  <Message from={message.role}>
                    <MessageContent>
                      {message.parts.map((part, i) => {
                        switch (part.type) {
                          case "text":
                            return part.text ? (
                              <MessageResponse key={`${message.id}-${i}`}>
                                {part.text}
                              </MessageResponse>
                            ) : null;
                          case "reasoning":
                            return null;
                          default:
                            if (part.type.startsWith("data")) return null;
                            if (part.type.startsWith("tool-")) {
                              const p = part as any;
                              if (part.type === "tool-input-streaming") return null;
                              return (
                                <AgentToolRow
                                  key={`${message.id}-${i}`}
                                  toolName={p.toolName}
                                  input={p.input}
                                  state={p.state}
                                />
                              );
                            }
                            return null;
                        }
                      })}

                      {/* Permission prompts — only shown when allowEdits is off */}
                      {permRequests.map((req) => {
                        const decision = permissionDecisions[req.requestId];
                        if (allowEdits && !decision) return null;
                        return (
                          <div key={req.requestId} className="studio-perm-prompt" data-decided={decision || undefined}>
                            <div className="studio-perm-header">
                              {(() => { const I = TOOL_META[req.toolName]?.icon ?? ShieldCheck; return <I size={13} />; })()}
                              <span className="studio-perm-name">{req.toolName}</span>
                              {decision && (
                                <span className={`studio-perm-badge ${decision}`}>
                                  {decision === "allow" ? "Allowed" : "Denied"}
                                </span>
                              )}
                            </div>
                            {req.description && (
                              <pre className="studio-perm-desc">{req.description}</pre>
                            )}
                            {!decision && (
                              <div className="studio-perm-actions">
                                <button className="studio-perm-btn allow" onClick={() => handlePermissionResponse(req.requestId, "allow")}>
                                  <ShieldCheck size={12} /> Allow
                                </button>
                                <button className="studio-perm-btn deny" onClick={() => handlePermissionResponse(req.requestId, "deny")}>
                                  <ShieldX size={12} /> Deny
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </MessageContent>
                  </Message>
                </Fragment>
              );
            })
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Compose area */}
      <div style={{ padding: "6px 10px 10px", flexShrink: 0, borderTop: "1px solid var(--studio-border)" }}>
        {/* Activity status bar — shown above input when streaming */}
        {currentActivity && (
          <div className="studio-activity-bar">
            <currentActivity.icon size={11} style={{ flexShrink: 0 }} />
            <span style={{ flexShrink: 0, fontWeight: 500 }}>{currentActivity.label}</span>
            {currentActivity.desc && <code>{currentActivity.desc}</code>}
          </div>
        )}

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
          {/* Chips row */}
          {hasContext && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "7px 10px 0" }}>
              {/* Element chip with mode label */}
              {element && (
                <div
                  style={CHIP_STYLE}
                  title={
                    element.source
                      ? `${element.source.file}:${element.source.line}${elementMode ? ` (${elementMode})` : ""}`
                      : undefined
                  }
                >
                  <span style={{ opacity: 0.45, fontSize: 9 }}>⬡</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
                    {elementLabel(element, elementMode)}
                  </span>
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              element
                ? "Ask about this element… (Enter to send)"
                : "Ask Claude… (Enter to send)"
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
          <Select.Root value={selectedModel} onValueChange={setSelectedModel}>
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
                style={{ zIndex: 9999, minWidth: 130 }}
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

          {/* AllowEdits toggle */}
          <button
            onClick={() => setAllowEdits((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              height: 24,
              padding: "0 7px",
              fontSize: 10,
              background: allowEdits
                ? "color-mix(in srgb, var(--studio-accent) 12%, transparent)"
                : "var(--studio-surface-hover)",
              border: `1px solid ${allowEdits ? "color-mix(in srgb, var(--studio-accent) 35%, transparent)" : "var(--studio-border)"}`,
              borderRadius: 5,
              color: allowEdits ? "var(--studio-accent)" : "var(--studio-text-dimmed)",
              cursor: "pointer",
              outline: "none",
              whiteSpace: "nowrap",
              fontWeight: allowEdits ? 500 : 400,
              transition: "background 0.15s, color 0.15s",
            }}
            title={allowEdits ? "Auto-accept edits: on — tool calls are auto-approved" : "Auto-accept edits: off — you approve each tool call"}
          >
            <Code2 size={10} />
            Auto-edits
          </button>

          <div style={{ flex: 1 }} />

          {/* Send button */}
          <button
            onClick={handleSubmit}
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
