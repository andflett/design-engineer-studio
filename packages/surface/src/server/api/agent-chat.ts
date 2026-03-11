/**
 * agent-chat.ts
 * Express router for /api/agent — bridges Claude Agent SDK to a UI Message Stream
 * compatible with @ai-sdk/react's useChat hook + DefaultChatTransport.
 *
 * POST /api/agent/chat
 *   Request body: { messages: UIMessage[], model: "sonnet" | "opus", context?: { element, pendingChanges } }
 *   Response: SSE stream of UIMessageChunk objects
 *
 * POST /api/agent/respond
 *   Request body: { requestId: string, decision: "allow" | "deny", message?: string }
 *   Resolves a pending permission prompt
 */
import { Router } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { createUIMessageStream, pipeUIMessageStreamToResponse } from "ai";
import type { SelectedElementData, ChangeIntent } from "../../shared/protocol.js";

const MODEL_MAP: Record<string, string> = {
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-6",
};

/** Tools that are always safe (read-only) and should be auto-allowed. */
const SAFE_TOOLS = new Set(["Read", "Glob", "Grep", "WebSearch", "WebFetch", "Task", "TodoRead", "TodoWrite"]);

/** Pending permission requests — keyed by requestId, scoped globally (one agent stream at a time). */
const pendingPermissions = new Map<
  string,
  { resolve: (result: { behavior: "allow" } | { behavior: "deny"; message: string }) => void }
>();

/** Track the active session ID so follow-up messages resume the same conversation. */
let activeSessionId: string | null = null;

interface Classification {
  inLoop?: boolean;
  hasDynamicContent?: boolean;
  dataOrigin?: "local" | "external";
  iteratorExpression?: string;
}

/** Build a context prefix from element + pending changes + classification. */
function buildSystemContext(
  element: SelectedElementData | null,
  pendingChanges: ChangeIntent[],
  classification?: Classification,
): string {
  const parts: string[] = [];
  if (element) {
    const src = element.source;
    if (src) parts.push(`[Selected element: ${src.file}:${src.line}]`);
    if (element.className) parts.push(`className: "${element.className}"`);
    const interesting = ["padding", "margin", "display", "border-radius", "font-size", "color", "background-color"];
    const compact = interesting
      .filter((p) => element.computed?.[p])
      .map((p) => `${p}: ${element.computed[p]}`)
      .join("  ");
    if (compact) parts.push(compact);
  }
  if (classification?.inLoop) {
    const origin = classification.dataOrigin === "local" ? " (local data defined in this file)" : " (external data source)";
    const expr = classification.iteratorExpression ? ` via \`${classification.iteratorExpression}\`` : "";
    parts.push(`[Repeated element] This element renders multiple times${expr}${origin}. Style edits affect all instances. Do not suggest hardcoding values that come from data.`);
  }
  if (classification?.hasDynamicContent && !classification?.inLoop) {
    parts.push(`[Dynamic content] Text or child content of this element comes from a runtime variable. Do not suggest replacing it with hardcoded text.`);
  }
  if (pendingChanges.length > 0) {
    const lines = pendingChanges.map((c) => `  ${c.property}: ${c.fromValue} → ${c.toValue}`);
    parts.push(`[${pendingChanges.length} pending change${pendingChanges.length !== 1 ? "s" : ""}]\n${lines.join("\n")}`);
  }
  return parts.join("\n");
}

/** Summarize tool input for display in permission prompt. */
function summarizeToolInput(toolName: string, input: Record<string, unknown>): string {
  if (toolName === "Bash" && typeof input.command === "string") {
    return input.command;
  }
  if ((toolName === "Edit" || toolName === "Write") && typeof input.file_path === "string") {
    return input.file_path;
  }
  return JSON.stringify(input, null, 2).slice(0, 500);
}

