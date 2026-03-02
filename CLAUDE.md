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

## Monorepo layout

```
packages/
  surface/      Hybrid visual editor (CLI + server + React SPA)
  next-plugin/  Next.js config wrapper + data-source Babel transform
  vite-plugin/  Vite plugin for source annotation + Surface auto-mount
demos/
  studio-app/           Tailwind CSS v4 demo (Next.js)
  vite-app/             Tailwind CSS v4 demo (Vite + React)
  bootstrap-app/        Bootstrap 5 demo
  w3c-tokens-app/       W3C Design Tokens demo
  css-variables-app/    Plain CSS variables demo
  tailwind-shadows-app/ Tailwind shadows demo
tests/
  fixtures/             Test fixture projects (for integration tests)
  write-element.test.ts Server integration tests (supertest)
```

- `packages/next-plugin`, `packages/surface`, and `packages/vite-plugin` are npm workspaces.
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
- `data-source="file:line:col"` on every JSX element provides exact source mapping
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
| **Unit** | Pure functions with no I/O | `tailwind-parser.test.ts`, `tailwind-map.test.ts`, `oklch.test.ts`, `safe-path.test.ts`, `write-css-rule.test.ts`, `mount-transform.test.ts` |
| **AST fixtures** | Parse → transform → verify source output | `ast-helpers.test.ts`, `find-element.test.ts` |
| **Server integration** | supertest against Express router + fixture project | `tests/write-element.test.ts` — covers replaceClass, addClass, cssProperty (CSS modules, stylesheets, inline fallback), path traversal |

Test fixtures live in `tests/fixtures/project-a/` — JSX files, CSS modules, and stylesheets that the integration tests read/write (restored after each test).

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

### Run surface in dev (Next.js)

```bash
# Terminal 1: demo app
cd demos/studio-app && npm run dev

# Terminal 2: surface
npm run surface
```

### Run surface in dev (Vite)

```bash
# Terminal 1: demo app
cd demos/vite-app && npm run dev

# Terminal 2: surface
npm run surface:vite
```

### Publish

```bash
npm run publish:surface       # publish surface only
npm run publish:vite-plugin   # publish vite-plugin only
npm run publish:next-plugin   # publish next-plugin only
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
| `roadmap-styling-framework-expansion.md` | Strategic roadmap for styling system + framework expansion. Tracks done/planned work. |
| `explorer-tree-decisions.md` | Page Explorer (layers panel) design decisions and enhancement ideas. |
| `exploration-history.md` | Historical record of architectural approaches explored and rejected (proxy, EID markers, scoring). Useful context for understanding why the current architecture exists. |

## Common pitfalls

- **ESM imports**: All relative imports must use `.js` extensions, even for `.ts` source files.
- **Stale `.next` cache**: After changing the next-plugin, delete `demos/studio-app/.next` before restarting.
- **Rebuild plugins**: After changing `surface.tsx` or `loader.ts`, run `npm -w packages/next-plugin run build`.
- **`next/dynamic` with `ssr: false`** does NOT work in Server Components. Use plain imports — `"use client"` on the imported component is sufficient.
