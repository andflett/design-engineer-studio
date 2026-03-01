import { type RefObject, type ReactNode, useState, useEffect, useCallback } from "react";
import {
  CursorArrowIcon,
  SunIcon,
  MoonIcon,
  GlobeIcon,
  CheckIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import * as Popover from "@radix-ui/react-popover";
import { Monitor, ChevronDown, ZoomIn, ZoomOut } from "lucide-react";
import { Viewport } from "./viewport.js";
import { Tooltip } from "./tooltip.js";
import { rescanAll } from "../lib/scan-actions.js";

export interface ToolChromeProps {
  /** Tool name shown in toolbar */
  toolName: string;
  /** Tool icon in toolbar */
  toolIcon: ReactNode;
  /** The tool's editor panel (right side) */
  editorPanel?: ReactNode;
  /** Optional left panel (e.g. component usage explorer) */
  leftPanel?: ReactNode;
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
  /** Zoom state (0.2–1) */
  zoom: number;
  onZoomChange: (z: number) => void;
  /** Iframe path state */
  iframePath: string;
  onIframePathChange: (path: string) => void;
  /** Target app URL */
  targetUrl: string;
  /** Iframe ref for postMessage */
  iframeRef: RefObject<HTMLIFrameElement | null>;
}

const BREAKPOINTS: Array<{ label: string; value: number | "fill" }> = [
  { label: "375px", value: 375 },
  { label: "768px", value: 768 },
  { label: "1024px", value: 1024 },
  { label: "1280px", value: 1280 },
  { label: "Fill", value: "fill" },
];

export function ToolChrome({
  toolName,
  toolIcon,
  editorPanel,
  leftPanel,
  showSelectionMode = true,
  selectionMode,
  onToggleSelectionMode,
  theme,
  onToggleTheme,
  viewportWidth,
  onViewportWidthChange,
  zoom,
  onZoomChange,
  iframePath,
  onIframePathChange,
  targetUrl,
  iframeRef,
}: ToolChromeProps) {
  const [urlInput, setUrlInput] = useState(iframePath);
  const [rescanning, setRescanning] = useState(false);

  // Sync URL bar when iframePath changes (e.g. from iframe navigation)
  useEffect(() => {
    setUrlInput(iframePath);
  }, [iframePath]);

  const handleRescan = useCallback(async () => {
    setRescanning(true);
    try {
      await rescanAll();
      // Minimum display time so the modal doesn't just flash
      await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
      console.error("Rescan failed:", err);
    } finally {
      setRescanning(false);
    }
  }, []);

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

        {/* Center: combined URL + breakpoint bar */}
        <div className="flex-1 flex justify-center">
          <form onSubmit={handleUrlSubmit} className="studio-address-bar">
            <span className="studio-address-icon">
              <GlobeIcon />
            </span>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="studio-address-input"
              placeholder="/"
            />
            <div className="studio-address-sep" />
            <BreakpointSelect
              value={viewportWidth}
              options={BREAKPOINTS}
              onChange={onViewportWidthChange}
            />
            <div className="studio-address-sep" />
            <ZoomControl zoom={zoom} onChange={onZoomChange} />
          </form>
        </div>

        {/* Right: tools */}
        <div className="studio-toolbar-group shrink-0">
          {showSelectionMode && (
            <Tooltip content={selectionMode ? "Selection mode on" : "Selection mode off"} side="bottom">
              <button
                onClick={onToggleSelectionMode}
                className={`studio-toolbar-btn ${selectionMode ? "active" : ""}`}
              >
                <CursorArrowIcon />
              </button>
            </Tooltip>
          )}

          <Tooltip content="Re-scan tokens, components, and styles from source files" side="bottom">
            <button
              onClick={handleRescan}
              className="studio-toolbar-btn"
              disabled={rescanning}
            >
              <ReloadIcon />
            </button>
          </Tooltip>

          <Tooltip content={`Switch to ${theme === "light" ? "dark" : "light"} mode`} side="bottom">
            <button
              onClick={onToggleTheme}
              className="studio-toolbar-btn"
            >
              {theme === "light" ? <SunIcon /> : <MoonIcon />}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {leftPanel}
        <Viewport
          viewportWidth={viewportWidth}
          onViewportWidthChange={onViewportWidthChange}
          zoom={zoom}
          iframePath={iframePath}
          targetUrl={targetUrl}
          iframeRef={iframeRef}
        />

        {editorPanel}
      </div>

      {/* Rescan overlay */}
      {rescanning && <RescanOverlay />}
    </div>
  );
}

function ZoomControl({
  zoom,
  onChange,
}: {
  zoom: number;
  onChange: (z: number) => void;
}) {
  const pct = Math.round(zoom * 100);
  const canZoomOut = zoom > 0.2 + 0.001;
  const canZoomIn = zoom < 1.0 - 0.001;

  return (
    <div className="studio-zoom-control">
      <button
        type="button"
        className="studio-zoom-btn"
        disabled={!canZoomOut}
        onClick={() => onChange(Math.max(0.2, Math.round((zoom - 0.2) * 100) / 100))}
      >
        <ZoomOut size={12} strokeWidth={1.5} />
      </button>
      <span className="studio-zoom-label">{pct}%</span>
      <button
        type="button"
        className="studio-zoom-btn"
        disabled={!canZoomIn}
        onClick={() => onChange(Math.min(1, Math.round((zoom + 0.2) * 100) / 100))}
      >
        <ZoomIn size={12} strokeWidth={1.5} />
      </button>
    </div>
  );
}

const SPINNER_FRAMES = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];

function RescanOverlay() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(iv);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          background: "var(--studio-surface)",
          border: "1px solid var(--studio-border)",
          borderRadius: 8,
          padding: "24px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          minWidth: 200,
        }}
      >
        <span
          style={{
            fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
            fontSize: 20,
            color: "var(--studio-accent)",
          }}
        >
          {SPINNER_FRAMES[frame]}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--studio-text)",
            letterSpacing: "0.02em",
          }}
        >
          Rescanning source files
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--studio-text-dimmed)",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Picking up changes to tokens, components,
          <br />
          shadows, and styles made outside the editor.
        </span>
      </div>
    </div>
  );
}

function BreakpointSelect({
  value,
  options,
  onChange,
}: {
  value: number | "fill";
  options: Array<{ label: string; value: number | "fill" }>;
  onChange: (v: number | "fill") => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const label = current?.label ?? `${value}px`;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="studio-bp-trigger" type="button">
          <Monitor size={12} strokeWidth={1.5} />
          <span>{label}</span>
          <ChevronDown size={10} strokeWidth={2} style={{ opacity: 0.5 }} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="studio-bp-dropdown"
          align="end"
          sideOffset={8}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={String(opt.value)}
                className={`studio-bp-option ${isActive ? "active" : ""}`}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                type="button"
              >
                <span className="studio-bp-option-check">
                  {isActive && <CheckIcon />}
                </span>
                {opt.label}
              </button>
            );
          })}
          {typeof value === "number" && !options.some((o) => o.value === value) && (
            <button
              className="studio-bp-option active"
              onClick={() => setOpen(false)}
              type="button"
            >
              <span className="studio-bp-option-check"><CheckIcon /></span>
              {value}px
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
