# Exploration History & Decision Record

Record of approaches explored, what worked, what didn't, and why we ended up where we are. Written to avoid re-treading old ground.

---

## Phase 1: Zero-Config Proxy (Original Architecture)

### The premise

The tool should work with **any** running dev server — no config changes, no plugins, no opt-in. You point it at `localhost:3000` and it just works.

### How it worked

A full HTTP reverse proxy (`http-proxy-middleware`) sits between the editor and the target app:

```
User's app (3000) <--proxy-- Tool server (4400) --serves--> Editor UI (Vite 4401)
```

The proxy in `packages/core/src/server/create-server.ts`:

1. Intercepts every HTML response from the target app
2. Decompresses gzip/brotli/deflate
3. Injects `<base href="/proxy/">` into `<head>` so all relative URLs resolve through the proxy
4. Injects `<script src="/tool-inject.js"></script>` before `</body>` to load the selection overlay script
5. Strips `content-length`/`content-encoding`/`transfer-encoding` headers (body has changed)
6. Rewrites URL paths (`^/proxy` → `""`) before forwarding upstream
7. Separately proxies `/_next` and `/__nextjs` WebSocket channels so Next.js HMR works

The injected selection script (`packages/core/src/inject/selection.ts`) renders highlight/tooltip/selected overlays, intercepts clicks, and sends element data to the editor via `postMessage`.

### What it got right

