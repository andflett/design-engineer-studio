# Studio Hybrid Architecture Plan

## Overview

Replace the current iframe-proxy architecture with a hybrid model: the `<Studio />` selection component lives inside the target app (via the existing `withDesigntools()` config wrapper), while the editor UI remains a separate Vite-served React app. Communication stays via postMessage through the iframe boundary.

This eliminates the proxy layer, the EID marker system, and the heuristic element-matching logic, while preserving CSS isolation for the editor and establishing a framework-agnostic protocol that can extend to non-React frameworks and a richer design tool in the future.

## Motivation

### Problems with the current proxy approach

- The proxy (`create-server.ts`) intercepts HTML, injects `<base>` tags, rewrites URLs, and passes through WebSocket HMR — all fragile plumbing that exists only because the tool needs to inject a script into an app that doesn't know about it.
- The EID marker system (`data-studio-eid`) mutates user source files at runtime just for element tracking, then has to clean up on close and on next startup.
- Element matching uses heuristic scoring (tag, classes, text content, line hints ±3 lines) which can pick the wrong element.

### What we already have

- `@designtools/next-plugin` with `withDesigntools()` already wraps the Next.js config and injects a Webpack loader that stamps every JSX element with `data-source="file:line:col"` at compile time.
- `selection.ts` already reads `data-source` attributes off clicked elements.
- The app has already opted in to the tool by using the config wrapper — the "zero-config" premise is gone, so the proxy buys us nothing.

### What the hybrid gives us

