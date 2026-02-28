import { useState, useEffect, useRef, useCallback } from "react";
import { Tooltip } from "../tooltip.js";

interface SliderInputProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  icon?: React.ComponentType<{ style?: React.CSSProperties }>;
  tooltip?: string;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
}

export function SliderInput({
  value,
  min,
  max,
  step = 1,
  unit = "",
  icon: Icon,
  tooltip,
  onChange,
  onCommit,
}: SliderInputProps) {
  const [sliderValue, setSliderValue] = useState(value);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSliderValue(value);
  }, [value]);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const snap = (v: number) => Math.round(v / step) * step;
  const pct = ((sliderValue - min) / (max - min)) * 100;

  const valueFromX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return sliderValue;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return snap(clamp(min + ratio * (max - min)));
    },
    [min, max, step, sliderValue],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    const v = valueFromX(e.clientX);
    setSliderValue(v);
    onChange(v);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const v = valueFromX(e.clientX);
    setSliderValue(v);
    onChange(v);
  };

  const handlePointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    onCommit?.(sliderValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    let next = sliderValue;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = clamp(sliderValue + step);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = clamp(sliderValue - step);
    else return;
    e.preventDefault();
    setSliderValue(next);
    onChange(next);
    onCommit?.(next);
  };

  return (
    <div className="studio-scrub-input" style={{ gap: 0 }}>
      {Icon && (
        <Tooltip content={tooltip || ""} side="left">
          <div className="studio-scrub-icon no-scrub">
            <Icon style={{ width: 12, height: 12 }} />
          </div>
        </Tooltip>
      )}
      {/* Track */}
      <div
        ref={trackRef}
        className="studio-slider-track"
        style={{ "--slider-pct": `${pct}%` } as React.CSSProperties}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={sliderValue}
      >
        <div className="studio-slider-fill" />
        <div className="studio-slider-thumb" />
      </div>
      {/* Value readout */}
      <span
        className="studio-slider-readout"
      >
        {sliderValue}{unit}
      </span>
    </div>
  );
}
