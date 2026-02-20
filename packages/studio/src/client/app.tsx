import { useState, useEffect, useRef, useCallback } from "react";
import { PaddingIcon } from "@radix-ui/react-icons";
import { ToolChrome } from "@designtools/core/client/components/tool-chrome";
import {
  sendToIframe,
  onIframeMessage,
  type ElementData,
} from "@designtools/core/client/lib/iframe-bridge";
import { EditorPanel } from "./components/editor-panel.js";

export interface ScanData {
  framework: { name: string; appDir: string; componentDir: string; cssFiles: string[] };
  tokens: { tokens: any[]; cssFilePath: string; groups: Record<string, any[]> };
  components: { components: any[] };
}

export function App() {
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [selectedElement, setSelectedElement] = useState<ElementData | null>(null);
  const [selectionMode, setSelectionMode] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [viewportWidth, setViewportWidth] = useState<number | "fill">("fill");
  const [iframePath, setIframePath] = useState("/");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetch("/scan/all")
      .then((r) => r.json())
      .then(setScanData)
      .catch(console.error);
  }, []);

  useEffect(() => {
    return onIframeMessage((msg) => {
      if (msg.type === "tool:elementSelected") {
        setSelectedElement(msg.data);
      }
      if (msg.type === "tool:pathChanged") {
        setIframePath(msg.path);
      }
      if (msg.type === "tool:injectedReady" && iframeRef.current) {
        if (selectionMode) {
          sendToIframe(iframeRef.current, {
            type: "tool:enterSelectionMode",
          });
        }
      }
    });
  }, [selectionMode]);

  useEffect(() => {
    if (!iframeRef.current) return;
    sendToIframe(iframeRef.current, {
      type: selectionMode
        ? "tool:enterSelectionMode"
        : "tool:exitSelectionMode",
    });
  }, [selectionMode]);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    if (iframeRef.current) {
      sendToIframe(iframeRef.current, {
        type: "tool:setTheme",
        theme: newTheme,
      });
    }
  }, [theme]);

  const previewToken = useCallback(
    (token: string, value: string) => {
      if (iframeRef.current) {
        sendToIframe(iframeRef.current, {
          type: "tool:setProperty",
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
          type: "tool:previewClass",
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
      sendToIframe(iframeRef.current, { type: "tool:revertPreview" });
    }
  }, []);

  const reselectElement = useCallback(() => {
    if (iframeRef.current) {
      sendToIframe(iframeRef.current, { type: "tool:reselectElement" });
    }
  }, []);

  const previewInlineStyle = useCallback(
    (property: string, value: string) => {
      if (iframeRef.current) {
        sendToIframe(iframeRef.current, {
          type: "tool:previewInlineStyle",
          property,
          value,
        });
      }
    },
    []
  );

  const revertInlineStyles = useCallback(() => {
    if (iframeRef.current) {
      sendToIframe(iframeRef.current, { type: "tool:revertInlineStyles" });
    }
  }, []);

  const refreshIframe = useCallback(() => {
    if (iframeRef.current) {
      const src = iframeRef.current.src;
      iframeRef.current.src = "";
      setTimeout(() => {
        if (iframeRef.current) iframeRef.current.src = src;
      }, 50);
    }
  }, []);

  return (
    <ToolChrome
      toolName="Design Engineer Studio"
      toolIcon={<PaddingIcon style={{ width: 15, height: 15 }} />}
      selectionMode={selectionMode}
      onToggleSelectionMode={() => setSelectionMode((s) => !s)}
      theme={theme}
      onToggleTheme={toggleTheme}
      viewportWidth={viewportWidth}
      onViewportWidthChange={setViewportWidth}
      iframePath={iframePath}
      onIframePathChange={setIframePath}
      iframeRef={iframeRef}
      editorPanel={
        selectedElement ? (
          <EditorPanel
            element={selectedElement}
            scanData={scanData}
            theme={theme}
            iframePath={iframePath}
            onPreviewToken={previewToken}
            onPreviewClass={previewClass}
            onPreviewInlineStyle={previewInlineStyle}
            onRevertPreview={revertPreview}
            onRevertInlineStyles={revertInlineStyles}
            onRefreshIframe={refreshIframe}
            onReselectElement={reselectElement}
            onClose={() => setSelectedElement(null)}
          />
        ) : undefined
      }
    />
  );
}
