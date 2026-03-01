/**
 * React hooks for accessing scan data slices.
 * Each hook wraps useSyncExternalStore with a slice selector so components
 * only re-render when their specific data changes.
 */
import { useSyncExternalStore, useCallback } from "react";
import { scanStore, type ScanState, type IndexedTokenMap, type IndexedComponentRegistry } from "./scan-store.js";
import type { ShadowMap } from "../../server/lib/scan-shadows.js";
import type { BorderMap } from "../../server/lib/scan-borders.js";
import type { GradientMap } from "../../server/lib/scan-gradients.js";
import type { SpacingMap } from "../../server/lib/scan-spacing.js";
import type { StylingSystem } from "../../server/lib/detect-styling.js";
import type { FrameworkInfo } from "../../server/lib/detect-framework.js";
import type { ComponentUsageMap } from "../../server/lib/scan-usages.js";

// Cache selectors to maintain referential equality across renders.
// useSyncExternalStore requires stable selector references.

function useSlice<T>(selector: (s: ScanState) => T): T {
  return useSyncExternalStore(
    scanStore.subscribe,
    useCallback(() => selector(scanStore.getSnapshot()), [selector]),
  );
}

const selectTokens = (s: ScanState) => s.tokens;
const selectComponents = (s: ScanState) => s.components;
const selectShadows = (s: ScanState) => s.shadows;
const selectBorders = (s: ScanState) => s.borders;
const selectGradients = (s: ScanState) => s.gradients;
const selectSpacing = (s: ScanState) => s.spacing;
const selectStyling = (s: ScanState) => s.styling;
const selectUsages = (s: ScanState) => s.usages;
const selectFramework = (s: ScanState) => s.framework;
const selectReady = (s: ScanState) =>
  s.framework !== null &&
  s.tokens !== null &&
  s.components !== null &&
  s.shadows !== null &&
  s.borders !== null &&
  s.gradients !== null &&
  s.spacing !== null &&
  s.styling !== null;

export function useTokens(): IndexedTokenMap | null {
  return useSlice(selectTokens);
}

export function useComponents(): IndexedComponentRegistry | null {
  return useSlice(selectComponents);
}

export function useShadows(): ShadowMap | null {
  return useSlice(selectShadows);
}

export function useBorders(): BorderMap | null {
  return useSlice(selectBorders);
}

export function useGradients(): GradientMap | null {
  return useSlice(selectGradients);
}

export function useSpacing(): SpacingMap | null {
  return useSlice(selectSpacing);
}

export function useStyling(): StylingSystem | null {
  return useSlice(selectStyling);
}

export function useUsages(): ComponentUsageMap | null {
  return useSlice(selectUsages);
}

export function useFramework(): FrameworkInfo | null {
  return useSlice(selectFramework);
}

export function useScanReady(): boolean {
  return useSlice(selectReady);
}