- Drop the entire proxy layer (HTML interception, URL rewriting, base tag hacks, HMR pass-through).
- Drop EID markers — `data-source` gives exact file/line/col on every element.
- Drop heuristic element-finding — go straight to the source location.
- CSS isolation for the editor UI is preserved (it's still in its own Vite app, the iframe boundary still exists).
- A clean framework-agnostic protocol (postMessage) that can be implemented by different framework packages.

## Architecture

### Current

```
Target app (3000) <--proxy-- Tool server (4400) <--serves-- Tool UI (Vite 4401)
                      |  postMessage  |
                      +---------------+
```

- Proxy intercepts HTML, injects selection script + base tag
- Tool server also serves the editor SPA
- EID markers mutated into source files for tracking

### Proposed

```
Editor UI (Vite, 4400)
  |-- <iframe src="http://localhost:3000" />   <-- direct, no proxy
  |       |
  |       +-- Target app with <Studio /> component (selection overlays only)
  |               mounted by withDesigntools() config wrapper
  |               communicates via postMessage
  |
  +-- Write server (API routes on same port)
```

- No proxy — iframe loads the target app directly
- `withDesigntools()` mounts the `<Studio />` selection component into the target app
- `data-source` attributes provide source mapping (already working)
- Editor UI and write server run on 4400
- postMessage is the only communication channel between the two sides

## Protocol Design

### Core principle

The postMessage protocol is the contract between framework-specific packages and the framework-agnostic editor. It uses CSS property/value pairs as the universal primitive, with optional styling-system hints to preserve semantic information (tokens, design system classes).

### Messages: Selection -> Editor (iframe -> parent)

```typescript
// Selection component ready
{ type: "tool:injectedReady" }

// User selected an element
{
  type: "tool:elementSelected",
  data: {
    source: { file: string, line: number, col: number },
    tag: string,
    // Universal — every framework sends this
    computed: Record<string, string>,  // resolved CSS property/value pairs
    boundingRect: DOMRect,
    // Styling-system-specific hints (optional, preserves semantic info)
    hints?: {
      system: "tailwind-v4" | "tailwind-v3" | "bootstrap" | "css-variables" | "plain-css",
      // For class-based systems (Tailwind, Bootstrap):
      classes?: string[],
      // For variable-based systems:
      variables?: Record<string, string>,
      // For token-based systems:
      tokens?: Array<{ property: string, token: string, value: string }>,
    }
  }
}

// Navigation within the target app
{ type: "tool:pathChanged", path: string }
```

### Messages: Editor -> Selection (parent -> iframe)

```typescript
// Mode control
{ type: "tool:enterSelectionMode" }
{ type: "tool:exitSelectionMode" }

// Live preview (CSS primitives — the adapter in the iframe translates)
{
  type: "tool:previewStyle",
  source: { file: string, line: number, col: number },
  changes: Array<{ property: string, value: string }>
}

// Revert preview
{ type: "tool:revertPreview" }

// Re-select current element (after HMR)
{ type: "tool:reselectElement" }

// Theme
{ type: "tool:setTheme", theme: "light" | "dark" }
```

### Write API (Editor -> Write Server)

```typescript
// POST /api/styles
{
  source: { file: string, line: number, col: number },
  changes: Array<{ property: string, value: string }>,
  // The write server uses hints to write back in the native format
  hints?: {
    system: string,
    // System-specific context for smarter writes
  }
}
```

### Hint system: preserving tokens

The `hints` field is critical. It carries styling-system context so the editor can encourage token usage and the write server can write back in the native format.

Example flow — user edits padding on a Tailwind element:

1. Selection sends: `{ computed: { padding: "16px" }, hints: { system: "tailwind-v4", classes: ["p-4", "text-primary"] } }`
2. Editor shows a padding control at 16px, and knows from hints this is `p-4` in Tailwind
3. User drags to 24px
4. Editor sends to write server: `{ source: {...}, changes: [{ property: "padding", value: "24px" }], hints: { system: "tailwind-v4" } }`
5. Write server's Tailwind adapter: "24px matches `p-6` in the resolved theme" -> replaces `p-4` with `p-6` in source

If the user had `text-primary` (a token), the editor can surface this: "this uses the `primary` token — change the token value or override?" This is where the hints enable token-aware editing rather than raw value editing.

## Package Structure

### Existing packages (modified)

| Package | Changes |
|---------|---------|
| `@designtools/core` | Remove proxy/injection from server. Keep shared types, scanner, iframe-bridge (updated protocol), write utilities. |
| `@designtools/studio` | Remove proxy dependency. Editor UI consumes new protocol. Write server uses adapter pattern. |
| `@designtools/next-plugin` | Add `<Studio />` component mounting alongside existing `data-source` transform. Ensure target app allows iframing (no `X-Frame-Options: DENY`). |

### New packages (future)

| Package | Purpose |
|---------|---------|
| `@designtools/vite-plugin` | Vite transform for `data-source` + `<Studio />` mount. Covers Vue, Svelte, plain React on Vite. |
| `@designtools/astro-plugin` | Astro integration. |

Each framework plugin does exactly two things:
1. Inject `data-source` attributes at compile time
2. Mount the `<Studio />` selection component

The editor and write server don't change per framework.

### Adapter pattern for styling systems

Write-side adapters translate CSS property/value changes into the native format:

| Adapter | Translation |
|---------|-------------|
| Tailwind | CSS value -> nearest utility class from resolved theme |
| CSS variables | CSS value -> variable assignment in stylesheet |
| Bootstrap | CSS value -> nearest Bootstrap utility class |
| Plain CSS | CSS value -> direct property in stylesheet or inline |

These are independent of framework adapters. Framework = how you get source mapping + selection. Styling system = how you write changes. Two orthogonal axes.

## What Gets Deleted

1. **Proxy layer** (`create-server.ts` proxy middleware) — no longer needed, iframe loads target directly.
2. **HTML injection** (base tag insertion, script injection) — config wrapper handles this.
3. **EID marker system** (add/remove/cleanup of `data-studio-eid`) — `data-source` replaces it.
4. **Heuristic element matching** (`findElementByScoring`, `findElementAtLine` fallbacks) — exact source location from `data-source`.
5. **`cleanupStaleMarkers()`** — nothing to clean up.
6. **URL rewriting / WebSocket proxying** — no proxy means no rewriting.

## What Gets Added

1. **`<Studio />` selection component** — mounted by `withDesigntools()`, renders overlays + handles mouse events + sends postMessage. Essentially a refactor of `selection.ts` into a React component.
2. **Updated postMessage protocol** — CSS primitives + hints as described above.
3. **Write server adapter interface** — pluggable styling-system translation on the write side.
4. **iframe-src mode in editor** — point iframe directly at `localhost:3000` instead of `/proxy/...`.

## Migration Path

### Phase 1: Hybrid alongside existing

- Build the `<Studio />` component and mount it via `withDesigntools()`.
- Update the editor to accept the new protocol format.
- Keep the proxy path working as a fallback for apps without the config wrapper.
- Ship the new `next-plugin` version.

### Phase 2: Simplify writes

- Replace EID-based element matching with direct `data-source` file/line/col lookup.
- Remove the marking lifecycle (mark on select, unmark on close).
- Remove `cleanupStaleMarkers()`.

### Phase 3: Protocol + adapters

- Implement the CSS primitive + hints protocol fully.
- Build the Tailwind write adapter (reverse-map CSS values to utility classes).
- Build at least one other adapter (CSS variables) to validate the abstraction.

### Phase 4: Additional frameworks

- Build `@designtools/vite-plugin` for Vue/Svelte/plain React.
- Validate that the editor + write server work unchanged with a non-React framework.

## Future: Extending to a Full Design Tool

The protocol is designed to support structural edits beyond styling:

```typescript
// Future message types
{ type: "tool:addElement", parentSource: {...}, componentName: string, position: number }
{ type: "tool:removeElement", source: {...} }
{ type: "tool:moveElement", source: {...}, newParentSource: {...}, position: number }
```

The same pattern applies: the editor sends intent via postMessage, the framework plugin handles live preview in the DOM, and the write server's framework adapter handles the source file mutation. The editor never needs to know whether it's editing React JSX, Vue SFC templates, or Svelte markup.

## Open Questions

1. **Iframe CSP/X-Frame-Options** — Some frameworks or middleware may set headers that prevent iframing. The config wrapper should ensure these are cleared in dev mode. Need to audit common setups.
2. **Cross-origin postMessage security** — Currently using `"*"` origin. In the hybrid model the origins are known (`localhost:3000` and `localhost:4400`), so we can tighten this.
3. **Vite plugin feasibility** — Vite's `transform` hook should work for injecting `data-source`, but mounting a component is trickier without a framework-specific entry point. May need per-framework sub-plugins (e.g., `@designtools/vite-plugin-vue`, `@designtools/vite-plugin-svelte`).
4. **Reverse-mapping CSS to Tailwind classes** — Need access to the resolved Tailwind theme to map values like `24px` back to `p-6`. May require reading the Tailwind config or CSS output at startup.
5. **HMR and `data-source` stability** — When a file is edited and HMR fires, line numbers shift. The selection component needs to handle re-selection after HMR (the `tool:reselectElement` message), potentially by re-reading `data-source` from the updated DOM.