export function createAgentChatRouter(projectRoot: string) {
  const router = Router();

  // POST /api/agent/respond — resolve a pending permission prompt
  router.post("/respond", (req, res) => {
    const { requestId, decision, message } = req.body as {
      requestId: string;
      decision: "allow" | "deny";
      message?: string;
    };

    if (!requestId || !decision) {
      res.status(400).json({ error: "requestId and decision are required" });
      return;
    }

    const pending = pendingPermissions.get(requestId);
    if (!pending) {
      res.status(404).json({ error: "No pending request with that ID" });
      return;
    }

    pendingPermissions.delete(requestId);

    if (decision === "allow") {
      pending.resolve({ behavior: "allow" });
    } else {
      pending.resolve({ behavior: "deny", message: message || "User denied this action" });
    }

    res.json({ ok: true });
  });

  router.post("/chat", async (req, res) => {
    const { messages, model = "sonnet", context } = req.body as {
      messages: Array<{ role: string; content: string; parts?: Array<{ type: string; text?: string }> }>;
      model?: string;
      context?: { element: SelectedElementData | null; pendingChanges: ChangeIntent[]; classification?: Classification };
    };

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "messages is required" });
      return;
    }

    // Extract the last user message text
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "user") {
      res.status(400).json({ error: "Last message must be from user" });
      return;
    }

    // Get user text from parts or content
    let userText = "";
    if (lastMsg.parts) {
      const textPart = lastMsg.parts.find((p: any) => p.type === "text");
      if (textPart && textPart.text) userText = textPart.text;
    }
    if (!userText && typeof lastMsg.content === "string") {
      userText = lastMsg.content;
    }

    // Build context prefix
    const contextPrefix = context
      ? buildSystemContext(context.element, context.pendingChanges, context.classification)
      : "";

    const prompt = contextPrefix
      ? `${contextPrefix}\n\n${userText}`
      : userText;

    const modelId = MODEL_MAP[model] || MODEL_MAP.sonnet;

    // Build clean env without CLAUDECODE to avoid "nested session" error
    const cleanEnv: Record<string, string | undefined> = { ...process.env };
    delete cleanEnv.CLAUDECODE;

    // Determine if this is a follow-up in an existing session
    const isFollowUp = activeSessionId !== null;

    // Create a UI message stream using the AI SDK helper
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const agentQuery = query({
          prompt,
          options: {
            cwd: projectRoot,
            model: modelId,
            allowedTools: ["Read", "Edit", "Bash", "Glob", "Grep", "Write"],
            disallowedTools: ["AskUserQuestion"],
            permissionMode: "acceptEdits",
            ...(isFollowUp && activeSessionId ? { resume: activeSessionId } : {}),
            canUseTool: async (toolName, input, options) => {
              // Auto-allow safe read-only tools
              if (SAFE_TOOLS.has(toolName)) {
                return { behavior: "allow" as const };
              }

              // For other tools, send a permission prompt to the client
              const requestId = options.toolUseID || `perm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

              // Write permission request as a data chunk to the SSE stream
              writer.write({
                type: "data" as any,
                data: [{
                  type: "permission-request",
                  requestId,
                  toolName,
                  input: input as Record<string, unknown>,
                  description: summarizeToolInput(toolName, input as Record<string, unknown>),
                }],
              });

              // Create a promise that will be resolved when the client responds
              return new Promise((resolve) => {
                pendingPermissions.set(requestId, { resolve });
              });
            },
            systemPrompt: "If you need to ask the user a question or need clarification, ask directly in your text response. The user will reply in the chat. Do not use structured question tools.",
            settingSources: ["project"],
            maxTurns: 20,
            persistSession: true,
            includePartialMessages: true,
            env: cleanEnv,
          },
        });

        // Track block types per content-block index
        const blockTypes = new Map<number, "text" | "tool_use" | "thinking">();
        let textPartId = "";
        let thinkingPartId = "";
        // Map from content_block index to tool call ID
        const blockToolIds = new Map<number, string>();

        for await (const message of agentQuery) {
          if (message.type === "stream_event") {
            const event = message.event;

            // content_block_start: new text, tool_use, or thinking block
            if (event.type === "content_block_start") {
              if (event.content_block.type === "text") {
                blockTypes.set(event.index, "text");
                textPartId = `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                writer.write({ type: "text-start", id: textPartId });
              } else if (event.content_block.type === "tool_use") {
                blockTypes.set(event.index, "tool_use");
                const toolBlock = event.content_block;
                blockToolIds.set(event.index, toolBlock.id);
                writer.write({
                  type: "tool-input-start",
                  toolCallId: toolBlock.id,
                  toolName: toolBlock.name,
                });
              } else if (event.content_block.type === "thinking") {
                blockTypes.set(event.index, "thinking");
                thinkingPartId = `thinking-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                writer.write({ type: "reasoning-start", id: thinkingPartId });
              }
            }

            // content_block_delta: text or tool input streaming
            if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                writer.write({ type: "text-delta", delta: event.delta.text, id: textPartId });
              } else if (event.delta.type === "input_json_delta") {
                const toolCallId = blockToolIds.get(event.index) || "";
                writer.write({
                  type: "tool-input-delta",
                  toolCallId,
                  inputTextDelta: event.delta.partial_json,
                });
              } else if (event.delta.type === "thinking_delta") {
                writer.write({ type: "reasoning-delta", id: thinkingPartId, delta: event.delta.thinking });
              }
            }

            // content_block_stop: close the correct block type
            if (event.type === "content_block_stop") {
              const blockType = blockTypes.get(event.index);
              if (blockType === "text") {
                writer.write({ type: "text-end", id: textPartId });
              } else if (blockType === "thinking") {
                writer.write({ type: "reasoning-end", id: thinkingPartId });
              }
              // Tool blocks are closed when we get the full assistant message
              blockTypes.delete(event.index);
            }

            // message_stop: the assistant turn is complete
            if (event.type === "message_stop") {
              // Nothing needed — tool results are handled below
            }
          }

          // Complete assistant message: extract tool calls with full input
          if (message.type === "assistant") {
            for (const block of message.message.content) {
              if (block.type === "tool_use") {
                writer.write({
                  type: "tool-input-available",
                  toolCallId: block.id,
                  toolName: block.name,
                  input: block.input,
                });
              }
            }
          }

          // Handle result
          if (message.type === "result") {
            // Capture session ID for follow-up messages
            const resultMsg = message as any;
            if (resultMsg.session_id) {
              activeSessionId = resultMsg.session_id;
            }

            // Close any remaining open blocks
            for (const [index, blockType] of blockTypes) {
              if (blockType === "text") {
                writer.write({ type: "text-end", id: textPartId });
              } else if (blockType === "thinking") {
                writer.write({ type: "reasoning-end", id: thinkingPartId });
              }
            }
            blockTypes.clear();

            if (message.subtype !== "success") {
              const errorResult = message as any;
              if (errorResult.errors?.length > 0) {
                writer.write({ type: "error", errorText: errorResult.errors.join("; ") });
              }
            }

            writer.write({
              type: "finish",
              finishReason: message.subtype === "success" ? "stop" : "error",
            });
          }
        }

        // Safety: close any still-open blocks
        for (const [_, blockType] of blockTypes) {
          if (blockType === "text") {
            writer.write({ type: "text-end", id: textPartId });
          } else if (blockType === "thinking") {
            writer.write({ type: "reasoning-end", id: thinkingPartId });
          }
        }
      },
      onError: (error) => {
        return error instanceof Error ? error.message : "Agent query failed";
      },
    });

    // Pipe the stream to the Express response as SSE
    pipeUIMessageStreamToResponse({ response: res, stream });
  });

  return router;
}
