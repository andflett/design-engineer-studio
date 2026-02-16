import { type RefObject } from "react";
import {
  CursorArrowIcon,
  SunIcon,
  MoonIcon,
  WidthIcon,
  PaddingIcon,
} from "@radix-ui/react-icons";
import { Viewport } from "./viewport.js";
import { EditorPanel } from "./editor-panel.js";
import type { ScanData } from "../app.js";
import type { ElementData } from "../lib/iframe-bridge.js";

interface StudioChromeProps {
  scanData: ScanData | null;
  selectedElement: ElementData | null;
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  viewportWidth: number | "fill";
  onViewportWidthChange: (w: number | "fill") => void;
  iframePath: string;
  onIframePathChange: (path: string) => void;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  onPreviewToken: (token: string, value: string) => void;
  onPreviewClass: (elementPath: string, oldClass: string, newClass: string) => void;
  onRevertPreview: () => void;
  onRefreshIframe: () => void;
  onReselectElement: () => void;
  onClearSelection: () => void;
}

export function StudioChrome({
  scanData,
  selectedElement,
  selectionMode,
  onToggleSelectionMode,
  theme,
  onToggleTheme,
  viewportWidth,
  onViewportWidthChange,
  iframePath,
  onIframePathChange,
  iframeRef,
  onPreviewToken,
  onPreviewClass,
  onRevertPreview,
  onRefreshIframe,
  onReselectElement,
  onClearSelection,
}: StudioChromeProps) {
  const breakpoints = [375, 768, 1024, 1280];

  return (
    <div className="flex flex-col h-screen">
      {/* Single toolbar */}
      <div
        className="flex items-center h-11 px-4 gap-3 border-b shrink-0"
        style={{
          background: "var(--studio-surface)",
          borderColor: "var(--studio-border)",
        }}
      >
        {/* Left: logo */}
        <div className="flex items-center gap-2 shrink-0">
          <PaddingIcon
            style={{
              width: 15,
              height: 15,
              color: "var(--studio-text-muted)",
            }}
          />
          <span
            className="text-[11px] font-semibold tracking-wide"
            style={{ color: "var(--studio-text-muted)" }}
          >
            Design Engineer Studio
          </span>
        </div>

        {/* Separator */}
        <div
          className="w-px h-4"
          style={{ background: "var(--studio-border)" }}
        />

        {/* Center: breakpoints + width */}
        <div className="flex items-center gap-1 flex-1 justify-center">
          {breakpoints.map((w) => (
            <button
              key={w}
              onClick={() => onViewportWidthChange(w)}
              className={`studio-bp-btn ${viewportWidth === w ? "active" : ""}`}
            >
              {w}
            </button>
          ))}
          <button
            onClick={() => onViewportWidthChange("fill")}
            className={`studio-icon-btn ${viewportWidth === "fill" ? "active" : ""}`}
            title="Fill width"
            style={{ width: 28, height: 28 }}
          >
            <WidthIcon />
          </button>

          <input
            type="text"
            value={viewportWidth === "fill" ? "100%" : `${viewportWidth}`}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 320) onViewportWidthChange(val);
            }}
            className="studio-input w-14 text-center"
            style={{ fontSize: "11px" }}
          />
        </div>

        {/* Separator */}
        <div
          className="w-px h-4"
          style={{ background: "var(--studio-border)" }}
        />

        {/* Right: tools */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggleSelectionMode}
            className={`studio-icon-btn ${selectionMode ? "active" : ""}`}
            title={selectionMode ? "Selection mode on" : "Selection mode off"}
          >
            <CursorArrowIcon />
          </button>
          <button
            onClick={onToggleTheme}
            className="studio-icon-btn"
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        <Viewport
          viewportWidth={viewportWidth}
          onViewportWidthChange={onViewportWidthChange}
          iframePath={iframePath}
          onIframePathChange={onIframePathChange}
          iframeRef={iframeRef}
          routes={scanData?.routes.routes || []}
        />

        {selectedElement && (
          <EditorPanel
            element={selectedElement}
            scanData={scanData}
            theme={theme}
            onPreviewToken={onPreviewToken}
            onPreviewClass={onPreviewClass}
            onRevertPreview={onRevertPreview}
            onRefreshIframe={onRefreshIframe}
            onReselectElement={onReselectElement}
            onClose={onClearSelection}
          />
        )}
      </div>
    </div>
  );
}