- Genuinely zero-config — no changes to the user's project
- CSS isolation for the editor UI (it's in its own Vite app, separated by the iframe boundary)
- The proxy transparently handled assets, navigation, and HMR

### Where it started to break down

The proxy layer is a lot of fragile plumbing:
- HTML interception with decompression/recompression
- `<base>` tag hacks that can conflict with apps that set their own base
- URL rewriting that misses edge cases (absolute URLs, dynamic imports, etc.)
- WebSocket proxying for HMR that's specific to Next.js — every framework has different HMR channels
- All of this exists solely to inject one `<script>` tag into an app that doesn't know about the tool

But the real problem was on the **write side** — once the user selects an element and edits it, how do you find that element in the source code?

---

## Phase 2: Class-Based Heuristic Matching (The First Write Strategy)

### The problem

User clicks a `<button class="bg-blue-500 text-white px-4">Click me</button>` in the browser. The tool needs to find that exact element in the source `.tsx` file to write changes back.

### The approach: scoring

`findElementByScoring()` in `packages/studio/src/server/api/write-element.ts` (lines 303–373) parses the source file into an AST with recast/Babel and scores every JSX element:

| Signal | Points | How |
|--------|--------|-----|
| Component name match (PascalCase) | +10 | `"my-button"` → `"MyButton"` lookup |
| HTML tag match | +3 | Case-insensitive tag comparison |
| Class content match | +2 each | Split className, require ≥30% overlap |
| Text content match | +15 | Look for JSXText children matching a hint |

The highest-scoring element wins.

### Why it wasn't robust enough

This worked for simple pages but fell apart in real apps:

- **Duplicate elements**: A page with two `<button class="btn btn-primary">Submit</button>` — identical tag, classes, and text. The scorer picks the first one, which may be wrong.
- **Dynamic classes**: `className={cn("base", isActive && "active")}` — the runtime classes don't match the source literal. The scorer sees the string `"base"` in source but the browser reports `"base active"`.
- **Conditional rendering**: Elements inside `.map()` or ternaries all look the same in the AST.
- **Component abstraction**: `<Button variant="primary">` renders as `<button class="...">` — the scorer sees `Button` in source but `button` in the DOM. The component name heuristic (+10 points) helps but only if you can reliably map DOM tag → component name.
- **Class churn**: Tailwind utility classes change frequently during editing. After the first edit changes `bg-blue-500` to `bg-red-500`, the scorer's class signal is stale for the next edit.

**Bottom line**: Heuristic matching is fundamentally a guessing game. It works maybe 80% of the time, but for a tool that writes to source files, 80% means corrupting someone's code 1 in 5 edits.

---

## Phase 3: EID Markers (The Bridge Solution)

### The idea

If we can't reliably *find* the element, we can *mark* it. On first selection, stamp a unique `data-studio-eid="s1a2b3c4"` attribute directly into the source JSX. Now subsequent writes have an unambiguous lookup key.

### How it works (current implementation)

**Marking** (`editor-panel.tsx` lines 95–109):
- When the user selects an element, the editor calls `POST /api/element` with `type: "markElement"`
- The server parses the source file with recast, uses the best available strategy to find the element (scoring or line hint), then adds `data-studio-eid="<random>"` as a JSX attribute
- HMR picks up the file change, the DOM updates, and subsequent writes use the EID directly

**Writing** (`write-element.ts` lines 381–406):
- `findElement()` tries three strategies in order:
  1. **EID lookup** — scan AST for matching `data-studio-eid` attribute (guaranteed unique)
  2. **Line hint** — find element at/near a specific line number (from `data-source`)
  3. **Scoring fallback** — the heuristic approach above

**Cleanup** (`editor-panel.tsx` lines 112–118):
- When the editor panel closes, it calls `POST /api/element` with `type: "removeMarker"` to strip the EID from source
- On tool startup, `cleanupStaleMarkers()` walks all `.tsx`/`.jsx`/`.html` files and removes any leftover EID attributes from crashed sessions

### What it solved

- Subsequent writes to the same element are 100% reliable (EID is unambiguous)
- No heuristic guessing after the first selection
- Works regardless of how complex the className expression is

### What's wrong with it

- **Mutates user source files** at runtime just for tracking. This is invasive — the user sees phantom diffs, their git status is dirty, and if the tool crashes the markers are left behind.
- **First selection still uses heuristics** (or line hint if the plugin is installed). The EID only helps for *subsequent* writes to the *same* element.
- **Cleanup is fragile** — `cleanupStaleMarkers()` uses regex on all project files at startup. If the regex misses an edge case (e.g., multiline JSX attributes), markers persist.
- **HMR race conditions** — the file is written to add the marker, HMR fires, the DOM re-renders. The tool has to wait for the new DOM before it can confirm the marker is present.

### Assessment

EID markers are clever but they're a workaround for the real problem: the tool has no reliable way to map DOM elements to source locations. They paper over the matching problem by creating a side-channel identity, at the cost of mutating user files.

---

## Phase 4: The Config Wrapper & data-source (Turning Point)

### The realisation

The zero-config premise was already compromised. The heuristic matching wasn't reliable enough for production use, and EID markers were too invasive. The alternatives were:

1. Accept that the tool requires a config wrapper (small opt-in, big reliability gain)
2. Keep trying to make heuristic matching work (diminishing returns, fundamental limits)

We chose option 1.

### What was built: `@designtools/next-plugin`

`packages/next-plugin/src/index.ts` exports `withDesigntools()` — a Next.js config wrapper:

```typescript
// next.config.ts
import { withDesigntools } from "@designtools/next-plugin";
export default withDesigntools({ /* user's normal config */ });
```

It injects a Webpack loader (`packages/next-plugin/src/loader.ts`) that runs a Babel transform over every `.tsx`/`.jsx` file. The transform adds a `data-source` attribute to every JSX element at compile time:

```html
<!-- Before (source) -->
<button className="bg-blue-500">Click</button>

<!-- After (compiled, in browser DOM) -->
<button class="bg-blue-500" data-source="src/app/page.tsx:42:8">Click</button>
```

The value is `relativePath:line:col` extracted from Babel's AST location data.

**Why Babel and not SWC**: Next.js uses SWC by default, but SWC's plugin API doesn't reliably expose JSX location metadata. The Babel loader runs alongside SWC — it only adds attributes, doesn't transform anything else.

### What this changes

With `data-source` on every element:
- The selection script reads it directly: `el.getAttribute("data-source")` → `{ file, line, col }`
- The write server can go straight to `file:line:col` in the source — no scoring, no guessing
- `findElementAtLine()` (strategy 2 in `findElement()`) becomes the primary strategy, not a fallback
- The first write is as reliable as subsequent EID-based writes, without needing to mark anything

### The trade-off we accepted

The tool is no longer zero-config. The user has to wrap their Next.js config. But:
- It's a one-line change
- It's dev-only (the loader checks `context.dev`)
- It makes every interaction reliable instead of heuristic
- It opens the door to eliminating the proxy entirely

---

## Phase 5: Exploring the Hybrid (Where We Are Now)

### The question

If the user has already opted in with `withDesigntools()`, what is the proxy actually buying us?

The proxy exists to inject the selection script. But `withDesigntools()` already has a Webpack loader that runs on every file — it could just as easily mount a `<Studio />` selection component. Then the iframe can point directly at `localhost:3000`, no proxy needed.

### What the hybrid architecture looks like

```
Editor UI (Vite, 4400)
  |-- <iframe src="http://localhost:3000" />   ← direct, no proxy
  |       |
  |       +-- Target app with <Studio /> component
  |               mounted by withDesigntools()
  |               communicates via postMessage
  |
  +-- Write server (API routes on same port)
```

### What gets deleted

| Thing | Why it existed | Why it's no longer needed |
|-------|---------------|--------------------------|
| Proxy middleware | Inject selection script | Config wrapper mounts `<Studio />` directly |
| `<base>` tag injection | Make relative URLs work through proxy | No proxy, no rewriting needed |
| URL rewriting | Strip `/proxy` prefix | Direct iframe, original URLs preserved |
| WebSocket HMR proxying | Pass through Next.js hot reload | Direct iframe, HMR works natively |
| EID markers | Reliable element identity for writes | `data-source` gives exact file:line:col |
| `cleanupStaleMarkers()` | Remove leftover EIDs from crashed sessions | No markers to clean up |
| `findElementByScoring()` | Guess which element the user clicked | Exact source location from `data-source` |
| HTML decompression/recompression | Proxy needs to modify HTML body | No proxy |

### What gets added

- `<Studio />` React component — the selection overlay logic from `selection.ts`, refactored as a component mounted by the config wrapper
- Updated postMessage protocol with CSS primitives + styling-system hints
- Write server adapter pattern (Tailwind adapter, CSS variables adapter, etc.)

### The protocol design

The key design decision: **CSS property/value pairs as the universal primitive, with optional hints to preserve semantic information**.

The `hints` field is what prevents the tool from destroying tokens. When a Tailwind element is selected, the selection component sends:

```typescript
{
  computed: { padding: "16px" },
  hints: {
    system: "tailwind-v4",
    classes: ["p-4", "text-primary"],
    tokens: [{ property: "color", token: "primary", value: "#3b82f6" }]
  }
}
```

The editor knows `padding: 16px` comes from `p-4`. If the user drags to `24px`, the write server's Tailwind adapter maps `24px` → `p-6` and replaces the class in source. Tokens are surfaced in the editor so the user can choose to change the token value vs. override it.

Without hints, the tool would write raw CSS values and destroy the design system semantics. **Encouraging token usage is a core tenet** — the protocol is designed around it.

### The fallback question

What about apps that don't use `withDesigntools()`? Two options:

1. **Keep the proxy as a degraded fallback** — works but means maintaining two architectures
2. **Require the config wrapper** — simpler, but not zero-config

We're leaning toward option 2 with the proxy kept temporarily in Phase 1 for migration. The zero-config dream was nice but the reliability trade-off isn't worth it — a tool that writes to your source files needs to be right, not convenient.

### Framework expansion

The config wrapper pattern generalises:

| Framework | Plugin | How it works |
|-----------|--------|-------------|
| Next.js | `@designtools/next-plugin` | Webpack loader (exists today) |
| Vite (React) | `@designtools/vite-plugin` | Vite `transform` hook |
| Vite (Vue) | `@designtools/vite-plugin-vue` | Vue SFC compiler plugin |
| Vite (Svelte) | `@designtools/vite-plugin-svelte` | Svelte preprocessor |
| Astro | `@designtools/astro-plugin` | Astro integration |

Each plugin does exactly two things: inject `data-source` attributes and mount the `<Studio />` selection component. The editor and write server don't change per framework.

Styling system adapters (Tailwind, Bootstrap, CSS variables, plain CSS) are orthogonal to framework adapters. Framework = how you get source mapping + selection. Styling system = how you write changes. Two independent axes.

---

## Alternatives Considered and Rejected

### A. Source maps for element → source mapping

**Idea**: Use the browser's source maps to map a clicked DOM element back to its source location.

**Why rejected**: Source maps map *compiled JS* back to *source JS*. They don't map *DOM elements* back to *JSX expressions*. A `<div>` in the DOM came from `React.createElement("div", ...)` in compiled output, which came from `<div>` in JSX — but the source map only covers the middle step. You'd need to parse the compiled JS to find the `createElement` call, then use the source map to find the JSX location. Fragile across frameworks and bundlers.

### B. React DevTools protocol for element identification

**Idea**: Use React's internal fiber tree (exposed via DevTools protocol) to map DOM nodes to component source locations.

**Why rejected**:
- React-specific (doesn't generalise to Vue, Svelte, etc.)
- The fiber tree gives component locations, not element locations — a component with 10 divs maps them all to the same source location
- The DevTools protocol is internal and changes between React versions
- Doesn't work in production builds (fiber debug info stripped)

### C. CSS-only editing (no element matching needed)

**Idea**: Only edit CSS files and design tokens, never modify JSX. Sidesteps the element-matching problem entirely.

**Why rejected**: Too limiting. The core value of the tool is editing *elements* — changing a button's padding, swapping a component's variant class, overriding an instance's styles. Token editing alone is a CSS variable editor, not a design tool.

### D. AST fingerprinting for element identity

**Idea**: Hash the AST subtree of each element (tag + props + children structure) to create a stable fingerprint that survives minor edits.

**Why rejected**: The fingerprint changes whenever the element is edited (that's the whole point — we're modifying it). So the fingerprint is only valid for the first write, same as scoring. After that you need a persistent identity mechanism, which is what EID markers are. This is a more complex version of the same approach with the same fundamental limitation.

### E. Decorator/wrapper component for element tracking

**Idea**: Wrap every component in a higher-order component that registers itself with the tool at mount time.

**Why rejected**: Invasive — changes the component tree structure, breaks React.memo and ref forwarding, adds runtime overhead. The Babel transform approach (`data-source` attributes) achieves the same source mapping without altering the component tree.

### F. Browser extension instead of proxy

**Idea**: A Chrome extension that injects the selection script into any page, no proxy needed.

**Why rejected**:
- Requires manual installation (worse DX than a config wrapper)
- Extension API has restrictions on page script injection timing
- Can't control the write server from an extension (needs a separate local process anyway)
- Doesn't solve the element → source mapping problem

---

## Current State Summary

| Layer | Approach | Status |
|-------|----------|--------|
| App integration | Proxy (zero-config) | Working, marked for removal |
| App integration | Config wrapper (`withDesigntools()`) | Working, path forward |
| Source mapping | Heuristic scoring | Working, fallback only |
| Source mapping | EID markers | Working, marked for removal |
| Source mapping | `data-source` attributes | Working, primary strategy |
| Element writes | recast AST transforms | Working, keeping |
| Token writes | Regex find-and-replace in CSS | Working, keeping |
| Editor ↔ App | postMessage via iframe | Working, protocol being updated |
| CSS isolation | Separate Vite app in iframe | Working, keeping |

### Key files

| File | What it does |
|------|-------------|
| `packages/core/src/server/create-server.ts` | Proxy middleware, HTML injection, HMR pass-through |
| `packages/core/src/inject/selection.ts` | Selection overlays, click handling, data extraction, postMessage |
| `packages/core/src/client/lib/iframe-bridge.ts` | postMessage helpers (sendToIframe, onIframeMessage) |
| `packages/core/src/scanner/detect-styling.ts` | Detect Tailwind/Bootstrap/CSS variables/etc. |
| `packages/core/src/scanner/scan-tokens.ts` | Parse CSS custom properties into token definitions |
| `packages/studio/src/server/api/write-element.ts` | AST-based JSX writes, EID markers, element matching |
| `packages/studio/src/server/api/write-tokens.ts` | Regex-based CSS token value writes |
| `packages/studio/src/client/components/editor-panel.tsx` | Editor sidebar, EID lifecycle, write calls |
| `packages/next-plugin/src/index.ts` | withDesigntools() config wrapper |
| `packages/next-plugin/src/loader.ts` | Babel transform for data-source attributes |

---

## Lessons Learned

1. **Zero-config is a spectrum, not a binary.** The proxy gave zero-config at the cost of fragility. The config wrapper costs one line but buys reliability. For a tool that writes to source files, reliability wins.

2. **Heuristic matching has a ceiling.** No matter how many signals you add (tag, classes, text, position), real-world UIs have enough duplication that heuristics will sometimes pick the wrong element. Compile-time source mapping is the only approach that's truly reliable.

3. **Don't mutate user files for internal bookkeeping.** EID markers solved the identity problem but created new ones: dirty git status, cleanup on crash, HMR races. The `data-source` approach puts the metadata in the compiled output, not the source.

4. **Tokens matter more than raw values.** A tool that converts `p-4` to `padding: 16px` and writes back `padding: 24px` has destroyed design system semantics. The protocol needs to carry token/class context so the write path can map values back to the design system's vocabulary.

5. **Framework and styling system are orthogonal concerns.** "How do I find this element in source?" (framework) and "How do I write this CSS change in the native format?" (styling system) are independent problems. Conflating them leads to an explosion of special cases.
