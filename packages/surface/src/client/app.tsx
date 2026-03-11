import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { PanelLeft, Settings, RefreshCw, ChevronDown } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { SelectedElementData, ComponentTreeNode, PreviewCombination, WriteMode, AiModel } from "../shared/protocol.js";
import type { ComponentEntry } from "../server/lib/scan-components.js";
import type { ResolvedTailwindTheme } from "../shared/tailwind-theme.js";
import { classifyCssProperties } from "../shared/css-scale-classifier.js";
import { usePostMessage } from "./lib/use-postmessage.js";
import { ToolChrome } from "./components/tool-chrome.js";
import { EditorPanel } from "./components/editor-panel.js";
import { TooltipProvider } from "./components/tooltip.js";
import { BootScreen } from "./components/boot-screen.js";
import { scanStore, type RawScanData } from "./lib/scan-store.js";
import { useScanReady, useComponents } from "./lib/scan-hooks.js";
import { UsagePanel } from "./components/usage-panel.js";
import { PageExplorer } from "./components/page-explorer.js";
import { IsolationView, generateCombinations } from "./components/isolation-view.js";
import { SettingsPage } from "./components/settings-page.js";

/** Set to false to skip the boot screen (disable before publishing) */
const SHOW_BOOT_SCREEN = false;

/**
 * Find the tree node ID that corresponds to the currently selected element.
 * Uses domPath matching — both the tree node IDs and SelectedElementData.domPath
 * use the same nth-child CSS selector path format.
 */
function findTreeIdForElement(
  tree: ComponentTreeNode[],
  element: SelectedElementData
): string | null {
  if (!element.domPath) return null;
  // The selected element's domPath may point to the exact element or a descendant.
  // Walk the tree looking for an exact match or the closest ancestor match.
  return findInTree(tree, element.domPath);
}

function findInTree(nodes: ComponentTreeNode[], domPath: string): string | null {
  for (const node of nodes) {
    if (node.id === domPath) return node.id;
    // Check if domPath starts with this node's id (descendant)
    const found = findInTree(node.children, domPath);
    if (found) return found;
  }
  return null;
}

