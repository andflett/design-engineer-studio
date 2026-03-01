interface ShadowPreviewProps {
  value: string;
  size?: number;
  shape?: "square" | "rounded" | "circle";
  background?: string;
  showBorder?: boolean;
  borderColor?: string;
}

export function ShadowPreview({
  value,
  size = 32,
  shape = "rounded",
  background = "white",
  showBorder = false,
  borderColor = "#e0e0e0",
}: ShadowPreviewProps) {
  const borderRadius =
    shape === "circle" ? "50%" : shape === "rounded" ? "4px" : "0";

  return (
    <div
      className="shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius,
        background,
        boxShadow: value,
        border: showBorder ? `1px solid ${borderColor}` : "none",
      }}
    />
  );
}
