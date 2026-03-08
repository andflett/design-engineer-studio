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
  Cross2Icon,
  MixerHorizontalIcon,
  Component1Icon,
  CursorArrowIcon,
  BoxIcon,
  CheckIcon,
  ChevronRightIcon,
  ChevronDownIcon,
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
import type { SelectedElementData, SourceLocation, ChangeIntent, WriteMode, AiModel } from "../../shared/protocol.js";
import { ModeToggle } from "./mode-toggle.js";
import { TerminalPanel } from "./terminal-panel.js";
import type { ComponentEntry } from "../../server/lib/scan-components.js";
import type { ResolvedTailwindTheme } from "../../shared/tailwind-theme.js";
import { TokenEditor } from "./token-editor.js";
import { PropertyPanel } from "./property-panel.js";
import { ComputedPropertyPanel } from "./computed-property-panel.js";
import { Tooltip, ExplainerNote } from "./tooltip.js";
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

type EditMode = "token" | "component" | "instance";
type PanelTab = "editor" | "chat";

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
}: EditorPanelProps) {
  const tokenData = useTokens();
  const componentData = useComponents();

  const dataSlot = element?.attributes?.["data-slot"] || null;
  const isComponent = !!dataSlot;
  const componentEntry = dataSlot
    ? componentData?.byDataSlot.get(dataSlot) ?? null
    : null;

  const availableModes: EditMode[] = isComponent
    ? ["token", "component", "instance"]
    : ["token", "instance"];

  const [activeMode, setActiveMode] = useState<EditMode>("token");
  const [panelTab, setPanelTab] = useState<PanelTab>("editor");

  // Pending changes accumulated in AI mode
  const [pendingChanges, setPendingChanges] = useState<ChangeIntent[]>([]);

  const addPendingChange = useCallback((intent: ChangeIntent) => {
    setPendingChanges((prev) => {
      // Replace existing entry for same property+source to avoid duplicates
      const key = `${intent.property}:${intent.elementSource.file}:${intent.elementSource.line}`;
      const filtered = prev.filter(
        (c) => `${c.property}:${c.elementSource.file}:${c.elementSource.line}` !== key,
      );
      return [...filtered, intent];
    });
  }, []);

  // Clear pending changes when element changes
  useEffect(() => {
    setPendingChanges([]);
  }, [element?.source?.file, element?.source?.line]);

  // Auto-select tab when a new element is selected
  useEffect(() => {
    if (!element) return;
    setActiveMode("instance");
    if (isComponent) {
      const hasVariants = componentEntry?.variants && componentEntry.variants.length > 0;
      setInstanceSubTab(hasVariants ? "props" : "styles");
    }
  }, [element?.source?.file, element?.source?.line, element?.source?.col]);

  const [componentSubTab, setComponentSubTab] = useState<"styles" | "props">("props");
  const [instanceSubTab, setInstanceSubTab] = useState<"props" | "styles">("props");
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
      if (!element?.source) return;
      addPendingChange({
        type: "class",
        property: inferCssPropertyFromClass(tailwindClass),
        fromValue: oldClass ?? "",
        toValue: tailwindClass,
        elementSource: element.source,
        currentClassName: element.className,
      });
    },
    [element, addPendingChange],
  );

  const handleAiCommitStyle = useCallback(
    (prop: string, val: string) => {
      if (!element?.source) return;
      addPendingChange({
        type: "style",
        property: prop,
        fromValue: element.computed?.[prop] ?? "",
        toValue: val,
        elementSource: element.source,
        currentClassName: element.className,
      });
    },
    [element, addPendingChange],
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

  const modeConfig: Record<EditMode, { icon: any; label: string }> = {
    token: { icon: TokensIcon, label: "Tokens" },
    component: { icon: Component1Icon, label: "Component" },
    instance: { icon: isComponent ? ComponentInstanceIcon : BoxIcon, label: isComponent ? "Instance" : "Element" },
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
      {/* Header */}
      {element && (
        <div
          className="border-b shrink-0"
          style={{ borderColor: "var(--studio-border)" }}
        >
          {/* Name row + actions */}
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <div
              className="w-5 h-5 rounded flex items-center justify-center shrink-0"
              style={{ background: "var(--studio-accent-muted)" }}
            >
              {isComponent ? (
                <Component1Icon
                  style={{
                    width: 12,
                    height: 12,
                    color: "var(--studio-accent)",
                  }}
                />
              ) : (
                <BoxIcon
                  style={{
                    width: 12,
                    height: 12,
                    color: "var(--studio-accent)",
                  }}
                />
              )}
            </div>
            <span
              className="text-[12px] font-semibold truncate flex-1 min-w-0"
              style={{ color: "var(--studio-text)" }}
              data-testid="editor-element-name"
            >
              {elementName}
            </span>
            {saving && (
              <span
                className="flex items-center gap-0.5 text-[10px] shrink-0"
                style={{ color: "var(--studio-success)" }}
                data-testid="save-indicator"
              >
                <CheckIcon style={{ width: 10, height: 10 }} />
                Saved
              </span>
            )}
            <div className="flex items-center shrink-0" style={{ gap: 2 }}>
              {isComponent && onToggleUsagePanel && (
                <Tooltip content="View usage across pages">
                  <button
                    onClick={onToggleUsagePanel}
                    className="studio-icon-btn"
                    style={{ width: 24, height: 24 }}
                  >
                    <LayersIcon />
                  </button>
                </Tooltip>
              )}
              {isComponent && onIsolate && componentEntry && (
                <Tooltip content="Isolate component">
                  <button
                    onClick={() => onIsolate(componentEntry)}
                    className="studio-icon-btn"
                    style={{ width: 24, height: 24 }}
                  >
                    <TransformIcon />
                  </button>
                </Tooltip>
              )}
              <button
                onClick={onClose}
                className="studio-icon-btn"
                style={{ width: 24, height: 24 }}
              >
                <Cross2Icon />
              </button>
            </div>
          </div>

          {/* File path — prefer element.source, fall back to scanned component filePath, then npm package */}
          {(element.source || componentEntry?.filePath || element.packageName || element.instanceSource) && (
            <div className="px-4 pb-2.5 pt-0.5">
              {(element.source || componentEntry?.filePath) ? (
                <button
                  onClick={() => {
                    if (element.source) {
                      openInEditor(element.source.file, element.source.line, element.source.col);
                    } else if (componentEntry?.filePath) {
                      openInEditor(componentEntry.filePath, 1, 0);
                    }
                  }}
                  className="text-[10px] font-mono truncate block text-left w-full"
                  style={{
                    color: "var(--studio-text-dimmed)",
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.textDecoration = "underline")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.textDecoration = "none")
                  }
                  title="Open in editor"
                >
                  {element.source
                    ? `${element.source.file}:${element.source.line}:${element.source.col}`
                    : componentEntry?.filePath}
                </button>
              ) : (
                <>
                  {element.packageName && (
                    <span
                      className="text-[10px] font-mono truncate block"
                      style={{ color: "var(--studio-text-dimmed)", opacity: 0.6 }}
                    >
                      {element.packageName}
                    </span>
                  )}
                  {element.instanceSource && (
                    <button
                      onClick={() => {
                        openInEditor(
                          element.instanceSource!.file,
                          element.instanceSource!.line,
                          element.instanceSource!.col,
                        );
                      }}
                      className="text-[10px] font-mono truncate block text-left w-full"
                      style={{
                        color: "var(--studio-text-dimmed)",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        marginTop: element.packageName ? 2 : 0,
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.textDecoration = "underline")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.textDecoration = "none")
                      }
                      title="Open instance in editor"
                    >
                      {`${element.instanceSource.file}:${element.instanceSource.line}`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {!element && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("gallery") && (
        <div className="flex-1 overflow-y-auto studio-scrollbar">
          <ControlsGallery />
        </div>
      )}

      {/* ── CHAT TAB ── Always mounted so the PTY process is never killed on tab switch */}
      <div style={{ flex: 1, minHeight: 0, display: panelTab === "chat" ? "flex" : "none", flexDirection: "column" }}>
        <TerminalPanel
          key={terminalKey}
          toolPort={toolPort}
          model={aiModel}
          element={element}
          pendingChanges={pendingChanges}
          onClearPendingChanges={() => setPendingChanges([])}
          onRemovePendingChange={(idx) =>
            setPendingChanges((prev) => prev.filter((_, i) => i !== idx))
          }
        />
      </div>

      {/* ── EDITOR TAB ── */}
      {panelTab === "editor" && (
        <>
          {/* Inner tabs row */}
          {element && (
            <div className="px-4 py-2.5 shrink-0" style={{ borderColor: "var(--studio-border)" }}>
              <div className="studio-segmented" style={{ width: "100%" }} data-testid="editor-tabs">
                {availableModes.map((mode) => {
                  const cfg = modeConfig[mode];
                  return (
                    <button
                      key={mode}
                      onClick={() => setActiveMode(mode)}
                      className={activeMode === mode ? "active" : ""}
                      style={{ flex: 1 }}
                      data-testid={`editor-tab-${mode}`}
                    >
                      <cfg.icon style={{ width: 12, height: 12 }} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Scrollable editor content */}
          <div className="flex-1 overflow-y-auto studio-scrollbar">
        {!element && (
          <div>
            <div
              className="px-4 pt-3 pb-3"
            >
              <div
                className="text-[10px] font-semibold uppercase tracking-wide mb-1"
                style={{ color: "var(--studio-text-muted)" }}
              >
                Design Tokens
              </div>
              <p className="text-[11px]" style={{ color: "var(--studio-text-dimmed)" }}>
                Global design tokens defined in your project. Edit values here to update every usage at once.
              </p>
            </div>
            <TokenEditor
              tokenRefs={tokenRefs}
              theme={theme}
              onPreviewToken={onPreviewToken}
              onClearTokenPreview={onClearTokenPreview}
              onPreviewShadow={onPreviewShadow}
            />
          </div>
        )}

        {activeMode === "token" && element && (
          <TokenEditor
            tokenRefs={tokenRefs}
            theme={theme}
            onPreviewToken={onPreviewToken}
            onClearTokenPreview={onClearTokenPreview}
            onPreviewShadow={onPreviewShadow}
          />
        )}

        {activeMode === "component" && element && isComponent && (
          <>
            {/* Sub-tabs: Props vs Styles */}
            <div
              className="px-4 py-2 border-t"
              style={{ borderColor: "var(--studio-border)" }}
            >
              <div className="studio-segmented" style={{ width: "100%" }}>
                <button
                  onClick={() => setComponentSubTab("props")}
                  className={componentSubTab === "props" ? "active" : ""}
                  style={{ flex: 1 }}
                  data-testid="component-subtab-props"
                >
                  Props
                </button>
                <button
                  onClick={() => setComponentSubTab("styles")}
                  className={componentSubTab === "styles" ? "active" : ""}
                  style={{ flex: 1 }}
                  data-testid="component-subtab-styles"
                >
                  Styles
                </button>
              </div>
            </div>

            {componentSubTab === "styles" && (
              <div className="">
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
                    const isCva =
                      componentEntry && componentEntry.variants.length > 0;
                    if (isCva) {
                      if (oldClass) {
                        withSave(async () => {
                          await handleComponentClassChange(
                            componentEntry.filePath,
                            oldClass,
                            tailwindClass,
                          );
                        });
                      } else if (element.source) {
                        const source = element.source;
                        withSave(async () => {
                          await handleWriteElement(
                            source,
                            "addClass",
                            tailwindClass,
                            undefined,
                            element.activeBreakpoint,
                          );
                        });
                      }
                    } else if (element.source) {
                      const source = element.source;
                      if (oldClass) {
                        withSave(async () => {
                          await handleWriteElement(
                            source,
                            "replaceClass",
                            tailwindClass,
                            oldClass,
                            element.activeBreakpoint,
                          );
                        });
                      } else {
                        withSave(async () => {
                          await handleWriteElement(
                            source,
                            "addClass",
                            tailwindClass,
                            undefined,
                            element.activeBreakpoint,
                          );
                        });
                      }
                    }
                  }}
                  onCommitStyle={(isCssMode || isAiMode) && element.source ? (prop, val) => {
                    if (isAiMode) { handleAiCommitStyle(prop, val); return; }
                    const source = element.source!;
                    withSave(() => handleWriteStyle(source, prop, val, element.activeBreakpoint));
                  } : undefined}
                  tailwindTheme={tailwindTheme}
                />
              </div>
            )}

            {componentSubTab === "props" &&
              componentEntry &&
              componentEntry.variants.length > 0 && (
                <div className="">
                  {componentEntry.variants
                    .filter((dim: any) => !isBooleanDim(dim))
                    .map((dim: any) => (
                    <ComponentVariantSection
                      key={dim.name}
                      dim={dim}
                      componentEntry={componentEntry}
                      tailwindTheme={tailwindTheme}
                      onClassChange={(oldClass, newClass, variantContext) => {
                        withSave(async () => {
                          await handleComponentClassChange(
                            componentEntry.filePath,
                            oldClass,
                            newClass,
                            variantContext,
                          );
                        });
                      }}
                    />
                  ))}

                </div>
              )}

            {componentSubTab === "props" &&
              (!componentEntry || componentEntry.variants.length === 0) && (
                <div className="px-4 py-3">
                  <ExplainerNote>
                    This component has no predefined style props. Edit its styles directly in the "Styles" tab.
                  </ExplainerNote>
                </div>
              )}
          </>
        )}

      

        {activeMode === "instance" && element && (
          <>
            {isNpmComponent && element.instanceSource && (
              <div
                className="px-3 py-2"
                style={{ borderBottom: "1px solid var(--studio-border-subtle)" }}
              >
                <div
                  className="text-[10px] px-2 py-1.5 rounded"
                  style={{
                    color: "var(--studio-text-dimmed)",
                    background: "var(--studio-surface-hover)",
                  }}
                >
                  Editing instance in{" "}
                  <span className="font-mono">
                    {element.instanceSource.file.split("/").pop()}:{element.instanceSource.line}
                  </span>
                </div>
              </div>
            )}
            {isComponent &&
            componentEntry &&
            componentEntry.variants.length > 0 ? (
              <>
                {/* Sub-tabs: Props vs Styles */}
                <div
                  className="px-4 py-2 border-t"
                  style={{ borderColor: "var(--studio-border)" }}
                >
                  <div className="studio-segmented" style={{ width: "100%" }}>
                    <button
                      onClick={() => setInstanceSubTab("props")}
                      className={instanceSubTab === "props" ? "active" : ""}
                      style={{ flex: 1 }}
                      data-testid="instance-subtab-props"
                    >
                      Props
                    </button>
                    <button
                      onClick={() => setInstanceSubTab("styles")}
                      className={instanceSubTab === "styles" ? "active" : ""}
                      style={{ flex: 1 }}
                      data-testid="instance-subtab-styles"
                    >
                      Styles
                    </button>
                  </div>
                </div>

                {instanceSubTab === "props" && (
                  <div className="">
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
                          if (!element.instanceSource || !element.componentName)
                            return;
                          withSave(async () => {
                            await handleInstancePropChange(
                              element.instanceSource!,
                              element.componentName!,
                              dim.name,
                              value,
                            );
                            setInstancePropsVersion((v) => v + 1);
                          });
                        }}
                      />
                    ))}
                  </div>
                )}

                {instanceSubTab === "styles" && (
                  <div className="">
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
                            await handleInstanceOverride(
                              element.instanceSource!,
                              element.componentName!,
                              tailwindClass,
                              oldClass || undefined,
                            );
                          });
                        }
                      }}
                      onCommitStyle={(isCssMode || isAiMode) && element.source ? (prop, val) => {
                        if (isAiMode) { handleAiCommitStyle(prop, val); return; }
                        const source = element.source!;
                        withSave(() => handleWriteStyle(source, prop, val));
                      } : undefined}
                      tailwindTheme={tailwindTheme}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="">
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
                    // Component instances: write to the usage site (instanceSource)
                    if (element.instanceSource && element.componentName) {
                      withSave(async () => {
                        await handleInstanceOverride(
                          element.instanceSource!,
                          element.componentName!,
                          tailwindClass,
                          oldClass || undefined,
                        );
                      });
                    } else if (element.source) {
                      const source = element.source;
                      if (oldClass) {
                        withSave(async () => {
                          await handleWriteElement(
                            source,
                            "replaceClass",
                            tailwindClass,
                            oldClass,
                            element.activeBreakpoint,
                          );
                        });
                      } else {
                        withSave(async () => {
                          await handleWriteElement(
                            source,
                            "addClass",
                            tailwindClass,
                            undefined,
                            element.activeBreakpoint,
                          );
                        });
                      }
                    }
                  }}
                  onCommitStyle={(isCssMode || isAiMode) && element.source ? (prop, val) => {
                    if (isAiMode) { handleAiCommitStyle(prop, val); return; }
                    const source = element.source!;
                    withSave(() => handleWriteStyle(source, prop, val, element.activeBreakpoint));
                  } : undefined}
                  tailwindTheme={tailwindTheme}
                />
              </div>
            )}
          </>
        )}
          </div>{/* end scrollable content */}

          {/* AI mode switch footer */}
          <div
            style={{
              borderTop: "1px solid var(--studio-border)",
              padding: "8px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
              background: "var(--studio-surface)",
            }}
          >
            <span style={{ fontSize: 11, color: "var(--studio-text-dimmed)" }}>AI Mode</span>
            <ModeToggle
              writeMode={writeMode}
              onWriteModeChange={onWriteModeChange ?? (() => {})}
            />
          </div>
        </>
      )}{/* end editor tab */}

      {/* ── Bottom tab switcher ── */}
      <div
        style={{
          borderTop: "1px solid var(--studio-border)",
          display: "flex",
          flexShrink: 0,
        }}
      >
        {(["editor", "chat"] as PanelTab[]).map((tab) => {
          const active = panelTab === tab;
          const showBadge = tab === "chat" && pendingChanges.length > 0;
          return (
            <button
              key={tab}
              onClick={() => setPanelTab(tab)}
              style={{
                flex: 1,
                height: 34,
                fontSize: 11,
                fontWeight: active ? 600 : 400,
                color: active ? "var(--studio-text)" : "var(--studio-text-dimmed)",
                background: active ? "var(--studio-surface-hover)" : "transparent",
                border: "none",
                borderRight: tab === "editor" ? "1px solid var(--studio-border)" : "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                transition: "background 0.1s, color 0.1s",
                textTransform: "capitalize",
              }}
            >
              {tab}
              {showBadge && (
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "var(--studio-accent)",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Collapsible variant sections ---

function ComponentVariantSection({
  dim,
  componentEntry,
  onClassChange,
  tailwindTheme,
}: {
  dim: any;
  componentEntry: any;
  onClassChange: (oldClass: string, newClass: string, variantContext: string) => void;
  tailwindTheme?: ResolvedTailwindTheme | null;
}) {
  const tokenData = useTokens();
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
        data-testid={`component-variant-section-${dim.name}`}
      >
        {collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
        {dim.name}
        <span className="count">{dim.options.length}</span>
      </button>

      {!collapsed && (
        <div className="studio-tree">
          {dim.options.map((opt: string) => (
            <div key={opt} className="studio-tree-node">
              <button
                onClick={() => toggleOption(opt)}
                className="studio-section-hdr"
                style={{ fontSize: 10 }}
              >
                {expandedOptions.has(opt) ? (
                  <ChevronDownIcon />
                ) : (
                  <ChevronRightIcon />
                )}
                <span style={{ color: "var(--studio-text)", fontWeight: 600 }}>
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
              </button>

              {expandedOptions.has(opt) && dim.classes[opt] && (
                <div className="studio-tree-content">
                  <PropertyPanel
                    classes={dim.classes[opt]}
                    onClassChange={(oldClass, newClass) => {
                      onClassChange(oldClass, newClass, opt);
                    }}
                    tokenGroups={tokenData?.groups || {}}
                    tailwindTheme={tailwindTheme}
                    flat
                  />
                </div>
              )}
            </div>
          ))}
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
