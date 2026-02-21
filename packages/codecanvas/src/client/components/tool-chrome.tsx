import { type RefObject, type ReactNode, useState, useEffect } from "react";
import {
  CursorArrowIcon,
  SunIcon,
  MoonIcon,
  WidthIcon,
} from "@radix-ui/react-icons";
import { Viewport } from "./viewport.js";
import { Tooltip } from "./tooltip.js";

export interface ToolChromeProps {
  /** Tool name shown in toolbar */
  toolName: string;
  /** Tool icon in toolbar */
  toolIcon: ReactNode;
  /** The tool's editor panel (right side) */
  editorPanel?: ReactNode;
  /** Whether to show the selection mode button (default true) */
  showSelectionMode?: boolean;
  /** Selection mode state */
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  /** Theme state */
  theme: "light" | "dark";
  onToggleTheme: () => void;
  /** Viewport width state */
  viewportWidth: number | "fill";
  onViewportWidthChange: (w: number | "fill") => void;
  /** Iframe path state */
  iframePath: string;
  onIframePathChange: (path: string) => void;
  /** Target app URL */
  targetUrl: string;
  /** Iframe ref for postMessage */
  iframeRef: RefObject<HTMLIFrameElement | null>;
}

export function ToolChrome({
  toolName,
  toolIcon,
  editorPanel,
  showSelectionMode = true,
  selectionMode,
  onToggleSelectionMode,
  theme,
  onToggleTheme,
  viewportWidth,
  onViewportWidthChange,
  iframePath,
  onIframePathChange,
  targetUrl,
  iframeRef,
}: ToolChromeProps) {
  const breakpoints = [375, 768, 1024, 1280];
  const [urlInput, setUrlInput] = useState(iframePath);

  // Sync URL bar when iframePath changes (e.g. from iframe navigation)
  useEffect(() => {
    setUrlInput(iframePath);
  }, [iframePath]);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onIframePathChange(urlInput);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <div
        className="flex items-center h-11 px-4 gap-3 border-b shrink-0"
        style={{
          background: "var(--studio-surface)",
          borderColor: "var(--studio-border)",
        }}
      >
        {/* Left: logo */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            style={{
              color: "var(--studio-text-muted)",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            {toolIcon}
          </span>
          <span
            className="text-[11px] font-semibold tracking-wide"
            style={{ color: "var(--studio-text-muted)" }}
          >
            {toolName}
          </span>
        </div>

        {/* Separator */}
        <div
          className="w-px h-4"
          style={{ background: "var(--studio-border)" }}
        />

        {/* URL bar */}
        <form onSubmit={handleUrlSubmit} className="flex-0">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="studio-input"
            style={{ padding: "3px 8px", width: 180 }}
            placeholder="/"
          />
        </form>

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
          <Tooltip content="Fill width" side="bottom">
            <button
              onClick={() => onViewportWidthChange("fill")}
              className={`studio-icon-btn ${viewportWidth === "fill" ? "active" : ""}`}
              style={{ width: 28, height: 28 }}
            >
              <WidthIcon />
            </button>
          </Tooltip>

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
          {showSelectionMode && (
            <Tooltip content={selectionMode ? "Selection mode on" : "Selection mode off"} side="bottom">
              <button
                onClick={onToggleSelectionMode}
                className={`studio-icon-btn ${selectionMode ? "active" : ""}`}
              >
                <CursorArrowIcon />
              </button>
            </Tooltip>
          )}
          <Tooltip content={`Switch to ${theme === "light" ? "dark" : "light"} mode`} side="bottom">
            <button
              onClick={onToggleTheme}
              className="studio-icon-btn"
            >
              {theme === "light" ? <SunIcon /> : <MoonIcon />}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        <Viewport
          viewportWidth={viewportWidth}
          onViewportWidthChange={onViewportWidthChange}
          iframePath={iframePath}
          targetUrl={targetUrl}
          iframeRef={iframeRef}
        />

        {editorPanel}
      </div>
    </div>
  );
}
