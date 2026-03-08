# CLAUDE.md

Reference for AI assistants working on this codebase. Read this before making changes.

## What this project is

Visual editing CLI tools for web applications — edit styles, tokens, and components visually with changes written back to source files.

## Packages

| Package | Notes |
|---------|-------|
| `@designtools/surface` | Hybrid architecture — selection in target app, editor UI separate |
| `@designtools/next-plugin` | Config wrapper for `data-source` attributes + `<Surface />` mount |
| `@designtools/vite-plugin` | Vite plugin for `data-source` attributes + `<Surface />` auto-mount |
| `@designtools/astro-plugin` | Astro integration wrapping vite-plugin + `.astro` template annotation |
| `@designtools/svelte-plugin` | SvelteKit plugin wrapping vite-plugin + `.svelte` template annotation |

## Monorepo layout

```
packages/
  surface/       Hybrid visual editor (CLI + server + React SPA)
  next-plugin/   Next.js config wrapper + data-source Babel transform
  vite-plugin/   Vite plugin for source annotation + Surface auto-mount
  astro-plugin/  Astro integration + .astro template annotation
  svelte-plugin/ SvelteKit plugin + .svelte template annotation
demos/
  next-react-tailwind/      Next.js + React + Tailwind v4 + CVA
  vite-react-tailwind/      Vite + React + Tailwind v4
  remix-react-tailwind/     Remix (React Router v7) + React + Tailwind v4
  vite-react-tailwind-v3/   Vite + React + Tailwind v3
  vite-react-css/           Vite + React + plain CSS + CSS variables
  astro-css/                Astro + plain CSS + scoped styles
  svelte-css/               SvelteKit + plain CSS + scoped styles
  svelte-tailwind/          SvelteKit + Tailwind v4
tests/
  fixtures/             Test fixture projects (for integration tests)
  write-element.test.ts Server integration tests (supertest)
```

- `packages/next-plugin`, `packages/surface`, `packages/vite-plugin`, `packages/astro-plugin`, and `packages/svelte-plugin` are npm workspaces.
- `demos/*` are standalone apps (not workspaces).

## Key conventions

### Module system

- Everything is ESM (`"type": "module"` in root package.json).
- **All relative imports must use `.js` extensions**, even for `.ts` source files. This is required by Node ESM resolution. Example: `import { foo } from "./bar.js"`.

### TypeScript

- `tsconfig.base.json` at root: ES2022, ESNext modules, bundler resolution, react-jsx, strict.
- Each package extends it: `"extends": "../../tsconfig.base.json"`.
- Type-check with: `npx tsc --noEmit --project packages/<name>/tsconfig.json`.

### Build system

- **Client (React SPA)**: Vite + React + Tailwind via `@tailwindcss/vite`.
- **CLI (Node server)**: tsup, ESM format, adds shebang for bin entry.
- Both build via: `npm run build` (runs `vite build && tsup`).
- Output goes to `dist/cli.js` (with shebang) and `dist/client/`.

### Naming patterns

| Kind | Convention | Example |
|------|-----------|---------|
| Package | `@designtools/<name>` | `@designtools/surface` |
| CLI binary | `designtools-<name>` | `surface` |
| Scanner files | `scan-<noun>.ts` | `scan-tokens.ts` |
| Detector files | `detect-<noun>.ts` | `detect-styling.ts` |
| API routers | `write-<noun>.ts` | `write-element.ts` |
| Client components | `<noun>-<role>.tsx` | `editor-panel.tsx` |
| Test files | `<module>.test.ts` (co-located) | `tailwind-parser.test.ts` |

### Styling system types

The `StylingSystem.type` union drives framework-specific behavior:

```typescript
type: "tailwind-v4" | "tailwind-v3" | "bootstrap" | "css-variables" | "plain-css" | "unknown"
```

### Color picker & popover conventions

- **Always use the shared color picker** from `packages/surface/src/client/components/color-picker.tsx` (`ColorPicker`, `ColorInputFields`, `ModeTabs`, `cssToRgba`, `rgbaToCss`). Never use native `<input type="color">` for color selection.
- **All popovers must use `@radix-ui/react-popover`** — never use manual `createPortal` with hand-rolled positioning/dismiss logic. Radix handles focus trapping, Escape dismissal, click-outside, and collision-aware positioning.
- Color token popovers are in `color-popover.tsx` (`ColorPopover`, `TokenPopover`). Gradient stop color pickers use `StopColorPicker` in `token-editor.tsx`. All use Radix Popover + react-colorful internally.

