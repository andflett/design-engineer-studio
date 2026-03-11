/**
 * Editor panel with three-tab structure matching the studio.
 * - Token tab: edit design tokens globally
 * - Component tab (only for data-slot elements): variant dimensions + class editing
 * - Instance/Element tab: Figma-style property editing via ComputedPropertyPanel
 *
 * Adapted from studio/src/client/components/editor-panel.tsx for surface:
 * - Uses data-source coordinates instead of EID markers
 * - Calls POST /api/write-element with source coordinates
 * - Calls POST /api/component for component class changes
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  MixerHorizontalIcon,
  Component1Icon,
  CursorArrowIcon,
  BoxIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  LayersIcon,
  DesktopIcon,
  FrameIcon,
  TransformIcon,
  RulerSquareIcon,
  DimensionsIcon,
  CornersIcon,
  ComponentInstanceIcon,
  TokensIcon,
} from "@radix-ui/react-icons";
import type { SelectedElementData, SourceLocation, ChangeIntent, WriteMode, AiModel, ElementMode } from "../../shared/protocol.js";
import { ModeToggle } from "./mode-toggle.js";
import { TerminalPanel } from "./terminal-panel.js";
import { AgentPanel } from "./agent-panel.js";
import type { ComponentEntry } from "../../server/lib/scan-components.js";
import type { ResolvedTailwindTheme } from "../../shared/tailwind-theme.js";
import { TokenEditor } from "./token-editor.js";
import { PropertyPanel } from "./property-panel.js";
import { ComputedPropertyPanel } from "./computed-property-panel.js";
import { Tooltip } from "./tooltip.js";
import { Logo } from "./logo.js";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ControlsGallery } from "./controls/controls-gallery.js";
import { StudioSelect, ToggleControl } from "./controls/index.js";
import {
  Maximize,
  Palette,
  Columns3,
  AlignLeft,
  Circle,
  ToggleLeft,
  Type,
  Bold,
  ArrowRightToLine,
  Activity,
  Layers,
  PanelTop,
  Sparkles,
} from "lucide-react";
import { useTokens, useComponents } from "../lib/scan-hooks.js";
import type { IndexedTokenMap } from "../lib/scan-store.js";
import { getEditability } from "../lib/editability.js";

type PanelTab = "selected" | "tokens" | "chat";

interface EditorPanelProps {
  element: SelectedElementData | null;
  theme: "light" | "dark";
  iframePath: string;
  stylingType: string;
  tailwindTheme?: ResolvedTailwindTheme | null;
  onPreviewToken: (token: string, value: string) => void;
  onClearTokenPreview: () => void;
  onPreviewShadow: (variableName: string, value: string, shadowName?: string) => void;
  onPreviewInlineStyle: (property: string, value: string) => void;
  onRevertInlineStyles: () => void;
  onClose: () => void;
  onReselectElement: () => void;
  onToggleUsagePanel?: () => void;
  onIsolate?: (entry: ComponentEntry) => void;
  onSelectParentInstance?: () => void;
  // AI mode
  writeMode?: WriteMode;
  aiModel?: AiModel;
  toolPort?: number;
  onWriteModeChange?: (mode: WriteMode) => void;
  onAiModelChange?: (model: AiModel) => void;
  /** Increment to force terminal reconnect */
  terminalKey?: number;
  elementMode: ElementMode;
  onElementModeChange: (mode: ElementMode) => void;
  inLoop?: boolean;
  hasDynamicContent?: boolean;
  dataOrigin?: "local" | "external";
  iteratorExpression?: string;
}

/** Open a file in the user's editor via the local server. */
function openInEditor(file: string, line?: number, col?: number) {
  const params = new URLSearchParams({ file });
  if (line != null) params.set("line", String(line));
  if (col != null) params.set("col", String(col));
  fetch(`/api/open-file?${params}`).catch(console.error);
}

