/**
 * External store for scan data using useSyncExternalStore (React 18 built-in).
 * Provides indexed lookups and granular slice subscriptions so components only
 * re-render when their specific data changes.
 */
import type { TokenMap, TokenDefinition } from "../../server/lib/scan-tokens.js";
import type { ComponentRegistry, ComponentEntry } from "../../server/lib/scan-components.js";
import type { ShadowMap } from "../../server/lib/scan-shadows.js";
import type { BorderMap } from "../../server/lib/scan-borders.js";
import type { GradientMap } from "../../server/lib/scan-gradients.js";
import type { SpacingMap } from "../../server/lib/scan-spacing.js";
import type { ComponentUsageMap } from "../../server/lib/scan-usages.js";
import type { StylingSystem } from "../../server/lib/detect-styling.js";
import type { FrameworkInfo } from "../../server/lib/detect-framework.js";

// ---------------------------------------------------------------------------
// Indexed wrapper types
// ---------------------------------------------------------------------------

export interface IndexedTokenMap extends TokenMap {
  byName: Map<string, TokenDefinition>;
}

export interface IndexedComponentRegistry extends ComponentRegistry {
  byDataSlot: Map<string, ComponentEntry>;
}

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface ScanState {
  framework: FrameworkInfo | null;
  tokens: IndexedTokenMap | null;
  components: IndexedComponentRegistry | null;
  shadows: ShadowMap | null;
  borders: BorderMap | null;
  gradients: GradientMap | null;
  spacing: SpacingMap | null;
  styling: StylingSystem | null;
  usages: ComponentUsageMap | null;
}

export type ScanSliceKey = keyof ScanState;

// ---------------------------------------------------------------------------
// Index builders
// ---------------------------------------------------------------------------

function indexTokens(raw: TokenMap): IndexedTokenMap {
  const byName = new Map<string, TokenDefinition>();
  for (const t of raw.tokens) {
    byName.set(t.name, t);
  }
  return { ...raw, byName };
}

function indexComponents(raw: ComponentRegistry): IndexedComponentRegistry {
  const byDataSlot = new Map<string, ComponentEntry>();
  for (const c of raw.components) {
    byDataSlot.set(c.dataSlot, c);
  }
  return { ...raw, byDataSlot };
}

// ---------------------------------------------------------------------------
// Raw server response (before indexing)
// ---------------------------------------------------------------------------

export interface RawScanData {
  framework: FrameworkInfo;
  tokens: TokenMap;
  components: ComponentRegistry;
  shadows: ShadowMap;
  borders: BorderMap;
  gradients: GradientMap;
  spacing: SpacingMap;
  styling: StylingSystem;
  usages: ComponentUsageMap;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

type Listener = () => void;

function createScanStore() {
  let state: ScanState = {
    framework: null,
    tokens: null,
    components: null,
    shadows: null,
    borders: null,
    gradients: null,
    spacing: null,
    styling: null,
    usages: null,
  };

  const listeners = new Set<Listener>();

  function emit() {
    for (const fn of listeners) fn();
  }

  function getSnapshot(): ScanState {
    return state;
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /** Replace all scan data at once (initial load). */
  function setAll(data: RawScanData) {
    state = {
      framework: data.framework,
      tokens: indexTokens(data.tokens),
      components: indexComponents(data.components),
      shadows: data.shadows,
      borders: data.borders,
      gradients: data.gradients,
      spacing: data.spacing,
      styling: data.styling,
      usages: data.usages,
    };
    emit();
  }

  /** Patch a single slice. Builds indexes for tokens/components. */
  function patch<K extends ScanSliceKey>(key: K, value: NonNullable<ScanState[K]> extends IndexedTokenMap ? TokenMap : NonNullable<ScanState[K]> extends IndexedComponentRegistry ? ComponentRegistry : ScanState[K]) {
    if (key === "tokens") {
      state = { ...state, tokens: indexTokens(value as TokenMap) };
    } else if (key === "components") {
      state = { ...state, components: indexComponents(value as ComponentRegistry) };
    } else {
      state = { ...state, [key]: value };
    }
    emit();
  }

  return { getSnapshot, subscribe, setAll, patch };
}

export const scanStore = createScanStore();