## Surface architecture

### How it works

```
Editor UI (Vite, 4400)
  |-- <iframe src="http://localhost:3000" />   <- direct, no proxy
  |       |
  |       +-- Target app with <Surface /> component
  |               mounted by withDesigntools() or vite-plugin
  |               communicates via postMessage
  |
  +-- Write server (API routes on same port)
        POST /api/write-element   <- element class/CSS changes
        POST /api/tokens          <- CSS custom property edits
        POST /api/component       <- CVA variant class edits
        GET  /scan/all            <- unified scan data
```

- No proxy — iframe loads the target app directly at its dev server URL
- Framework plugins inject `data-source` attributes at compile time and mount the `<Surface />` selection component
- `data-source="file:line:col"` on every JSX element, `.astro` template element, and `.svelte` template element provides exact source mapping
- Editor UI and write server run on port 4400
- postMessage is the only communication channel between editor and target app

### Protocol

Messages use CSS property/value pairs as the universal primitive, with optional `hints` to preserve styling-system semantics (Tailwind classes, design tokens, etc.).

**Target app -> Editor**: `tool:injectedReady`, `tool:elementSelected`, `tool:pathChanged`, `tool:componentTree`
**Editor -> Target app**: `tool:enterSelectionMode`, `tool:exitSelectionMode`, `tool:previewInlineStyle`, `tool:revertInlineStyles`, `tool:previewTokenValue`, `tool:revertTokenValues`

### Write adapters

Two commit modes, chosen by `stylingType`:

| Mode | Systems | Client path | Server path |
|------|---------|-------------|-------------|
| **Class mode** | `tailwind-v4`, `tailwind-v3` | `onCommitClass(twClass, oldClass)` → `handleWriteElement(replaceClass)` | JSX className AST edit |
| **CSS mode** | `plain-css`, `css-variables`, `css-modules`, `unknown` | `onCommitStyle(cssProp, cssValue)` → `handleWriteStyle()` | CSS rule edit or inline style fallback |

CSS mode fallback chain (server-side):
1. **CSS Modules** — if source file imports `.module.css` and className uses `styles.foo`, find `.foo {}` in the module file
2. **Project stylesheets** — search `cssFiles` config for matching `.classname` rule
3. **Inline style** — write `style={{ property: value }}` on the JSX element (AST edit)

Framework plugins and styling-system adapters are orthogonal. Framework = source mapping + selection. Styling system = how changes are written.

### Instance vs Component editing

When clicking a component (element with `data-slot`):
- **Component tab**: edits the component definition (CVA variant classes) — affects ALL instances
- **Instance tab**: edits the usage site (className override, prop changes) — affects THIS instance only

The `instanceSource` field carries the usage site location (from `data-instance-source`). Write types: `replaceClass`/`addClass` for element source, `instanceOverride` for usage site, `cssProperty` for CSS mode.

### Key files

| File | Purpose |
|------|---------|
| `packages/surface/src/cli.ts` | CLI entry point |
| `packages/surface/src/server/index.ts` | Express server + write API + Vite middleware |
| `packages/surface/src/server/api/write-element.ts` | Element class/CSS writes (all types) |
| `packages/surface/src/server/api/write-tokens.ts` | CSS custom property writes |
| `packages/surface/src/server/lib/ast-helpers.ts` | Recast-based JSX manipulation |
| `packages/surface/src/server/lib/find-element.ts` | Element finder via data-source coordinates |
| `packages/surface/src/server/lib/write-css-rule.ts` | CSS rule finder/writer, CSS module resolver |
| `packages/surface/src/server/lib/safe-path.ts` | Path traversal prevention |
| `packages/surface/src/server/lib/scan-tokens.ts` | CSS token scanner |
| `packages/surface/src/server/lib/scan-components.ts` | Component scanner (CVA, data-slot) |
| `packages/surface/src/server/lib/detect-styling.ts` | Styling system detection |
| `packages/surface/src/server/lib/resolve-tailwind-theme.ts` | Tailwind v3/v4 theme scale resolver |
| `packages/surface/src/shared/tailwind-theme.ts` | ResolvedTailwindTheme type definitions |
| `packages/surface/src/client/app.tsx` | Main React app |
| `packages/surface/src/client/components/editor-panel.tsx` | Three-tab editor (Token, Component, Instance) |
| `packages/surface/src/client/components/computed-property-panel.tsx` | Figma-style property controls |
| `packages/surface/src/shared/protocol.ts` | postMessage type definitions |
| `packages/surface/src/shared/tailwind-map.ts` | CSS → Tailwind class mapping |
| `packages/surface/src/shared/tailwind-parser.ts` | Tailwind class parser |
| `packages/next-plugin/src/index.ts` | withDesigntools() config wrapper |
| `packages/next-plugin/src/loader.ts` | Babel transform for data-source attributes |
| `packages/vite-plugin/src/plugin.ts` | Vite transform hook for data-source attributes |
| `packages/vite-plugin/src/mount-transform.ts` | Auto-mount Surface in Vite entry points |
| `packages/astro-plugin/src/index.ts` | Astro integration entry (wraps vite-plugin + mounts Surface) |
| `packages/astro-plugin/src/astro-source-transform.ts` | .astro template annotation via @astrojs/compiler |
| `packages/svelte-plugin/src/index.ts` | SvelteKit plugin entry (wraps vite-plugin + mounts Surface) |
| `packages/svelte-plugin/src/svelte-source-transform.ts` | .svelte template annotation via svelte/compiler |
| `packages/surface/src/server/lib/scoped-style.ts` | Scoped `<style>` block reader/writer for .astro/.svelte |

