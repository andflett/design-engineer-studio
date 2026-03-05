import { OpacityIcon } from "@radix-ui/react-icons";
import { SliderInput } from "./slider-input.js";

export function OpacitySlider({
  value,
  scale,
  onPreview,
  onCommitClass,
  onCommitStyle,
}: {
  value: string;
  /** Theme-derived opacity scale keys (e.g. ["0", "5", "10", ...]). Empty = raw percentage. */
  scale: readonly string[];
  onPreview: (v: string) => void;
  onCommitClass: (c: string, oldClass?: string) => void;
  /** CSS mode: commit raw CSS value instead of Tailwind classes */
  onCommitStyle?: (cssValue: string) => void;
}) {
  const parseOpacity = (v: string): number => {
    const n = parseFloat(v);
    if (isNaN(n)) return 100;
    return n <= 1 && v !== "100" ? Math.round(n * 100) : Math.round(n);
  };

  const commitValue = (pct: number) => {
    if (onCommitStyle) {
      onCommitStyle(`${pct / 100}`);
      return;
    }
    if (scale.length > 0) {
      const closest = scale.reduce((prev, curr) =>
        Math.abs(parseInt(curr) - pct) < Math.abs(parseInt(prev) - pct) ? curr : prev
      );
      onCommitClass(`opacity-${closest}`);
    } else {
      // No scale — use arbitrary value
      onCommitClass(`opacity-[${pct / 100}]`);
    }
  };

  return (
    <SliderInput
      value={parseOpacity(value)}
      min={0}
      max={100}
      step={onCommitStyle ? 1 : (scale.length > 0 ? 5 : 1)}
      icon={OpacityIcon}
      tooltip="Opacity"
      unit="%"
      onChange={(v) => onPreview(`${v / 100}`)}
      onCommit={commitValue}
    />
  );
}
