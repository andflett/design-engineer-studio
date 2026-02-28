import { OpacityIcon } from "@radix-ui/react-icons";
import { SliderInput } from "./slider-input.js";
import { OPACITY_SCALE } from "../../../shared/tailwind-parser.js";

export function OpacitySlider({
  value,
  onPreview,
  onCommitClass,
}: {
  value: string;
  onPreview: (v: string) => void;
  onCommitClass: (c: string, oldClass?: string) => void;
}) {
  const parseOpacity = (v: string): number => {
    const n = parseFloat(v);
    if (isNaN(n)) return 100;
    return n <= 1 && v !== "100" ? Math.round(n * 100) : Math.round(n);
  };

  const commitValue = (pct: number) => {
    const closest = OPACITY_SCALE.reduce((prev, curr) =>
      Math.abs(parseInt(curr) - pct) < Math.abs(parseInt(prev) - pct) ? curr : prev
    );
    onCommitClass(`opacity-${closest}`);
  };

  return (
    <SliderInput
      value={parseOpacity(value)}
      min={0}
      max={100}
      step={5}
      icon={OpacityIcon}
      tooltip="Opacity"
      unit="%"
      onChange={(v) => onPreview(`${v / 100}`)}
      onCommit={commitValue}
    />
  );
}