## Editor UI conventions

- **Dark theme only** for the editor chrome. CSS variables prefixed `--studio-*` define the palette.
- **Font sizes**: Section headers 9px uppercase, property labels 10px, values 11px monospace.
- **Scrub inputs**: Icon + text input with drag-to-scrub for numeric values.
- **Scale inputs**: Composite control — dropdown for scale values + arbitrary text input, toggled by a button. In CSS mode, shows raw CSS values instead of Tailwind scale.
- **Segmented controls** (`.studio-segmented`): Tab switching and layout property toggles.
- **Section headers** (`.studio-section-hdr`): Collapsible sections with chevron, uppercase label, count badge.
- **Tooltips**: Use `@radix-ui/react-tooltip` via `<Tooltip>` wrapper. Never use HTML `title` attributes.

### Key CSS classes

| Class | Purpose |
|-------|---------|
| `.studio-tab-explainer` | Help text box at top of each tab |
| `.studio-segmented` | Tab switcher / segmented control |
| `.studio-section-hdr` | Collapsible section header |
| `.studio-prop-row` | Single property row |
| `.studio-scrub-input` | Drag-to-scrub numeric input |
| `.studio-scale-input` | Token/CSS toggle scale input |
| `.studio-swatch` | Color swatch with checkerboard |
| `.studio-popover` | Floating popover panel |
| `.studio-icon-btn` | Toolbar icon button |
| `.studio-input` | Text input |
| `.studio-select` | Select dropdown |

## Testing

Test runner: **vitest** (co-located `*.test.ts` files + `tests/` directory).

```bash
npm test              # run all tests once
npm run test:watch    # watch mode
```

### Test tiers

| Tier | What | Examples |
|------|------|---------|
| **Unit** | Pure functions with no I/O | `tailwind-parser.test.ts`, `tailwind-map.test.ts`, `oklch.test.ts`, `safe-path.test.ts`, `write-css-rule.test.ts`, `mount-transform.test.ts`, `resolve-tailwind-theme.test.ts`, `astro-source-transform.test.ts`, `svelte-source-transform.test.ts`, `scoped-style.test.ts` |
| **AST fixtures** | Parse → transform → verify source output | `ast-helpers.test.ts`, `find-element.test.ts` |
| **Server integration** | supertest against Express router + fixture project | `tests/write-element.test.ts` — covers replaceClass, addClass, cssProperty (CSS modules, stylesheets, inline fallback), scoped styles (.astro/.svelte), path traversal |

Test fixtures live in `tests/fixtures/project-a/` — JSX files, CSS modules, and stylesheets that the integration tests read/write (restored after each test).

### E2E tests (Playwright)

Full browser tests using Playwright. Config: `playwright.config.ts`. Specs: `tests/e2e/`.

```bash
npm run test:e2e          # run all E2E tests (headless)
npm run test:e2e:ui       # run with Playwright UI
npx playwright test --project=next-react-tailwind tests/e2e/next-react-tailwind/selection.spec.ts  # single file
```

**Projects and ports:**