export function App() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  /** Tracks the last selected element's domPath so we can re-select after iframe reload */
  const selectedDomPathRef = useRef<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [stylingType, setStylingType] = useState("");
  const [tailwindTheme, setTailwindTheme] = useState<ResolvedTailwindTheme | null>(null);
  const [writeMode, setWriteMode] = useState<WriteMode>("deterministic");
  const [aiModel, setAiModel] = useState<AiModel>("sonnet");
  const [toolPort, setToolPort] = useState(4400);
  const [projectRoot, setProjectRoot] = useState("");
  const [instructions, setInstructions] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"info" | "instructions">("info");
  const [iframeCssTheme, setIframeCssTheme] = useState<ResolvedTailwindTheme | null>(null);
  const [selectedElement, setSelectedElement] = useState<SelectedElementData | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    // Sync initial editor chrome theme
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = prefersDark ? "dark" : "light";
    document.documentElement.classList.toggle("light", initial === "light");
    return initial;
  });
  const [viewportWidth, setViewportWidth] = useState<number | "fill">("fill");
  const [zoom, setZoom] = useState(0.6);
  const [iframePath, setIframePath] = useState("/");
  const [injectedReady, setInjectedReady] = useState(false);
  const [bootDone, setBootDone] = useState(!SHOW_BOOT_SCREEN);

  const [componentTree, setComponentTree] = useState<ComponentTreeNode[]>([]);
  const [usagePanelOpen, setUsagePanelOpen] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(250);
  const [isolationComponent, setIsolationComponent] = useState<ComponentEntry | null>(null);
  const [elementMode, setElementMode] = useState<"component" | "instance">("instance");
  const [isDataDriven, setIsDataDriven] = useState(false);
  const isDataDrivenRef = useRef(false);
  const [inLoop, setInLoop] = useState(false);
  const inLoopRef = useRef(false);
  const [hasDynamicContent, setHasDynamicContent] = useState(false);
  const [dataOrigin, setDataOrigin] = useState<"local" | "external" | undefined>(undefined);
  const [iteratorExpression, setIteratorExpression] = useState<string | undefined>(undefined);
  const scanReady = useScanReady();
  const componentData = useComponents();

  // Fetch config from server
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((config) => {
        setTargetUrl(config.targetUrl);
        setStylingType(config.stylingType || "");
        setTailwindTheme(config.tailwindTheme || null);
        if (config.projectRoot) {
          setProjectRoot(config.projectRoot);
          setProjectName(config.projectRoot.split("/").filter(Boolean).pop() ?? "");
        }
        if (config.toolPort) {
          setToolPort(config.toolPort);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch instructions
  useEffect(() => {
    fetch("/api/instructions")
      .then((res) => res.json())
      .then((data) => setInstructions(data.content ?? ""))
      .catch(console.error);
  }, []);

  // Fetch unified scan data and populate the store
  useEffect(() => {
    fetch("/scan/all")
      .then((res) => res.json())
      .then((data: RawScanData) => {
        scanStore.setAll(data);
      })
      .catch(console.error);
  }, []);

  const handleOpenSettings = useCallback((tab: "info" | "instructions" = "info") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  // Terminal session key — increment to force terminal reconnect
  const [terminalKey, setTerminalKey] = useState(0);

  const handleSaveInstructions = useCallback(async (content: string) => {
    try {
      await fetch("/api/instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setInstructions(content);
      // Reload the terminal so Claude CLI picks up the new instructions
      setTerminalKey((k) => k + 1);
    } catch (err) {
      console.error("Failed to save instructions:", err);
    }
  }, []);

  const handleRescan = useCallback(() => {
    fetch("/scan/rescan", { method: "POST" })
      .then((res) => res.json())
      .then((data: RawScanData) => { scanStore.setAll(data); })
      .catch(console.error);
  }, []);

  const sendOverlayState = useCallback((
    el: SelectedElementData | null,
    mode: "component" | "instance",
    dataDriven = false,
    loopState?: { inLoop: boolean; hasDynamicContent: boolean; dataOrigin?: "local" | "external"; iteratorExpression?: string },
  ) => {
    if (!iframeRef.current?.contentWindow || !el) return;
    const hasEditableSource = el.source && !el.source.file.includes("node_modules");
    const tier: "full" | "instance-only" | "inspect-only" =
      hasEditableSource ? "full" :
      el.instanceSource ? "instance-only" :
      "inspect-only";
    const showToggle = tier === "full" && !!el.instanceSource;
    iframeRef.current.contentWindow.postMessage({
      type: "tool:setOverlayState",
      tier,
      showToggle,
      activeMode: showToggle ? mode : null,
      isDataDriven: dataDriven,
      inLoop: loopState?.inLoop ?? false,
      hasDynamicContent: loopState?.hasDynamicContent ?? false,
      dataOrigin: loopState?.dataOrigin,
      iteratorExpression: loopState?.iteratorExpression,
      packageName: el.packageName ?? undefined,
    }, "*");
  }, []);

  const handleMessage = useCallback(
    (msg: import("../shared/protocol.js").IframeToEditor) => {
      switch (msg.type) {
        case "tool:injectedReady":
          setInjectedReady(true);
          // Auto-enter selection mode
          if (iframeRef.current) {
            iframeRef.current.contentWindow?.postMessage(
              { type: "tool:enterSelectionMode" },
              "*"
            );
            iframeRef.current.contentWindow?.postMessage(
              { type: "tool:requestComponentTree" },
              "*"
            );
            setSelectionMode(true);
            // Re-select the previously selected element after full-page
            // reload (e.g. Astro .astro file changes trigger a reload,
            // which re-mounts the Surface component and loses selection).
            const path = selectedDomPathRef.current;
            if (path) {
              iframeRef.current.contentWindow?.postMessage(
                { type: "tool:selectByTreeId", id: path },
                "*"
              );
            }
          }
          break;
        case "tool:elementSelected":
          setSelectedElement(msg.data);
          selectedDomPathRef.current = msg.data.domPath;
          // Reset mode to instance on new selection, send initial overlay state
          setElementMode("instance");
          setIsDataDriven(false);
          isDataDrivenRef.current = false;
          setInLoop(false);
          inLoopRef.current = false;
          setHasDynamicContent(false);
          setDataOrigin(undefined);
          setIteratorExpression(undefined);
          sendOverlayState(msg.data, "instance", false);
          // Fire classify-element async to detect data-driven / loop instances
          {
            const src = msg.data.source;
            if (src && !src.file.includes("node_modules")) {
              const params = new URLSearchParams({
                file: src.file,
                line: String(src.line),
                col: String(src.col),
              });
              fetch(`/api/classify-element?${params}`)
                .then(r => r.json())
                .then((c: { inLoop: boolean; hasDynamicContent: boolean; dataOrigin?: "local" | "external"; iteratorExpression?: string; instance: { isAuthored: boolean } }) => {
                  const dataDriven = c.inLoop || c.hasDynamicContent;
                  isDataDrivenRef.current = dataDriven;
                  inLoopRef.current = c.inLoop;
                  setIsDataDriven(dataDriven);
                  setInLoop(c.inLoop);
                  setHasDynamicContent(c.hasDynamicContent);
                  setDataOrigin(c.dataOrigin);
                  setIteratorExpression(c.iteratorExpression);
                  setSelectedElement(prev => {
                    if (prev) sendOverlayState(prev, "instance", dataDriven, {
                      inLoop: c.inLoop,
                      hasDynamicContent: c.hasDynamicContent,
                      dataOrigin: c.dataOrigin,
                      iteratorExpression: c.iteratorExpression,
                    });
                    return prev;
                  });
                })
                .catch(() => {}); // classify failing silently is fine
            }
          }
          break;
        case "tool:editModeToggled": {
          const newMode = (msg as any).mode as "component" | "instance";
          setElementMode(newMode);
          setSelectedElement(prev => {
            if (prev) sendOverlayState(prev, newMode, isDataDrivenRef.current, {
              inLoop: inLoopRef.current,
              hasDynamicContent: false,
            });
            return prev;
          });
          break;
        }
        case "tool:pathChanged":
          setIframePath(msg.path);
          // Request updated component tree after navigation
          if (iframeRef.current) {
            iframeRef.current.contentWindow?.postMessage(
              { type: "tool:requestComponentTree" },
              "*"
            );
          }
          break;
        case "tool:componentTree":
          setComponentTree(msg.tree);
          break;
        case "tool:cssCustomProperties": {
          const classified = classifyCssProperties(msg.properties);
          setIframeCssTheme(classified);
          break;
        }
      }
    },
    [sendOverlayState]
  );

  const { send } = usePostMessage(iframeRef, handleMessage);

  const toggleSelectionMode = useCallback(() => {
    const next = !selectionMode;
    setSelectionMode(next);
    if (next) {
      send({ type: "tool:enterSelectionMode" });
    } else {
      send({ type: "tool:exitSelectionMode" });
      send({ type: "tool:clearSelection" });
      setSelectedElement(null);
      selectedDomPathRef.current = null;
      setUsagePanelOpen(false);
    }
  }, [selectionMode, send]);

  const toggleTheme = useCallback(() => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("light", next === "light");
    send({ type: "tool:setTheme", theme: next });
  }, [theme, send]);

  const handlePreviewInlineStyle = useCallback((property: string, value: string) => {
    send({ type: "tool:previewInlineStyle", property, value });
  }, [send]);

  const handleRevertInlineStyles = useCallback(() => {
    send({ type: "tool:revertInlineStyles" });
  }, [send]);

  const handleReselectElement = useCallback(() => {
    send({ type: "tool:reselectElement" });
  }, [send]);

  const handlePreviewToken = useCallback((token: string, value: string) => {
    send({ type: "tool:previewTokenValue", property: token, value });
  }, [send]);

  const handleClearTokenPreview = useCallback(() => {
    send({ type: "tool:revertTokenValues" });
  }, [send]);

  const handlePreviewShadow = useCallback((variableName: string, value: string, _shadowName?: string) => {
    send({ type: "tool:previewTokenValue", property: variableName, value });
  }, [send]);

  const handleSelectParentInstance = useCallback(() => {
    send({ type: "tool:selectParentInstance" });
  }, [send]);

  const handleCloseEditor = useCallback(() => {
    setSelectedElement(null);
    selectedDomPathRef.current = null;
    setUsagePanelOpen(false);
    send({ type: "tool:clearSelection" });
  }, [send]);

  const handleNavigateToRoute = useCallback((route: string) => {
    setIframePath(route);
  }, []);

  const handleTreeSelect = useCallback((id: string) => {
    send({ type: "tool:selectByTreeId", id });
  }, [send]);

  const handleTreeHover = useCallback((id: string) => {
    send({ type: "tool:highlightByTreeId", id });
  }, [send]);

  const handleTreeHoverEnd = useCallback(() => {
    send({ type: "tool:clearHighlight" });
  }, [send]);

  // Isolation mode: render component in overlay portal (no route change)
  const handleIsolate = useCallback((entry: ComponentEntry) => {
    setIsolationComponent(entry);
    const combos = generateCombinations(entry.variants);
    const componentPath = entry.filePath.replace(/\.(tsx|ts|jsx|js)$/, "");
    send({
      type: "tool:renderPreview",
      dataSlot: entry.dataSlot,
      componentPath,
      exportName: entry.exportName,
      combinations: combos,
      defaultChildren: entry.name,
    });
  }, [send]);

  const handleExitIsolation = useCallback(() => {
    setIsolationComponent(null);
    send({ type: "tool:exitPreview" });
  }, [send]);

  const handleIsolationCombinationsChange = useCallback((combos: PreviewCombination[]) => {
    if (!isolationComponent) return;
    const componentPath = isolationComponent.filePath.replace(/\.(tsx|ts|jsx|js)$/, "");
    send({
      type: "tool:renderPreview",
      dataSlot: isolationComponent.dataSlot,
      componentPath,
      exportName: isolationComponent.exportName,
      combinations: combos,
      defaultChildren: isolationComponent.name,
    });
  }, [isolationComponent, send]);

  // Server-resolved theme (v3/v4) takes priority, then iframe-derived theme (CSS vars)
  const effectiveTheme = useMemo(
    () => tailwindTheme ?? iframeCssTheme ?? null,
    [tailwindTheme, iframeCssTheme],
  );

  // Global keyboard shortcuts — must be before early returns
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleRescan();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleRescan]);

  const handleLeftPanelDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftPanelWidth;
    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(500, startWidth + ev.clientX - startX));
      setLeftPanelWidth(newWidth);
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [leftPanelWidth]);

  if (!targetUrl) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: "var(--studio-bg)", color: "var(--studio-text-dimmed)" }}
      >
        Loading...
      </div>
    );
  }

  if (!bootDone) {
    return (
      <BootScreen onContinue={() => setBootDone(true)} />
    );
  }

  // Derive component name from selected element for the usage panel
  const dataSlot = selectedElement?.attributes?.["data-slot"] || null;
  const selectedComponentEntry = dataSlot
    ? componentData?.byDataSlot.get(dataSlot) ?? null
    : null;
  const selectedComponentName = selectedComponentEntry?.name || null;

  // Derive selected element's domPath-based ID for tree highlighting.
  // The tree uses getDomPath() as node IDs — we need to match against
  // the selected element. Since domPath is sent in extractElementData,
  // we read it from the raw postMessage data (stored as attributes won't have it).
  // For now, we match by finding a tree node whose id we stored.
  const selectedTreeId = selectedElement
    ? findTreeIdForElement(componentTree, selectedElement)
    : null;

  const showUsages = usagePanelOpen && selectedComponentName;

  const leftPanelDragHandle = (
    <div
      onMouseDown={handleLeftPanelDragStart}
      className="absolute top-0 right-0 w-1 h-full cursor-ew-resize z-10 hover:bg-[var(--studio-accent)]"
      style={{ transition: "background 0.15s" }}
    />
  );

  const leftPanel = isolationComponent ? (
    <div
      className="relative flex flex-col border-r h-full shrink-0"
      style={{
        width: leftPanelWidth,
        minWidth: 180,
        background: "var(--studio-surface)",
        borderColor: "var(--studio-border)",
      }}
    >
      <IsolationView
        component={isolationComponent}
        onBack={handleExitIsolation}
        onCombinationsChange={handleIsolationCombinationsChange}
      />
      {leftPanelDragHandle}
    </div>
  ) : leftPanelCollapsed ? (
    <div
      className="flex flex-col border-r h-full shrink-0"
      style={{
        width: 36,
        background: "var(--studio-surface)",
        borderColor: "var(--studio-border)",
      }}
    >
      <button
        onClick={() => setLeftPanelCollapsed(false)}
        className="studio-icon-btn"
        style={{ width: 36, height: 36 }}
        title="Expand panel"
      >
        <PanelLeft strokeWidth={1.5} size={16} />
      </button>
    </div>
  ) : (
    <div
      className="relative flex flex-col border-r h-full shrink-0"
      style={{
        width: leftPanelWidth,
        minWidth: 180,
        background: "var(--studio-surface)",
        borderColor: "var(--studio-border)",
      }}
    >
      {/* Collapse button + Elements explorer */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div
          className="pl-2.5 pr-2.5 pt-3 pb-3 shrink-0"
          style={{ borderBottom: "1px solid var(--studio-border-subtle)" }}
        >
          <div className="flex items-center justify-between">
            {/* Project name dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    padding: "2px 6px 2px 2px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    color: "var(--studio-text)",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 5,
                    minWidth: 0,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--studio-surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  title="Project menu"
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {projectName || "Surface"}
                  </span>
                  <ChevronDown size={12} style={{ opacity: 0.4, flexShrink: 0 }} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="studio-popup-dark"
                  sideOffset={6}
                  align="start"
                  style={{ zIndex: 9999 }}
                >
                  <DropdownMenu.Item
                    className="studio-dropdown-item"
                    onSelect={() => handleOpenSettings("info")}
                  >
                    <Settings size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
                    <span>Settings</span>
                    <span className="shortcut">⌘,</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="studio-dropdown-item"
                    onSelect={handleRescan}
                  >
                    <RefreshCw size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
                    <span>Rescan</span>
                    <span className="shortcut">⇧⌘S</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            <button
              onClick={() => setLeftPanelCollapsed(true)}
              className="studio-icon-btn shrink-0"
              style={{ width: 24, height: 24 }}
              title="Collapse panel"
            >
              <PanelLeft strokeWidth={1.5} size={14} />
            </button>
          </div>
        </div>
        {/* Usage panel (above explorer, when open) */}
        {showUsages && (
          <div
            className="flex flex-col shrink-0 border-b"
            style={{ borderColor: "var(--studio-border)", maxHeight: "40%" }}
          >
            <UsagePanel
              componentName={selectedComponentName}
              currentPath={iframePath}
              onNavigate={handleNavigateToRoute}
              onClose={() => setUsagePanelOpen(false)}
            />
          </div>
        )}
        <PageExplorer
          tree={componentTree}
          selectedId={selectedTreeId}
          onSelect={handleTreeSelect}
          onHover={handleTreeHover}
          onHoverEnd={handleTreeHoverEnd}
        />
      </div>
      {leftPanelDragHandle}
    </div>
  );

  const editorPanel = (
    <EditorPanel
      element={selectedElement}
      theme={theme}
      iframePath={iframePath}
      stylingType={stylingType}
      tailwindTheme={effectiveTheme}
      onPreviewToken={handlePreviewToken}
      onClearTokenPreview={handleClearTokenPreview}
      onPreviewShadow={handlePreviewShadow}
      onPreviewInlineStyle={handlePreviewInlineStyle}
      onRevertInlineStyles={handleRevertInlineStyles}
      onClose={handleCloseEditor}
      onReselectElement={handleReselectElement}
      onToggleUsagePanel={() => {
                setUsagePanelOpen((v) => !v);
                setLeftPanelCollapsed(false);
              }}
      onIsolate={handleIsolate}
      onSelectParentInstance={handleSelectParentInstance}
      writeMode={writeMode}
      aiModel={aiModel}
      toolPort={toolPort}
      onWriteModeChange={setWriteMode}
      onAiModelChange={setAiModel}
      terminalKey={terminalKey}
      elementMode={elementMode}
      inLoop={inLoop}
      hasDynamicContent={hasDynamicContent}
      dataOrigin={dataOrigin}
      iteratorExpression={iteratorExpression}
      onElementModeChange={(mode) => {
        setElementMode(mode);
        sendOverlayState(selectedElement, mode, isDataDrivenRef.current, {
          inLoop: inLoopRef.current,
          hasDynamicContent,
        });
      }}
    />
  );

  return (
    <TooltipProvider>
      <ToolChrome
        selectionMode={selectionMode}
        onToggleSelectionMode={toggleSelectionMode}
        theme={theme}
        onToggleTheme={toggleTheme}
        viewportWidth={viewportWidth}
        onViewportWidthChange={setViewportWidth}
        zoom={zoom}
        onZoomChange={setZoom}
        iframePath={iframePath}
        onIframePathChange={setIframePath}
        targetUrl={targetUrl}
        iframeRef={iframeRef}
        editorPanel={editorPanel}
        leftPanel={leftPanel}
      />
      {settingsOpen && instructions !== null && (
        <SettingsPage
          initialTab={settingsTab}
          instructions={instructions}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSaveInstructions}
        />
      )}
    </TooltipProvider>
  );
}