export function EditorPanel({
  element,
  theme,
  iframePath,
  stylingType,
  onPreviewToken,
  onClearTokenPreview,
  onPreviewShadow,
  onPreviewInlineStyle,
  onRevertInlineStyles,
  onClose,
  onReselectElement,
  onToggleUsagePanel,
  onIsolate,
  onSelectParentInstance,
  tailwindTheme,
  writeMode = "deterministic",
  aiModel = "sonnet",
  toolPort = 4400,
  onWriteModeChange,
  onAiModelChange,
  terminalKey = 0,
  elementMode,
  onElementModeChange,
  inLoop = false,
  hasDynamicContent = false,
  dataOrigin,
  iteratorExpression,
}: EditorPanelProps) {
  const tokenData = useTokens();
  const componentData = useComponents();

  const dataSlot = element?.attributes?.["data-slot"] || null;
  const isComponent = !!dataSlot;
  const componentEntry = dataSlot
    ? componentData?.byDataSlot.get(dataSlot) ?? null
    : null;

  const [panelTab, setPanelTab] = useState<PanelTab>("selected");
  const [chatSubTab, setChatSubTab] = useState<"terminal" | "agent">("agent");

  // Pending changes accumulated in AI mode
  const [pendingChanges, setPendingChanges] = useState<ChangeIntent[]>([]);

  const addPendingChange = useCallback((intent: ChangeIntent) => {
    setPendingChanges((prev) => {
      const key = intent.elementSource
        ? `${intent.property}:${intent.elementSource.file}:${intent.elementSource.line}`
        : `token:${intent.property}`;
      const filtered = prev.filter((c) => {
        const cKey = c.elementSource
          ? `${c.property}:${c.elementSource.file}:${c.elementSource.line}`
          : `token:${c.property}`;
        return cKey !== key;
      });
      return [...filtered, intent];
    });
  }, []);

  // Clear pending changes when element changes
  useEffect(() => {
    setPendingChanges([]);
  }, [element?.source?.file, element?.source?.line]);


  const [propsSectionCollapsed, setPropsSectionCollapsed] = useState(true);
  const [saving, setSaving] = useState(false);
  // Serialize writes so only one goes at a time
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  const editability = getEditability(element);
  const isNpmComponent = editability !== "full";

  const elementName = element
    ? isComponent
      ? componentEntry?.name || dataSlot
      : element.componentName
        ? element.componentName
        : `<${element.tag}>`
    : null;

  const tokenRefs = extractTokenReferences(element?.className || "", tokenData);

  // Fetch current prop values for component instances (variant, size, etc.)
  const [instanceProps, setInstanceProps] = useState<Record<string, string> | null>(null);
  const [instancePropsVersion, setInstancePropsVersion] = useState(0);
  useEffect(() => {
    if (!isComponent || !element?.instanceSource || !element?.componentName) {
      setInstanceProps(null);
      return;
    }
    const src = element.instanceSource;
    const params = new URLSearchParams({
      file: src.file,
      line: String(src.line),
      componentName: element.componentName,
    });
    if (src.col != null) params.set("col", String(src.col));
    fetch(`/api/write-element/instance-props?${params}`)
      .then((r) => r.json())
      .then((data) => setInstanceProps(data.props ?? null))
      .catch(() => setInstanceProps(null));
  }, [element?.instanceSource?.file, element?.instanceSource?.line, element?.instanceSource?.col, element?.componentName, isComponent, instancePropsVersion]);

  const isCssMode = !!stylingType && !stylingType.startsWith("tailwind");
  const isAiMode = writeMode === "ai";

  /** In AI mode, accumulate a ChangeIntent instead of immediately writing. */
  const handleAiCommitClass = useCallback(
    (tailwindClass: string, oldClass: string | undefined) => {
      const targetSource = elementMode === "component"
        ? element?.source
        : element?.instanceSource ?? element?.source;
      if (!targetSource) return;
      addPendingChange({
        type: "class",
        property: inferCssPropertyFromClass(tailwindClass),
        fromValue: oldClass ?? "",
        toValue: tailwindClass,
        elementSource: targetSource,
        currentClassName: element?.className ?? "",
      });
    },
    [element, elementMode, addPendingChange],
  );

  const handleAiCommitStyle = useCallback(
    (prop: string, val: string) => {
      const targetSource = elementMode === "component"
        ? element?.source
        : element?.instanceSource ?? element?.source;
      if (!targetSource) return;
      addPendingChange({
        type: "style",
        property: prop,
        fromValue: element?.computed?.[prop] ?? "",
        toValue: val,
        elementSource: targetSource,
        currentClassName: element?.className ?? "",
      });
    },
    [element, elementMode, addPendingChange],
  );

  const withSave = async (fn: () => Promise<void>) => {
    const queued = writeQueueRef.current.then(async () => {
      setSaving(true);
      try {
        await fn();
        // Wait for HMR to apply the new Tailwind class, then reselect
        // and revert any inline style previews (order matters: revert
        // AFTER HMR so there's no flicker/layout shift).
        setTimeout(() => {
          onReselectElement();
          onRevertInlineStyles();
        }, 500);
      } catch (err) {
        console.error("Write error:", err);
      } finally {
        setTimeout(() => setSaving(false), 1200);
      }
    });
    writeQueueRef.current = queued;
    return queued;
  };

  return (
    <div
      className="flex flex-col border-l"
      style={{
        width: 350,
        minWidth: 350,
        background: "var(--studio-surface)",
        borderColor: "var(--studio-border)",
      }}
    >
      {/* ── Element header — always visible when element is selected ── */}
      {element && (
        <div className="shrink-0 border-b px-4 pt-3 pb-2" style={{ borderColor: "var(--studio-border)" }}>
          <div className="flex items-center gap-2 mb-1">
            {/* Element name — click to open actions dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    padding: "2px 6px 2px 2px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: "var(--studio-text)",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 5,
                    minWidth: 0,
                    maxWidth: 160,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--studio-surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  data-testid="editor-element-name"
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {elementName}
                  </span>
                  <ChevronDownIcon style={{ opacity: 0.4, flexShrink: 0, width: 12, height: 12 }} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="studio-popup-dark"
                  sideOffset={6}
                  align="start"
                  style={{ zIndex: 9999 }}
                  onEscapeKeyDown={(e) => e.stopPropagation()}
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  {isComponent && onToggleUsagePanel && (
                    <DropdownMenu.Item
                      className="studio-dropdown-item"
                      onSelect={onToggleUsagePanel}
                    >
                      <LayersIcon style={{ width: 13, height: 13, opacity: 0.5, flexShrink: 0 }} />
                      <span>View usage</span>
                    </DropdownMenu.Item>
                  )}
                  {isComponent && onIsolate && componentEntry && (
                    <DropdownMenu.Item
                      className="studio-dropdown-item"
                      onSelect={() => onIsolate(componentEntry)}
                    >
                      <TransformIcon style={{ width: 13, height: 13, opacity: 0.5, flexShrink: 0 }} />
                      <span>Isolate component</span>
                    </DropdownMenu.Item>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            <div style={{ flex: 1 }} />

            {editability === "full" && element.instanceSource && (
              <button
                className="studio-switch studio-switch--sm"
                data-mode={elementMode}
                data-testid="editor-tabs"
                onClick={() => onElementModeChange(elementMode === "instance" ? "component" : "instance")}
              >
                <span className="studio-switch-knob">
                  {elementMode === "instance"
                    ? <ComponentInstanceIcon style={{ width: 10, height: 10 }} />
                    : <Component1Icon style={{ width: 10, height: 10 }} />}
                </span>
                <span className="studio-switch-label">
                  {elementMode === "instance" ? "Instance" : "Component"}
                </span>
              </button>
            )}
            {saving && (
              <span
                className="flex items-center gap-0.5 text-[10px] shrink-0"
                style={{ color: "var(--studio-success)" }}
                data-testid="save-indicator"
              >
                <CheckIcon style={{ width: 10, height: 10 }} /> Saved
              </span>
            )}
          </div>
          {/* File path — changes based on elementMode */}
          {(element.source || componentEntry?.filePath || element.packageName) && (
            <div>
              {(element.source || componentEntry?.filePath) ? (
                <button
                  onClick={() => {
                    const src = elementMode === "instance" && element.instanceSource
                      ? element.instanceSource
                      : element.source;
                    if (src) openInEditor(src.file, src.line, src.col);
                    else if (componentEntry?.filePath) openInEditor(componentEntry.filePath, 1, 0);
                  }}
                  className="text-[10px] font-mono truncate block text-left w-full"
                  style={{ color: "var(--studio-text-dimmed)", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
                  title="Open in editor"
                >
                  {(() => {
                    const src = elementMode === "instance" && element.instanceSource
                      ? element.instanceSource
                      : element.source;
                    return src ? `${src.file}:${src.line}` : componentEntry?.filePath;
                  })()}
                </button>
              ) : element.packageName ? (
                <span className="text-[10px] font-mono truncate block" style={{ color: "var(--studio-text-dimmed)", opacity: 0.6 }}>
                  {element.packageName}
                </span>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* ── Top-level tab bar ── always visible */}
      <div
        className="shrink-0 border-b px-3 py-2"
        style={{ borderColor: "var(--studio-border)" }}
      >
        <div className="studio-segmented" style={{ width: "100%" }}>
          <button
            onClick={() => setPanelTab("selected")}
            className={panelTab === "selected" ? "active" : ""}
            style={{ flex: 1 }}
            data-testid="panel-tab-selected"
          >
            <CursorArrowIcon style={{ width: 11, height: 11 }} />
            Selected
          </button>
          <button
            onClick={() => setPanelTab("tokens")}
            className={panelTab === "tokens" ? "active" : ""}
            style={{ flex: 1 }}
            data-testid="panel-tab-tokens"
          >
            <TokensIcon style={{ width: 11, height: 11 }} />
            Tokens
          </button>
          <button
            onClick={() => setPanelTab("chat")}
            className={panelTab === "chat" ? "active" : ""}
            style={{ flex: 1 }}
            data-testid="panel-tab-chat"
          >
            <Sparkles style={{ width: 11, height: 11 }} />
            {`Chat${pendingChanges.length > 0 ? ` (${pendingChanges.length})` : ""}`}
          </button>
        </div>
      </div>

      {/* ── SELECTED TAB ── */}
      {panelTab === "selected" && (
        <div className="flex flex-col flex-1 min-h-0">
          {!element ? (
            <>
              {typeof window !== "undefined" && new URLSearchParams(window.location.search).has("gallery") ? (
                <div className="flex-1 overflow-y-auto studio-scrollbar">
                  <ControlsGallery />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 gap-5 studio-empty-state">
                  <div className="studio-empty-click-target">
                    <Logo
                      className="studio-empty-logo"
                      style={{ width: 130, height: 130,  }}
                    />
                    <svg className="studio-empty-cursor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
                      <polygon fill="#fff" points="7,5 7,19 9,17 11,15 17,15 13,11 11,9 9,7" />
                      <path fill="currentColor" d="M6 4h2v16H6zm2 0h2v2H8zm2 2h2v2h-2zm2 2h2v2h-2zm2 2h2v2h-2zm2 2h2v2h-2zm-8 6h2v2H8zm2-2h2v2h-2zm2-2h6v2h-6z"/>
                    </svg>
                  </div>
                  <p className="studio-empty-text">
                    Select an element
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Scrollable property content */}
              <div className="flex-1 overflow-y-auto studio-scrollbar">
                {/* Repeated element write warning */}
                {inLoop && (
                  <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--studio-border-subtle)" }}>
                    <div className="text-[10px] px-2 py-1.5 rounded" style={{ color: "#a78bfa", background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
                      <span style={{ fontWeight: 600 }}>Repeated element</span>
                      {" — "}edits affect all instances
                      {dataOrigin === "local" ? ", using local data defined in this file" : ""}.
                      {iteratorExpression && (
                        <span style={{ display: "block", marginTop: 3, fontFamily: "ui-monospace, monospace", color: "#c4b5fd", fontSize: 9 }}>
                          {iteratorExpression}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* npm component notice */}
                {isNpmComponent && element.instanceSource && (
                  <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--studio-border-subtle)" }}>
                    <div className="text-[10px] px-2 py-1.5 rounded" style={{ color: "var(--studio-text-dimmed)", background: "var(--studio-surface-hover)" }}>
                      Editing instance in{" "}
                      <span className="font-mono">{element.instanceSource.file.split("/").pop()}:{element.instanceSource.line}</span>
                    </div>
                  </div>
                )}

                {/* COMPONENT mode content */}
                {elementMode === "component" && isComponent && (
                  <>
                    {/* Props section — variant class editing */}
                    {componentEntry && componentEntry.variants.filter((d: any) => !isBooleanDim(d)).length > 0 && (
                      <ComponentPropsSection
                        componentEntry={componentEntry}
                        theme={tailwindTheme}
                        onClassChange={(oldClass, newClass, variantContext) => {
                          withSave(async () => {
                            await handleComponentClassChange(componentEntry.filePath, oldClass, newClass, variantContext);
                          });
                        }}
                      />
                    )}

                    {/* Styles section */}
                    <ComputedPropertyPanel
                      tag={element.tag}
                      className={element.className}
                      computedStyles={element.computed}
                      parentComputedStyles={element.parentComputed || {}}
                      authoredStyles={element.authored}
                      isReadOnly={editability === "inspect-only"}
                      readOnlyPackageName={element.packageName ?? undefined}
                      onSelectParentInstance={onSelectParentInstance}
                      onPreviewInlineStyle={onPreviewInlineStyle}
                      onRevertInlineStyles={onRevertInlineStyles}
                      onCommitClass={isCssMode && !isAiMode ? () => {} : (tailwindClass, oldClass) => {
                        if (oldClass && tailwindClass === oldClass) return;
                        if (isAiMode) { handleAiCommitClass(tailwindClass, oldClass); return; }
                        const isCva = componentEntry && componentEntry.variants.length > 0;
                        if (isCva) {
                          if (oldClass) {
                            withSave(async () => {
                              await handleComponentClassChange(componentEntry.filePath, oldClass, tailwindClass);
                            });
                          } else if (element.source) {
                            const source = element.source;
                            withSave(async () => {
                              await handleWriteElement(source, "addClass", tailwindClass, undefined, element.activeBreakpoint);
                            });
                          }
                        } else if (element.source) {
                          const source = element.source;
                          if (oldClass) {
                            withSave(async () => {
                              await handleWriteElement(source, "replaceClass", tailwindClass, oldClass, element.activeBreakpoint);
                            });
                          } else {
                            withSave(async () => {
                              await handleWriteElement(source, "addClass", tailwindClass, undefined, element.activeBreakpoint);
                            });
                          }
                        }
                      }}
                      onCommitStyle={isCssMode && element.source ? (prop, val) => {
                        if (isAiMode) { handleAiCommitStyle(prop, val); return; }
                        const source = element.source!;
                        withSave(() => handleWriteStyle(source, prop, val, element.activeBreakpoint));
                      } : undefined}
                      theme={tailwindTheme}
                    />
                  </>
                )}

                {/* INSTANCE mode content */}
                {(elementMode === "instance" || !isComponent) && (
                  <>
                    {/* Props section — collapsible, shown first when variants exist */}
                    {isComponent && componentEntry && componentEntry.variants.length > 0 && (
                      <div style={{ borderTop: "1px solid var(--studio-border-subtle)" }}>
                        <button
                          onClick={() => setPropsSectionCollapsed(!propsSectionCollapsed)}
                          className="studio-section-hdr"
                          data-testid="instance-props-section"
                        >
                          <span style={{ flex: 1, textAlign: "left" }}>Props</span>
                          <span style={{ opacity: 0.35, display: "flex", alignItems: "center", marginLeft: "auto" }}>
                            {propsSectionCollapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
                          </span>
                        </button>
                        {!propsSectionCollapsed && (
                          <div>
                            {componentEntry.variants.map((dim: any) => (
                              <InstanceVariantSection
                                key={dim.name}
                                dim={dim}
                                currentValue={
                                  (element?.fiberProps?.[dim.name] != null ? String(element.fiberProps[dim.name]) : null)
                                    ?? instanceProps?.[dim.name]
                                    ?? dim.default
                                    ?? null
                                }
                                onSelect={(value) => {
                                  if (!element.instanceSource || !element.componentName) return;
                                  withSave(async () => {
                                    await handleInstancePropChange(element.instanceSource!, element.componentName!, dim.name, value);
                                    setInstancePropsVersion((v) => v + 1);
                                  });
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Styles */}
                    <ComputedPropertyPanel
                      tag={element.tag}
                      className={element.className}
                      computedStyles={element.computed}
                      parentComputedStyles={element.parentComputed || {}}
                      authoredStyles={element.authored}
                      isReadOnly={editability === "inspect-only"}
                      readOnlyPackageName={element.packageName ?? undefined}
                      onSelectParentInstance={onSelectParentInstance}
                      onPreviewInlineStyle={onPreviewInlineStyle}
                      onRevertInlineStyles={onRevertInlineStyles}
                      onCommitClass={isCssMode && !isAiMode ? () => {} : (tailwindClass, oldClass) => {
                        if (oldClass && tailwindClass === oldClass) return;
                        if (isAiMode) { handleAiCommitClass(tailwindClass, oldClass); return; }
                        if (element.instanceSource && element.componentName) {
                          withSave(async () => {
                            await handleInstanceOverride(element.instanceSource!, element.componentName!, tailwindClass, oldClass || undefined);
                          });
                        } else if (element.source) {
                          const source = element.source;
                          if (oldClass) {
                            withSave(async () => {
                              await handleWriteElement(source, "replaceClass", tailwindClass, oldClass, element.activeBreakpoint);
                            });
                          } else {
                            withSave(async () => {
                              await handleWriteElement(source, "addClass", tailwindClass, undefined, element.activeBreakpoint);
                            });
                          }
                        }
                      }}
                      onCommitStyle={isCssMode && element.source ? (prop, val) => {
                        if (isAiMode) { handleAiCommitStyle(prop, val); return; }
                        const source = element.source!;
                        withSave(() => handleWriteStyle(source, prop, val, element.activeBreakpoint));
                      } : undefined}
                      theme={tailwindTheme}
                    />
                  </>
                )}
              </div>{/* end scrollable content */}
            </>
          )}
        </div>
      )}{/* end selected tab */}


      {/* ── TOKENS TAB ── */}
      {panelTab === "tokens" && (
        <div className="flex-1 overflow-y-auto studio-scrollbar">
          <TokenEditor
            tokenRefs={tokenRefs}
            theme={theme}
            onPreviewToken={onPreviewToken}
            onClearTokenPreview={onClearTokenPreview}
            onPreviewShadow={onPreviewShadow}
            isAiMode={isAiMode}
            onAiTokenIntent={(tokenName, fromValue, toValue, cssFilePath) => {
              addPendingChange({
                type: "token",
                property: tokenName,
                fromValue,
                toValue,
                currentClassName: "",
                cssFilePath,
              });
            }}
          />
        </div>
      )}

      {/* ── CHAT TAB ── Always mounted so the PTY process is never killed on tab switch */}
      <div style={{ flex: 1, minHeight: 0, display: panelTab === "chat" ? "flex" : "none", flexDirection: "column" }}>
        {/* Sub-tab toggle: Agent / Terminal */}
        <div className="studio-sub-tabs" style={{ margin: "8px 12px 4px" }}>
          <button
            className={chatSubTab === "agent" ? "active" : ""}
            onClick={() => setChatSubTab("agent")}
          >
            Agent
          </button>
          <button
            className={chatSubTab === "terminal" ? "active" : ""}
            onClick={() => setChatSubTab("terminal")}
          >
            Terminal
          </button>
        </div>

        {/* Terminal — always mounted (display:none keeps PTY alive) */}
        <div style={{ flex: 1, minHeight: 0, display: chatSubTab === "terminal" ? "flex" : "none", flexDirection: "column" }}>
          <TerminalPanel
            key={terminalKey}
            toolPort={toolPort}
            model={aiModel}
            element={element}
            elementMode={elementMode}
            pendingChanges={pendingChanges}
            onClearPendingChanges={() => setPendingChanges([])}
            onRemovePendingChange={(idx) =>
              setPendingChanges((prev) => prev.filter((_, i) => i !== idx))
            }
          />
        </div>

        {/* Agent — always mounted (preserves chat history) */}
        <div style={{ flex: 1, minHeight: 0, display: chatSubTab === "agent" ? "flex" : "none", flexDirection: "column" }}>
          <AgentPanel
            toolPort={toolPort}
            model={aiModel}
            element={element}
            elementMode={elementMode}
            pendingChanges={pendingChanges}
            onClearPendingChanges={() => setPendingChanges([])}
            inLoop={inLoop}
            hasDynamicContent={hasDynamicContent}
            dataOrigin={dataOrigin}
            iteratorExpression={iteratorExpression}
            onRemovePendingChange={(idx) =>
              setPendingChanges((prev) => prev.filter((_, i) => i !== idx))
            }
          />
        </div>
      </div>

      {/* ── Persistent footer: AI mode toggle + pending intents ── */}
      <div
        className="shrink-0 border-t"
        style={{
          borderColor: "var(--studio-border)",
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "var(--studio-surface)",
          flexWrap: "nowrap",
          minHeight: 36,
        }}
      >
        <ModeToggle
          writeMode={writeMode}
          onWriteModeChange={onWriteModeChange ?? (() => {})}
        />
        <span style={{ fontSize: 11, color: "var(--studio-text-dimmed)", flexShrink: 0 }}>AI Mode</span>
        {isAiMode && pendingChanges.length > 0 && (
          <>
            <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 3, overflow: "hidden", minWidth: 0 }}>
              {pendingChanges.slice(0, 3).map((c, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 9,
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: "color-mix(in srgb, var(--studio-accent) 10%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--studio-accent) 25%, transparent)",
                    color: "var(--studio-accent)",
                    whiteSpace: "nowrap",
                    maxWidth: 80,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={`${c.property}: ${c.fromValue} → ${c.toValue}`}
                >
                  {c.property}
                </span>
              ))}
              {pendingChanges.length > 3 && (
                <span style={{ fontSize: 9, color: "var(--studio-text-dimmed)" }}>
                  +{pendingChanges.length - 3}
                </span>
              )}
            </div>
            <button
              onClick={() => { setPanelTab("chat"); setChatSubTab("agent"); }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontSize: 10,
                padding: "2px 8px",
                height: 22,
                background: "var(--studio-accent)",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: 500,
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
              title="Switch to Agent chat with these intents"
            >
              Send {pendingChanges.length} →
            </button>
          </>
        )}
        {(!isAiMode || pendingChanges.length === 0) && <div style={{ flex: 1 }} />}
      </div>
    </div>
  );
}

// --- Collapsible variant sections ---

function ComponentPropsSection({
  componentEntry,
  onClassChange,
  theme,
}: {
  componentEntry: any;
  onClassChange: (oldClass: string, newClass: string, variantContext: string) => void;
  theme?: ResolvedTailwindTheme | null;
}) {
  const tokenData = useTokens();
  const [collapsed, setCollapsed] = useState(true);
  const dims = componentEntry.variants.filter((d: any) => !isBooleanDim(d));

  return (
    <div style={{ borderTop: "1px solid var(--studio-border-subtle)" }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="studio-section-hdr"
        data-testid="component-props-section"
      >
        <span style={{ flex: 1, textAlign: "left" }}>Props</span>
        <span style={{ opacity: 0.35, display: "flex", alignItems: "center", marginLeft: "auto" }}>
          {collapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
        </span>
      </button>

      {!collapsed && (
        <div>
          {dims.map((dim: any) => (
            <ComponentVariantDim
              key={dim.name}
              dim={dim}
              onClassChange={onClassChange}
              tokenGroups={tokenData?.groups || {}}
              theme={theme}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ComponentVariantDim({
  dim,
  onClassChange,
  tokenGroups,
  theme,
}: {
  dim: any;
  onClassChange: (oldClass: string, newClass: string, variantContext: string) => void;
  tokenGroups: Record<string, any[]>;
  theme?: ResolvedTailwindTheme | null;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set());

  const toggleOption = (opt: string) => {
    const next = new Set(expandedOptions);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    setExpandedOptions(next);
  };

  return (
    <div style={{ borderTop: "1px solid var(--studio-border-subtle)" }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="studio-section-hdr"
        style={{ fontSize: 10, paddingLeft: 16 }}
        data-testid={`component-variant-section-${dim.name}`}
      >
        <span style={{ color: "var(--studio-text)", fontWeight: 600, flex: 1, textAlign: "left" }}>
          {dim.name}
        </span>
        <span style={{ opacity: 0.35, display: "flex", alignItems: "center", marginLeft: "auto" }}>
          {collapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
        </span>
      </button>

      {!collapsed && (
        <div style={{ padding: "0 16px 8px" }}>
          <div className="studio-tree">
            {dim.options.map((opt: string) => (
              <div key={opt} className="studio-tree-node">
                <button
                  onClick={() => toggleOption(opt)}
                  className="studio-section-hdr"
                  style={{ fontSize: 10 }}
                >
                  <span style={{ color: "var(--studio-text)", fontWeight: 600, flex: 1, textAlign: "left" }}>
                    {opt}
                  </span>
                  {opt === dim.default && (
                    <span
                      className="text-[9px] font-normal"
                      style={{ color: "var(--studio-text-dimmed)" }}
                    >
                      default
                    </span>
                  )}
                  <span style={{ opacity: 0.35, display: "flex", alignItems: "center", marginLeft: "auto" }}>
                    {expandedOptions.has(opt) ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  </span>
                </button>

                {expandedOptions.has(opt) && dim.classes[opt] && (
                  <div className="studio-tree-content">
                    <PropertyPanel
                      classes={dim.classes[opt]}
                      onClassChange={(oldClass, newClass) => {
                        onClassChange(oldClass, newClass, opt);
                      }}
                      tokenGroups={tokenGroups}
                      theme={theme}
                      flat
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Instance variant section (label + StudioSelect dropdown) ---

const PROP_ICON_MAP: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  variant: ComponentInstanceIcon,
  size: DimensionsIcon,
  color: Palette,
  layout: Columns3,
  align: AlignLeft,
  alignment: AlignLeft,
  shape: Circle,
  radius: CornersIcon,
  type: Type,
  disabled: ToggleLeft,
  state: ToggleLeft,
  weight: Bold,
  fullwidth: ArrowRightToLine,
  status: Activity,
  elevation: Layers,
  border: PanelTop,
  animation: Sparkles,
};

function isBooleanDim(dim: any): boolean {
  const opts = dim.options.map((o: string) => o.toLowerCase());
  return opts.length === 2 && opts.includes("true") && opts.includes("false");
}

function InstanceVariantSection({
  dim,
  currentValue,
  onSelect,
}: {
  dim: any;
  currentValue: string | null;
  onSelect: (value: string) => void;
}) {
  const effectiveValue = currentValue ?? dim.default ?? dim.options[0] ?? "";
  const propKey = dim.name.toLowerCase();
  const icon = PROP_ICON_MAP[propKey];
  const isBoolean = isBooleanDim(dim);

  return (
    <div className="px-4 py-2" style={{ borderTop: "1px solid var(--studio-border-subtle)" }}>
      <div
        className="text-[10px] font-semibold uppercase tracking-wide mb-2"
        style={{ color: "var(--studio-text-muted)" }}
      >
        {dim.name}
      </div>
      {isBoolean ? (
        <ToggleControl
          value={effectiveValue === "true"}
          onChange={(checked) => onSelect(String(checked))}
          label={effectiveValue === "true" ? "On" : "Off"}
          icon={icon}
          tooltip={dim.name}
        />
      ) : (
        <StudioSelect
          value={effectiveValue}
          onChange={onSelect}
          options={dim.options.map((opt: string) => ({ value: opt, label: opt }))}
          icon={icon}
          tooltip={dim.name}
          data-testid={`instance-prop-${dim.name}`}
        />
      )}
    </div>
  );
}

// --- API call helpers ---

async function handleWriteElement(
  source: SourceLocation,
  type: "replaceClass" | "addClass",
  newClass: string,
  oldClass?: string,
  activeBreakpoint?: string | null,
) {
  try {
    const res = await fetch("/api/write-element", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source,
        type,
        newClass,
        oldClass: oldClass || undefined,
        activeBreakpoint: activeBreakpoint || undefined,
      }),
    });
    const data = await res.json();
    if (!data.ok) console.error("Element write failed:", data.error);
  } catch (err) {
    console.error("Element write error:", err);
  }
}

async function handleInstanceOverride(
  instanceSource: SourceLocation,
  componentName: string,
  newClass: string,
  oldClass?: string,
) {
  try {
    const res = await fetch("/api/write-element", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "instanceOverride",
        source: instanceSource,
        componentName,
        newClass,
        oldClass: oldClass || undefined,
      }),
    });
    const data = await res.json();
    if (!data.ok) console.error("Instance override failed:", data.error);
  } catch (err) {
    console.error("Instance override error:", err);
  }
}

async function handleInstancePropChange(
  source: SourceLocation,
  componentName: string,
  propName: string,
  propValue: string,
) {
  try {
    const res = await fetch("/api/write-element", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "prop", source, componentName, propName, propValue }),
    });
    const data = await res.json();
    if (!data.ok) console.error("Prop write failed:", data.error);
  } catch (err) {
    console.error("Prop write error:", err);
  }
}

async function handleWriteStyle(
  source: SourceLocation,
  property: string,
  value: string,
  activeBreakpoint?: string | null,
) {
  try {
    const res = await fetch("/api/write-element", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "cssProperty",
        source,
        changes: [{ property, value }],
        activeBreakpoint: activeBreakpoint || undefined,
      }),
    });
    const data = await res.json();
    if (!data.ok) console.error("CSS write failed:", data.error);
  } catch (err) {
    console.error("CSS write error:", err);
  }
}

async function handleComponentClassChange(
  filePath: string,
  oldClass: string,
  newClass: string,
  variantContext?: string
) {
  try {
    const res = await fetch("/api/component", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath, oldClass, newClass, variantContext }),
    });
    const data = await res.json();
    if (!data.ok) console.error("Component write failed:", data.error);
  } catch (err) {
    console.error("Component write error:", err);
  }
}

/** Infer a rough CSS property name from a Tailwind class for ChangeIntent labeling. */
function inferCssPropertyFromClass(cls: string): string {
  const prefix = cls.replace(/^(sm:|md:|lg:|xl:|2xl:|dark:|hover:|focus:)+/, "").split("-")[0];
  const map: Record<string, string> = {
    p: "padding", px: "padding-x", py: "padding-y",
    pt: "padding-top", pr: "padding-right", pb: "padding-bottom", pl: "padding-left",
    m: "margin", mx: "margin-x", my: "margin-y",
    mt: "margin-top", mr: "margin-right", mb: "margin-bottom", ml: "margin-left",
    w: "width", h: "height", "min-w": "min-width", "max-w": "max-width",
    "min-h": "min-height", "max-h": "max-height",
    text: "font-size", font: "font-weight", leading: "line-height",
    tracking: "letter-spacing", bg: "background-color", border: "border",
    rounded: "border-radius", gap: "gap", flex: "flex", grid: "grid",
    col: "grid-column", row: "grid-row", opacity: "opacity",
  };
  return map[prefix] ?? prefix;
}

function extractTokenReferences(
  className: string,
  tokenData: IndexedTokenMap | null,
): string[] {
  if (!tokenData || !className) return [];

  const tokens = new Set<string>();
  const classes = className.split(/\s+/);

  for (const cls of classes) {
    const match = cls.match(
      /(?:bg|text|border|ring|outline|shadow)-([a-z][\w-]*)/
    );
    if (match) {
      const ref = match[1].split("/")[0];
      const tokenName = `--${ref}`;
      if (tokenData.byName.has(tokenName)) tokens.add(tokenName);
    }
  }

  return Array.from(tokens);
}
