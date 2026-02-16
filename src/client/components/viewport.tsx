import { type RefObject, useState, useRef, useCallback } from "react";

interface ViewportProps {
  viewportWidth: number | "fill";
  onViewportWidthChange: (w: number | "fill") => void;
  iframePath: string;
  onIframePathChange: (path: string) => void;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  routes: { urlPath: string; filePath: string }[];
}

export function Viewport({
  viewportWidth,
  onViewportWidthChange,
  iframePath,
  onIframePathChange,
  iframeRef,
  routes,
}: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState(iframePath);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const startX = e.clientX;
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const startWidth =
        viewportWidth === "fill"
          ? containerRect.width
          : viewportWidth;

      const onMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;
        const newWidth = Math.max(320, Math.round(startWidth + deltaX * 2));
        onViewportWidthChange(newWidth);
      };

      const onMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [viewportWidth, onViewportWidthChange]
  );

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onIframePathChange(urlInput);
  };

  const iframeSrc = `/proxy${iframePath.startsWith("/") ? iframePath : "/" + iframePath}`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
      {/* URL bar */}
      <div
        className="flex items-center h-8 px-3 gap-2 border-b shrink-0"
        style={{
          background: "var(--studio-bg)",
          borderColor: "var(--studio-border-subtle)",
        }}
      >
        <form onSubmit={handleUrlSubmit} className="flex-1">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="studio-input w-full"
            style={{ padding: "3px 8px" }}
            placeholder="/"
          />
        </form>

        {routes.slice(0, 5).map((route) => (
          <button
            key={route.urlPath}
            onClick={() => {
              setUrlInput(route.urlPath);
              onIframePathChange(route.urlPath);
            }}
            className={`studio-bp-btn ${iframePath === route.urlPath ? "active" : ""}`}
            style={{ fontSize: 10 }}
          >
            {route.urlPath === "/" ? "Home" : route.urlPath.replace(/^\//, "")}
          </button>
        ))}
      </div>

      {/* Iframe container */}
      <div
        className="flex-1 flex items-start justify-center overflow-auto"
        style={{
          background: "var(--studio-bg)",
          padding: viewportWidth === "fill" ? 0 : 16,
        }}
      >
        <div
          className="relative overflow-hidden"
          style={{
            width: viewportWidth === "fill" ? "100%" : `${viewportWidth}px`,
            height: "100%",
            maxWidth: "100%",
            transition: isDragging ? "none" : "width 0.2s ease",
            borderRadius: viewportWidth === "fill" ? 0 : 8,
            boxShadow: viewportWidth === "fill"
              ? "none"
              : "0 0 0 1px var(--studio-border), 0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            className="w-full h-full border-0"
            style={{ background: "white" }}
            title="Preview"
          />

          {/* Drag handle */}
          {viewportWidth !== "fill" && (
            <div
              onMouseDown={handleDragStart}
              className="absolute top-0 right-0 w-1.5 h-full cursor-ew-resize"
              style={{
                background: isDragging
                  ? "var(--studio-accent)"
                  : "transparent",
                opacity: isDragging ? 0.4 : 1,
                transition: "background 0.15s",
              }}
            >
              <div
                className="absolute top-1/2 right-0 w-1 h-8 rounded-full -translate-y-1/2"
                style={{
                  background: isDragging
                    ? "var(--studio-accent)"
                    : "var(--studio-border)",
                  transition: "background 0.15s",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
