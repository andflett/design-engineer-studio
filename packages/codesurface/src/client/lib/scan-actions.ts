/**
 * Save actions with optimistic updates.
 * Each action: optimistic patch -> POST to server -> replace with server response.
 * On error: re-fetch the affected slice for self-healing.
 */
import { scanStore, type RawScanData } from "./scan-store.js";
import type { TokenMap } from "../../server/lib/scan-tokens.js";
import type { ShadowMap } from "../../server/lib/scan-shadows.js";
import type { BorderMap } from "../../server/lib/scan-borders.js";
import type { GradientMap } from "../../server/lib/scan-gradients.js";
import type { SpacingMap } from "../../server/lib/scan-spacing.js";

// ---------------------------------------------------------------------------
// Full rescan
// ---------------------------------------------------------------------------

export async function rescanAll(): Promise<void> {
  await postJson("/scan/rescan", {});
  const data = await fetchSlice<RawScanData>("all");
  scanStore.setAll(data);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchSlice<T>(sliceName: string): Promise<T> {
  const res = await fetch(`/scan/${sliceName}`);
  return res.json();
}

async function postJson<T = unknown>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Token actions
// ---------------------------------------------------------------------------

export async function saveToken(
  cssFilePath: string,
  token: string,
  value: string,
  selector: string,
): Promise<void> {
  try {
    const data = await postJson<{ ok: boolean; tokens?: TokenMap; error?: string }>(
      "/api/tokens",
      { filePath: cssFilePath, token, value, selector },
    );
    if (!data.ok) {
      console.error("Token save failed:", data.error);
      return;
    }
    if (data.tokens) {
      scanStore.patch("tokens", data.tokens);
    }
  } catch (err) {
    console.error("Token save error:", err);
    // Self-heal: re-fetch tokens from server
    try {
      const tokens = await fetchSlice<TokenMap>("tokens");
      scanStore.patch("tokens", tokens);
    } catch { /* best effort */ }
  }
}

// ---------------------------------------------------------------------------
// Shadow actions
// ---------------------------------------------------------------------------

export async function saveShadow(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<void> {
  try {
    const data = await postJson<{ ok: boolean; shadows?: ShadowMap; error?: string }>(
      endpoint,
      body,
    );
    if (!data.ok) {
      console.error("Shadow save failed:", data.error);
      return;
    }
    if (data.shadows) {
      scanStore.patch("shadows", data.shadows);
    }
  } catch (err) {
    console.error("Shadow save error:", err);
    try {
      const shadows = await fetchSlice<ShadowMap>("shadows");
      scanStore.patch("shadows", shadows);
    } catch { /* best effort */ }
  }
}

// ---------------------------------------------------------------------------
// Gradient actions
// ---------------------------------------------------------------------------

export async function saveGradient(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<void> {
  try {
    const data = await postJson<{ ok: boolean; gradients?: GradientMap; error?: string }>(
      endpoint,
      body,
    );
    if (!data.ok) {
      console.error("Gradient save failed:", data.error);
      return;
    }
    if (data.gradients) {
      scanStore.patch("gradients", data.gradients);
    }
  } catch (err) {
    console.error("Gradient save error:", err);
    try {
      const gradients = await fetchSlice<GradientMap>("gradients");
      scanStore.patch("gradients", gradients);
    } catch { /* best effort */ }
  }
}

// ---------------------------------------------------------------------------
// Spacing actions
// ---------------------------------------------------------------------------

export async function saveSpacing(
  cssFilePath: string,
  variableName: string,
  value: string,
  selector: string,
): Promise<void> {
  try {
    // Spacing writes use the same token/gradients create endpoint
    const data = await postJson<{ ok: boolean; error?: string }>(
      "/api/tokens",
      { filePath: cssFilePath, token: variableName, value, selector },
    );
    if (!data.ok) {
      console.error("Spacing save failed:", data.error);
      return;
    }
    // Re-fetch spacing slice to pick up changes
    try {
      const spacing = await fetchSlice<SpacingMap>("spacing");
      scanStore.patch("spacing", spacing);
    } catch { /* best effort */ }
    // Also refresh tokens since spacing vars are tokens too
    try {
      const tokens = await fetchSlice<TokenMap>("tokens");
      scanStore.patch("tokens", tokens);
    } catch { /* best effort */ }
  } catch (err) {
    console.error("Spacing save error:", err);
    try {
      const spacing = await fetchSlice<SpacingMap>("spacing");
      scanStore.patch("spacing", spacing);
    } catch { /* best effort */ }
  }
}

// ---------------------------------------------------------------------------
// Border actions (borders share the gradients write endpoint)
// ---------------------------------------------------------------------------

export async function saveBorder(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<void> {
  try {
    const data = await postJson<{ ok: boolean; borders?: BorderMap; error?: string }>(
      endpoint,
      body,
    );
    if (!data.ok) {
      console.error("Border save failed:", data.error);
      return;
    }
    if (data.borders) {
      scanStore.patch("borders", data.borders);
    }
  } catch (err) {
    console.error("Border save error:", err);
    try {
      const borders = await fetchSlice<BorderMap>("borders");
      scanStore.patch("borders", borders);
    } catch { /* best effort */ }
  }
}
