import { type RefObject, useState, useRef, useCallback } from "react";

interface ViewportProps {
  viewportWidth: number | "fill";
  onViewportWidthChange: (w: number | "fill") => void;
  iframePath: string;
  iframeRef: RefObject<HTMLIFrameElement | null>;
}

export function Viewport({
  viewportWidth,
  onViewportWidthChange,
  iframePath,
  iframeRef,
}: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  const iframeSrc = `/proxy${iframePath.startsWith("/") ? iframePath : "/" + iframePath}`;

  return (
    <div
      className="flex-1 flex items-start justify-center overflow-auto"
      ref={containerRef}
      style={{
        background: "var(--studio-bg)",
        padding: 16,
      }}
    >
      <div
        className="relative overflow-hidden"
        style={{
          width: viewportWidth === "fill" ? "100%" : `${viewportWidth}px`,
          height: "100%",
          maxWidth: "100%",
          transition: isDragging ? "none" : "width 0.2s ease",
          borderRadius: 4,
          border: "1px solid var(--studio-border)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
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
  );
}
