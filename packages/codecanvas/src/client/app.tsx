import { useState, useRef, useEffect, useCallback } from "react";
import { Component1Icon } from "@radix-ui/react-icons";
import type { SelectedElementData } from "../shared/protocol.js";
import { usePostMessage } from "./lib/use-postmessage.js";
import { ToolChrome } from "./components/tool-chrome.js";
import { EditorPanel } from "./components/editor-panel.js";
import { TooltipProvider } from "./components/tooltip.js";

export interface ScanData {
  framework: any;
  tokens: {
    tokens: any[];
    groups: Record<string, any[]>;
    cssFilePath: string;
  };
  components: {
    components: any[];
  };
  shadows: {
    shadows: any[];
    cssFilePath: string;
    stylingType: string;
    designTokenFiles: string[];
  };
  styling: {
    type: string;
    cssFiles: string[];
    scssFiles: string[];
    hasDarkMode: boolean;
  };
}

export function App() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [stylingType, setStylingType] = useState("");
  const [selectedElement, setSelectedElement] = useState<SelectedElementData | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [viewportWidth, setViewportWidth] = useState<number | "fill">("fill");
  const [iframePath, setIframePath] = useState("/");
  const [injectedReady, setInjectedReady] = useState(false);
  const [scanData, setScanData] = useState<ScanData | null>(null);

  // Fetch config from server
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((config) => {
        setTargetUrl(config.targetUrl);
        setStylingType(config.stylingType || "");
      })
      .catch(console.error);
  }, []);

  // Fetch unified scan data
  useEffect(() => {
    fetch("/scan/all")
      .then((res) => res.json())
      .then((data) => {
        setScanData(data);
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
            setSelectionMode(true);
          }
          break;
        case "tool:elementSelected":
          setSelectedElement(msg.data);
          break;
        case "tool:pathChanged":
          setIframePath(msg.path);
          break;
      }
    },
    []
  );

  const { send } = usePostMessage(iframeRef, handleMessage);

  const toggleSelectionMode = useCallback(() => {
    const next = !selectionMode;
    setSelectionMode(next);
    send(next ? { type: "tool:enterSelectionMode" } : { type: "tool:exitSelectionMode" });
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

  const handlePreviewToken = useCallback((_token: string, _value: string) => {
    // Token preview could be implemented via postMessage if needed
    // For now, the token editor saves directly to CSS
  }, []);

  const handlePreviewShadow = useCallback((_variableName: string, _value: string, _shadowName?: string) => {
    // Shadow preview could be implemented via postMessage to set CSS custom
    // properties on the target app. For now, shadows save directly to CSS.
  }, []);

  const handleCloseEditor = useCallback(() => {
    setSelectedElement(null);
  }, []);

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

  const editorPanel = (
    <EditorPanel
      element={selectedElement}
      scanData={scanData}
      theme={theme}
      iframePath={iframePath}
      onPreviewToken={handlePreviewToken}
      onPreviewShadow={handlePreviewShadow}
      onPreviewInlineStyle={handlePreviewInlineStyle}
      onRevertInlineStyles={handleRevertInlineStyles}
      onClose={handleCloseEditor}
      onReselectElement={handleReselectElement}
      onRescan={() => {
        fetch("/scan/rescan", { method: "POST" })
          .then((r) => r.json())
          .then((data) => setScanData(data))
          .catch(console.error);
      }}
    />
  );

  return (
    <TooltipProvider>
      <ToolChrome
        toolName="CodeCanvas"
        toolIcon={<Component1Icon />}
        selectionMode={selectionMode}
        onToggleSelectionMode={toggleSelectionMode}
        theme={theme}
        onToggleTheme={toggleTheme}
        viewportWidth={viewportWidth}
        onViewportWidthChange={setViewportWidth}
        iframePath={iframePath}
        onIframePathChange={setIframePath}
        targetUrl={targetUrl}
        iframeRef={iframeRef}
        editorPanel={editorPanel}
      />
    </TooltipProvider>
  );
}
