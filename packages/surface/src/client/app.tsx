import { useState, useRef, useEffect, useCallback } from "react";
import { Component1Icon } from "@radix-ui/react-icons";
import { PanelLeft } from "lucide-react";
import type { SelectedElementData, ComponentTreeNode, PreviewCombination } from "../shared/protocol.js";
import type { ComponentEntry } from "../server/lib/scan-components.js";
import type { ResolvedTailwindTheme } from "../shared/tailwind-theme.js";
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
import { ProjectInfo } from "./components/project-info.js";

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
  const treeModeRef = useRef<"components" | "dom">("components");
  const [targetUrl, setTargetUrl] = useState("");
  const [stylingType, setStylingType] = useState("");
  const [projectName, setProjectName] = useState("");
  const [tailwindTheme, setTailwindTheme] = useState<ResolvedTailwindTheme | null>(null);
  const [selectedElement, setSelectedElement] = useState<SelectedElementData | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [viewportWidth, setViewportWidth] = useState<number | "fill">("fill");
  const [zoom, setZoom] = useState(0.6);
  const [iframePath, setIframePath] = useState("/");
  const [injectedReady, setInjectedReady] = useState(false);
  const [bootDone, setBootDone] = useState(!SHOW_BOOT_SCREEN);

  const [componentTree, setComponentTree] = useState<ComponentTreeNode[]>([]);
  const [treeMode, setTreeMode] = useState<"components" | "dom">(() => {
    const stored = localStorage.getItem("surface:treeMode");
    return stored === "dom" ? "dom" : "components";
  });
  treeModeRef.current = treeMode;
  const [usagePanelOpen, setUsagePanelOpen] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(250);
  const [isolationComponent, setIsolationComponent] = useState<ComponentEntry | null>(null);
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
          setProjectName(config.projectRoot.split("/").filter(Boolean).pop() ?? "");
        }
      })
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
              { type: "tool:requestComponentTree", mode: treeModeRef.current },
              "*"
            );
            setSelectionMode(true);
          }
          break;
        case "tool:elementSelected":
          setSelectedElement(msg.data);
          break;
        case "tool:pathChanged":
          setIframePath(msg.path);
          // Request updated component tree after navigation
          if (iframeRef.current) {
            iframeRef.current.contentWindow?.postMessage(
              { type: "tool:requestComponentTree", mode: treeModeRef.current },
              "*"
            );
          }
          break;
        case "tool:componentTree":
          setComponentTree(msg.tree);
          break;
      }
    },
    []
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
      setUsagePanelOpen(false);
    }
  }, [selectionMode, send]);

  const toggleTheme = useCallback(() => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
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
    setUsagePanelOpen(false);
    send({ type: "tool:clearSelection" });
  }, [send]);

  const handleNavigateToRoute = useCallback((route: string) => {
    setIframePath(route);
  }, []);

  const handleTreeModeChange = useCallback((mode: "components" | "dom") => {
    setTreeMode(mode);
    treeModeRef.current = mode;
    localStorage.setItem("surface:treeMode", mode);
    send({ type: "tool:requestComponentTree", mode });
  }, [send]);

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
          className="pl-2 pr-2.5 pt-1.5 pb-2 shrink-0"
          style={{ borderBottom: "1px solid var(--studio-border-subtle)" }}
        >
              <div className="flex items-start justify-between">
                <div>
            <span
              className="flex-1 text-[10px] font-semibold uppercase tracking-wide pl-1"
              style={{ color: "var(--studio-text-muted)" }}
            >
              {projectName || "Explorer"}
                  </span>
                            <ProjectInfo targetPort={targetUrl ? parseInt(new URL(targetUrl).port, 10) || 3000 : 3000} />
                </div>
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
          treeMode={treeMode}
          onTreeModeChange={handleTreeModeChange}
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
      tailwindTheme={tailwindTheme}
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
    />
  );

  return (
    <TooltipProvider>
      <ToolChrome
        toolName="Surface"
        toolIcon={<Component1Icon />}
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
    </TooltipProvider>
  );
}