| Project | Demo | Target port | Editor port |
|---------|------|-------------|-------------|
| `next-react-tailwind` | Next.js + React + Tailwind v4 + CVA | 3100 | 4500 |
| `vite-react-tailwind` | Vite + React + Tailwind v4 | 3101 | 4501 |
| `vite-react-css` | Vite + React + plain CSS + CSS vars | 3103 | 4503 |
| `astro-css` | Astro + plain CSS + scoped styles | 3105 | 4505 |
| `svelte-css` | SvelteKit + scoped CSS + CSS vars | 3106 | 4506 |
| `remix-react-tailwind` | Remix + React + Tailwind v4 | 3107 | 4507 |
| `vite-react-tailwind-v3` | Vite + React + Tailwind v3 | 3109 | 4509 |
| `svelte-tailwind` | SvelteKit + Tailwind v4 | 3110 | 4510 |

**Fixtures** (`tests/e2e/shared/fixtures.ts`):

- `SurfacePage` — wraps `Page` + iframe `FrameLocator`. Key methods:
  - `waitForIframeReady()` — waits for selection mode button
  - `selectElement(iframeSelector)` — clicks in iframe, waits for editor panel
  - `getElementName()` / `getPropertyValue(cssProp)` — read editor state
  - `switchTab("Tokens" | "Component" | "Instance" | "Element")` — editor tab
  - `setScaleValue(cssProp, value)` / `setScaleDropdown(cssProp, value)` — edit properties
  - `switchSubTab(scope, tab)` / `selectInstanceProp(dim, value)` — component/instance editing
  - `waitForSave()` — waits for "Saved" indicator + HMR settle
- `SourceFileHelper` — tracks files, auto-restores on teardown:
  - `track(path)` — snapshot + return content
  - `read(path)` — read current content
  - `restoreAll()` — restore all tracked files (runs automatically)

**Spec file structure:**

```
tests/e2e/
  shared/fixtures.ts          # SurfacePage + SourceFileHelper
  next-react-tailwind/           # Next.js + React + Tailwind v4 + CVA (comprehensive)
    selection.spec.ts              # element selection, name display
    component-props.spec.ts        # CVA variant prop editing
    component-styles.spec.ts       # component definition style editing
    instance-props.spec.ts         # instance prop overrides
    instance-styles.spec.ts        # instance style overrides
    element-tailwind.spec.ts       # direct Tailwind class editing
    token-color.spec.ts            # color token editing
  vite-react-tailwind/basic.spec.ts       # Vite + React + Tailwind v4 (token + element)
  remix-react-tailwind/basic.spec.ts      # Remix + React + Tailwind v4 (token + element)
  vite-react-tailwind-v3/basic.spec.ts    # Vite + React + Tailwind v3 (token + element)
  vite-react-css/                         # Vite + React + plain CSS + CSS vars
    element-css.spec.ts                   # plain CSS property editing
    token-add-delete.spec.ts              # token CRUD
  astro-css/basic.spec.ts                 # Astro + plain CSS (token + element)
  svelte-css/basic.spec.ts               # SvelteKit + scoped CSS (token + element)
  svelte-tailwind/basic.spec.ts           # SvelteKit + Tailwind v4 (token + element)
```

### Browser verification workflow

When verifying changes in a real browser, **write and run a focused Playwright test** rather than using manual browser automation. This is faster, more reliable, and produces a repeatable artifact.

**Steps:**

1. **Start the demo** in a background task using the appropriate `npm run demo:*` script — this builds the relevant plugin and starts both the demo app and surface:

   | What you're testing | Demo script | Project |
   |---------------------|-------------|---------|
   | Next.js + Tailwind v4 + CVA | `npm run demo:next-react-tailwind` | `next-react-tailwind` |
   | Vite + React + Tailwind v4 | `npm run demo:vite-react-tailwind` | `vite-react-tailwind` |
   | Remix + React + Tailwind v4 | `npm run demo:remix-react-tailwind` | `remix-react-tailwind` |
   | Vite + React + Tailwind v3 | `npm run demo:vite-react-tailwind-v3` | `vite-react-tailwind-v3` |
   | Vite + React + plain CSS | `npm run demo:vite-react-css` | `vite-react-css` |
   | Astro + plain CSS | `npm run demo:astro-css` | `astro-css` |
   | SvelteKit + scoped styles | `npm run demo:svelte-css` | `svelte-css` |
   | SvelteKit + Tailwind v4 | `npm run demo:svelte-tailwind` | `svelte-tailwind` |

