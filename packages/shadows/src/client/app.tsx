import { useState, useEffect, useRef, useCallback } from "react";
import { ShadowIcon } from "@radix-ui/react-icons";
import { ToolChrome } from "@designtools/core/client/components/tool-chrome";
import {
  sendToIframe,
  onIframeMessage,
  type ElementData,
} from "@designtools/core/client/lib/iframe-bridge";
import { ShadowEditorPanel } from "./components/shadow-editor-panel.js";

export interface ShadowsScanData {
  framework: { name: string; cssFiles: string[] };
  styling: { type: string; cssFiles: string[] };
  shadows: {
    shadows: any[];
    cssFilePath: string;
    stylingType: string;
  };
}

export function App() {
  const [scanData, setScanData] = useState<ShadowsScanData | null>(null);
  const [selectedElement, setSelectedElement] = useState<ElementData | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
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

  const previewShadow = useCallback(
    (variableName: string, value: string) => {
      if (iframeRef.current) {
        sendToIframe(iframeRef.current, {
          type: "tool:setProperty",
          token: variableName,
          value,
        });
      }
    },
    []
  );

  return (
    <ToolChrome
      toolName="Shadows"
      toolIcon={<ShadowIcon style={{ width: 15, height: 15 }} />}
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
        <ShadowEditorPanel
          scanData={scanData}
          selectedElement={selectedElement}
          onPreviewShadow={previewShadow}
        />
      }
    />
  );
}
