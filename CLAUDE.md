# CLAUDE.md

Reference for AI assistants working on this codebase. Read this before making changes.

## What this project is

Visual editing CLI tools for web applications — edit styles, tokens, and components visually with changes written back to source files.

## Packages

| Package | Notes |
|---------|-------|
| `@designtools/surface` | Hybrid architecture — selection in target app, editor UI separate |
| `@designtools/next-plugin` | Config wrapper for `data-source` attributes + `<Surface />` mount |

## Monorepo layout

```
packages/
  surface/      Hybrid visual editor
  next-plugin/  Next.js config wrapper + data-source Babel transform
demos/
  studio-app/           Tailwind CSS v4 demo (Next.js)
  bootstrap-app/        Bootstrap 5 demo
  w3c-tokens-app/       W3C Design Tokens demo
  css-variables-app/    Plain CSS variables demo
  tailwind-shadows-app/ Tailwind shadows demo
```

- `packages/next-plugin` and `packages/surface` are npm workspaces.
- `demos/*` are standalone Next.js apps (not workspaces).

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
  |               mounted by withDesigntools()
  |               communicates via postMessage
  |
  +-- Write server (API routes on same port)
```

- No proxy — iframe loads the target app directly at its dev server URL
- `withDesigntools()` (from `@designtools/next-plugin`) injects `data-source` attributes at compile time and mounts the `<Surface />` selection component
- `data-source="file:line:col"` on every JSX element provides exact source mapping
- Editor UI and write server run on port 4400
- postMessage is the only communication channel between editor and target app

### Protocol

Messages use CSS property/value pairs as the universal primitive, with optional `hints` to preserve styling-system semantics (Tailwind classes, design tokens, etc.).

**Target app -> Editor**: `tool:injectedReady`, `tool:elementSelected`, `tool:pathChanged`
**Editor -> Target app**: `tool:enterSelectionMode`, `tool:exitSelectionMode`, `tool:previewStyle`, `tool:revertPreview`

### Write adapters

Styling system adapters translate CSS property/value changes into the native format:
- Tailwind: CSS value -> nearest utility class from resolved theme
- CSS variables: CSS value -> variable assignment in stylesheet
- Plain CSS: CSS value -> direct property in stylesheet or inline

Framework plugins and styling-system adapters are orthogonal. Framework = source mapping + selection. Styling system = how changes are written.

### Key files

| File | Purpose |
|------|---------|
| `packages/surface/src/cli.ts` | CLI entry point |
| `packages/surface/src/server/index.ts` | Express server + write API + Vite middleware |
| `packages/surface/src/client/` | Editor React SPA |
| `packages/next-plugin/src/index.ts` | withDesigntools() config wrapper |
| `packages/next-plugin/src/loader.ts` | Babel transform for data-source attributes |

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

### Run surface in dev

```bash
# Terminal 1: demo app
cd demos/studio-app && npm run dev

# Terminal 2: surface
npm run surface
```

### Publish

```bash
npm run publish:surface       # publish surface only
npm run publish               # publish all packages
```

## Adding a new demo app

1. Create `demos/<name>/` with: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`
2. Use a unique port in the `dev` script: `next dev --port <N>`
3. **Do not** add demos to the workspaces array — they are standalone
