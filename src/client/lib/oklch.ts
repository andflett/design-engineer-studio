/**
 * OKLCH color utilities: parse, format, contrast calculation.
 */

export interface OklchColor {
  l: number; // 0-100 (lightness %)
  c: number; // 0-0.4 (chroma)
  h: number; // 0-360 (hue)
}

export function parseOklch(value: string): OklchColor | null {
  // Match: oklch(55.07% 0.1499 19.98) or oklch(0.5507 0.1499 19.98)
  const match = value.match(
    /oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)/
  );
  if (!match) return null;

  let l = parseFloat(match[1]);
  if (match[2] === "%") {
    // Already in percentage
  } else if (l <= 1) {
    l = l * 100; // Convert 0-1 to 0-100
  }

  return {
    l,
    c: parseFloat(match[3]),
    h: parseFloat(match[4]),
  };
}

export function formatOklch(color: OklchColor): string {
  return `oklch(${color.l.toFixed(2)}% ${color.c.toFixed(4)} ${color.h.toFixed(2)})`;
}

/**
 * Convert OKLCH to approximate sRGB hex for preview.
 * This is a simplified conversion — for accurate results use culori.
 */
export function oklchToHex(color: OklchColor): string {
  // Simplified: use CSS to compute
  // In browser, we can create a temp element and read computed color
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.style.color = formatOklch(color);
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color;
    document.body.removeChild(el);

    // Parse rgb(r, g, b) or rgba(r, g, b, a)
    const rgbMatch = computed.match(
      /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
    );
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]).toString(16).padStart(2, "0");
      const g = parseInt(rgbMatch[2]).toString(16).padStart(2, "0");
      const b = parseInt(rgbMatch[3]).toString(16).padStart(2, "0");
      return `#${r}${g}${b}`;
    }
  }
  return "#000000";
}

/**
 * Calculate relative luminance from OKLCH lightness (approximate).
 * For WCAG contrast, OKLCH lightness roughly correlates with perceptual lightness.
 */
export function contrastRatio(l1: number, l2: number): number {
  // Approximate: convert OKLCH lightness to relative luminance
  // L_oklch ≈ Y^(1/3), so Y ≈ L^3
  const y1 = Math.pow(l1 / 100, 3);
  const y2 = Math.pow(l2 / 100, 3);

  const lighter = Math.max(y1, y2);
  const darker = Math.min(y1, y2);

  return (lighter + 0.05) / (darker + 0.05);
}

export function contrastLevel(ratio: number): "AAA" | "AA" | "AA-large" | "fail" {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA-large";
  return "fail";
}

/**
 * Parse HSL color format as used by some ShadCN setups.
 */
export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export function parseHsl(value: string): HslColor | null {
  // Match: hsl(222.2 84% 4.9%) or 222.2 84% 4.9%
  const match = value.match(
    /(?:hsl\()?\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)?/
  );
  if (!match) return null;
  return {
    h: parseFloat(match[1]),
    s: parseFloat(match[2]),
    l: parseFloat(match[3]),
  };
}
