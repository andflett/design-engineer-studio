import { type RefObject, useState, useRef, useCallback, useEffect } from "react";

interface ViewportProps {
  viewportWidth: number | "fill";
  onViewportWidthChange: (w: number | "fill") => void;
  zoom: number;
  iframePath: string;
  targetUrl: string;
  iframeRef: RefObject<HTMLIFrameElement | null>;
}

export function Viewport({
  viewportWidth,
  onViewportWidthChange,
  zoom,
  iframePath,
  targetUrl,
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

  // Direct URL — no proxy
  const iframeSrc = `${targetUrl}${iframePath.startsWith("/") ? iframePath : "/" + iframePath}`;

  // Canvas zoom: the iframe stays at its real size (preserving breakpoints),
  // but is visually scaled down and centered in the canvas area.
  // At 60%, a 1280px iframe appears as 768px visually, floating on the canvas.

  // For "fill" mode, we need to know the container width to compute the iframe's
  // real width. We measure it and recalc on resize.
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const measureContainer = useCallback(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.clientWidth);
      setContainerHeight(containerRef.current.clientHeight);
    }
  }, []);

  useEffect(() => {
    measureContainer();
    const observer = new ResizeObserver(measureContainer);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [measureContainer]);

  // The iframe's real width (what breakpoints see)
  const iframeRealWidth = viewportWidth === "fill"
    ? (containerWidth || 1280)
    : viewportWidth;

  // Visual size after scaling
  const visualWidth = iframeRealWidth * zoom;
  const visualHeight = containerHeight * zoom;

  return (
    <div
      className="flex-1 flex items-center justify-center overflow-auto"
      ref={containerRef}
      style={{
        background: "var(--studio-canvas)",
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "6px 6px",
      }}
    >
      {/* Visual-size wrapper: reserves the scaled-down space for centering */}
      <div
        style={{
          width: visualWidth,
          height: visualHeight,
          flexShrink: 0,
          position: "relative",
          /* no transition — zoom and drag changes should be instant */
        }}
      >
        {/* Real-size iframe container, scaled down */}
        <div
          className="relative overflow-hidden"
          style={{
            width: iframeRealWidth,
            height: containerHeight || "100%",
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow:
              "0 0 0 1px rgba(0,0,0,0.5), 0 8px 40px rgba(0,0,0,0.4), inset 0 0.5px 0 rgba(255,255,255,0.06)",
          }}
        >
          <iframe
            key={iframeSrc}
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