2. **Write a spec file** in the appropriate `tests/e2e/<project>/` directory
3. **Run it**: `npx playwright test --project=<name> <path>` (Playwright's `webServer` config will reuse the already-running servers)
4. **Stop the demo** background task when done
5. **Clean up**: If the test was ad-hoc verification, delete the file. If it covers a genuinely new scenario, propose keeping it.

**Example ad-hoc verification test:**

```typescript
import { test, expect } from "../shared/fixtures.js";
import path from "path";

const DEMO_ROOT = path.resolve("demos/vite-react-tailwind");

test("verify padding edit writes correct class", async ({ surfacePage, sourceFile }) => {
  const filePath = path.join(DEMO_ROOT, "src/App.tsx");
  await sourceFile.track(filePath);

  await surfacePage.selectElement("h1");
  await surfacePage.setScaleValue("padding", "2rem");
  await surfacePage.waitForSave();

  const content = await sourceFile.read(filePath);
  expect(content).toContain("p-8");
});
```

## Ports

| Service | Default port |
|---------|-------------|
| Demo apps | 3000 |
| Surface editor | 4400 |
| Surface Vite dev | 4401 |

## Process cleanup

When running dev servers (surface, demo apps), always kill them when done. Stale processes hold ports (especially Vite's HMR WebSocket on port 24679) and cause "Port is already in use" errors.

```bash
# Kill stale surface/node processes on known ports
lsof -ti :4400 -ti :4401 -ti :24679 | xargs kill 2>/dev/null

# Or kill all node processes started from this project
pkill -f "surface"
```

**Important**: If you start a dev server in a background task, make sure to stop it (via `TaskStop` or `kill`) before finishing. Do not leave orphan processes.

## Common tasks

### Type-check everything

```bash
npx tsc --noEmit --project packages/surface/tsconfig.json
```

### Build for production

```bash
npm run build
```

### Run tests

```bash
npm test
```

### Run a demo

Each demo script builds the required plugin, starts the demo app, and launches surface:

```bash
npm run demo:next-react-tailwind      # Next.js + React + Tailwind v4 + CVA
npm run demo:vite-react-tailwind      # Vite + React + Tailwind v4
npm run demo:remix-react-tailwind     # Remix + React + Tailwind v4
npm run demo:vite-react-tailwind-v3   # Vite + React + Tailwind v3
npm run demo:vite-react-css           # Vite + React + plain CSS + CSS vars
npm run demo:astro-css                # Astro + plain CSS + scoped styles
npm run demo:svelte-css               # SvelteKit + scoped CSS + CSS vars
npm run demo:svelte-tailwind          # SvelteKit + Tailwind v4
npm run demo:design-system # Next.js + Design tokens
npm run demo:screenshot    # Next.js + Tailwind v4
```

### Publish

```bash
npm run publish:surface       # publish surface only
npm run publish:vite-plugin   # publish vite-plugin only
npm run publish:next-plugin   # publish next-plugin only
npm run publish:astro-plugin  # publish astro-plugin only
npm run publish:svelte-plugin # publish svelte-plugin only
npm run publish               # publish all packages
```

## Adding a new demo app

1. Create `demos/<name>/` with: `package.json`, `tsconfig.json`, config file, entry points
2. Use a unique port in the `dev` script
3. **Do not** add demos to the workspaces array — they are standalone

## .claude/ reference docs

Additional context documents in `.claude/`:

| File | Purpose |
|------|---------|
| `design-principles.md` | Binding constraints on write reliability, protocol agnosticism, multi-system support. **Read when planning implementation work.** |
| `framework-coverage.md` | Framework × styling test matrix, E2E coverage gaps, and what needs testing. **Read when planning new features or expanding framework/styling support.** |
| `roadmap-styling-framework-expansion.md` | Strategic roadmap for styling system + framework expansion. Tracks done/planned work. |
| `explorer-tree-decisions.md` | Page Explorer (layers panel) design decisions and enhancement ideas. |
| `exploration-history.md` | Historical record of architectural approaches explored and rejected (proxy, EID markers, scoring). Useful context for understanding why the current architecture exists. |

## Common pitfalls

- **ESM imports**: All relative imports must use `.js` extensions, even for `.ts` source files.
- **Stale `.next` cache**: After changing the next-plugin, delete `demos/next-react-tailwind/.next` before restarting.
- **Rebuild plugins**: After changing `surface.tsx` or `loader.ts`, run `npm -w packages/next-plugin run build`.
- **`next/dynamic` with `ssr: false`** does NOT work in Server Components. Use plain imports — `"use client"` on the imported component is sufficient.
