import { useState, useEffect, useRef, useCallback } from "react";
import { StudioChrome } from "./components/studio-chrome.js";
import {
  sendToIframe,
  onIframeMessage,
  type ElementData,
} from "./lib/iframe-bridge.js";

export interface ScanData {
  framework: { name: string; appDir: string; componentDir: string; cssFiles: string[] };
  tokens: { tokens: any[]; cssFilePath: string; groups: Record<string, any[]> };
  components: { components: any[] };
  routes: { routes: { urlPath: string; filePath: string }[] };
}

export function App() {
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [selectedElement, setSelectedElement] = useState<ElementData | null>(null);
  const [selectionMode, setSelectionMode] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [viewportWidth, setViewportWidth] = useState<number | "fill">("fill");
  const [iframePath, setIframePath] = useState("/");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch scan data on mount
  useEffect(() => {
    fetch("/scan/all")
      .then((r) => r.json())
      .then(setScanData)
      .catch(console.error);
  }, []);

  // Listen for iframe messages
  useEffect(() => {
    return onIframeMessage((msg) => {
      if (msg.type === "studio:elementSelected") {
        setSelectedElement(msg.data);
      }
      if (msg.type === "studio:injectedReady" && iframeRef.current) {
        if (selectionMode) {
          sendToIframe(iframeRef.current, {
            type: "studio:enterSelectionMode",
          });
        }
      }
    });
  }, [selectionMode]);

  // Toggle selection mode in iframe
  useEffect(() => {
    if (!iframeRef.current) return;
    sendToIframe(iframeRef.current, {
      type: selectionMode
        ? "studio:enterSelectionMode"
        : "studio:exitSelectionMode",
    });
  }, [selectionMode]);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    if (iframeRef.current) {
      sendToIframe(iframeRef.current, {
        type: "studio:setTheme",
        theme: newTheme,
      });
    }
  }, [theme]);

  const previewToken = useCallback(
    (token: string, value: string) => {
      if (iframeRef.current) {
        sendToIframe(iframeRef.current, {
          type: "studio:setProperty",
          token,
          value,
        });
      }
    },
    []
  );

  const previewClass = useCallback(
    (elementPath: string, oldClass: string, newClass: string) => {
      if (iframeRef.current) {
        sendToIframe(iframeRef.current, {
          type: "studio:previewClass",
          elementPath,
          oldClass,
          newClass,
        });
      }
    },
    []
  );

  const revertPreview = useCallback(() => {
    if (iframeRef.current) {
      sendToIframe(iframeRef.current, { type: "studio:revertPreview" });
    }
  }, []);

  const reselectElement = useCallback(() => {
    if (iframeRef.current) {
      sendToIframe(iframeRef.current, { type: "studio:reselectElement" });
    }
  }, []);

  const refreshIframe = useCallback(() => {
    if (iframeRef.current) {
      // Force reload the iframe to pick up file changes
      const src = iframeRef.current.src;
      iframeRef.current.src = "";
      setTimeout(() => {
        if (iframeRef.current) iframeRef.current.src = src;
      }, 50);
    }
  }, []);

  return (
    <StudioChrome
      scanData={scanData}
      selectedElement={selectedElement}
      selectionMode={selectionMode}
      onToggleSelectionMode={() => setSelectionMode((s) => !s)}
      theme={theme}
      onToggleTheme={toggleTheme}
      viewportWidth={viewportWidth}
      onViewportWidthChange={setViewportWidth}
      iframePath={iframePath}
      onIframePathChange={setIframePath}
      iframeRef={iframeRef}
      onPreviewToken={previewToken}
      onPreviewClass={previewClass}
      onRevertPreview={revertPreview}
      onRefreshIframe={refreshIframe}
      onReselectElement={reselectElement}
      onClearSelection={() => setSelectedElement(null)}
    />
  );
}
