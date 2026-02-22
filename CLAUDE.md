# CLAUDE.md

Reference for AI assistants working on this codebase. Read this before making changes.

## What this project is

Visual editing CLI tools for web applications — edit styles, tokens, and components visually with changes written back to source files.

The project is transitioning from a proxy-based architecture (studio/shadows) to a hybrid architecture (codecanvas). See `.claude/studio-hybrid-architecture-plan.md` for the full plan and `.claude/exploration-history.md` for how we got there.

## Active vs legacy packages

| Package | Status | Notes |
|---------|--------|-------|
| `@designtools/codecanvas` | **Active development** | Hybrid architecture — selection in target app, editor UI separate |
| `@designtools/next-plugin` | **Active development** | Config wrapper for `data-source` attributes + `<Studio />` mount |
| `@designtools/core` | Legacy | Shared utilities — cherry-pick into codecanvas as needed, don't add shared deps |
| `@designtools/studio` | Legacy | Proxy-based editor — keep buildable but don't extend |
| `@designtools/shadows` | Legacy | Proxy-based shadow editor — keep buildable but don't extend |

**Important**: codecanvas does NOT share code with legacy packages at the import level. When codecanvas needs something from core/studio, copy it into codecanvas's own source tree. This keeps codecanvas lean and avoids coupling to legacy code.

## Monorepo layout

```
packages/
  codecanvas/   Hybrid visual editor (active development)
  next-plugin/  Next.js config wrapper + data-source Babel transform
  core/         Shared scanner, server, client, CLI (legacy)
  studio/       Main editing CLI — tokens, components, instances (legacy)
  shadows/      Shadow-specific editing CLI (legacy)
demos/
  studio-app/           Tailwind CSS v4 demo (Next.js)
  bootstrap-app/        Bootstrap 5 demo
  w3c-tokens-app/       W3C Design Tokens demo
  css-variables-app/    Plain CSS variables demo
  tailwind-shadows-app/ Tailwind shadows demo
```

- `packages/core`, `packages/next-plugin`, `packages/studio`, `packages/shadows`, `packages/codecanvas` are npm workspaces.
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
| Package | `@designtools/<name>` | `@designtools/codecanvas` |
| CLI binary | `designtools-<name>` | `designtools-codecanvas` |
| Scanner files | `scan-<noun>.ts` | `scan-tokens.ts` |
| Detector files | `detect-<noun>.ts` | `detect-styling.ts` |
| API routers | `write-<noun>.ts` | `write-element.ts` |
| Client components | `<noun>-<role>.tsx` | `editor-panel.tsx` |

### Styling system types

The `StylingSystem.type` union drives framework-specific behavior:

```typescript
type: "tailwind-v4" | "tailwind-v3" | "bootstrap" | "css-variables" | "plain-css" | "unknown"
```

## CodeCanvas architecture (active)

### How it works

```
Editor UI (Vite, 4400)
  |-- <iframe src="http://localhost:3000" />   <- direct, no proxy
  |       |
  |       +-- Target app with <Studio /> component
  |               mounted by withDesigntools()
  |               communicates via postMessage
  |
  +-- Write server (API routes on same port)
```

- No proxy — iframe loads the target app directly at its dev server URL
- `withDesigntools()` (from `@designtools/next-plugin`) injects `data-source` attributes at compile time and mounts the `<Studio />` selection component
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

### Key files (codecanvas)

| File | Purpose |
|------|---------|
| `packages/codecanvas/src/cli.ts` | CLI entry point |
| `packages/codecanvas/src/server/index.ts` | Express server + write API + Vite middleware |
| `packages/codecanvas/src/client/` | Editor React SPA |

## Legacy architecture (studio/shadows)

The legacy packages use a proxy-based architecture. Keep them buildable but don't extend them.

### Server architecture (legacy)

```
CLI (bootstrap) -> Server (createToolServer) -> Express app
  |-- GET  /proxy/*        Proxies target app, injects script
  |-- GET  /tool-inject.js  Compiled injection script
  |-- GET  /scan/*          Cached scanner results
  |-- POST /api/<noun>      Write changes to source files
  +-- Vite middleware        Serves client SPA
```

### Key files (legacy)

| File | What it does |
|------|-------------|
| `packages/core/src/server/create-server.ts` | Proxy middleware, HTML injection, HMR pass-through |
| `packages/core/src/inject/selection.ts` | Selection overlays, click handling, postMessage |
| `packages/core/src/client/lib/iframe-bridge.ts` | postMessage helpers |
| `packages/core/src/scanner/detect-styling.ts` | Detect Tailwind/Bootstrap/CSS variables |
| `packages/core/src/scanner/scan-tokens.ts` | Parse CSS custom properties into tokens |
| `packages/studio/src/server/api/write-element.ts` | AST-based JSX writes, EID markers |
| `packages/studio/src/server/api/write-tokens.ts` | Regex-based CSS token writes |
| `packages/next-plugin/src/index.ts` | withDesigntools() config wrapper |
| `packages/next-plugin/src/loader.ts` | Babel transform for data-source attributes |

## Ports

| Service | Default port |
|---------|-------------|
| Demo apps | 3000 |
| CodeCanvas editor | 4400 |
| CodeCanvas Vite dev | 4401 |
| Legacy Studio | 4400 |
| Legacy Shadows | 4410 |

## Process cleanup

When running dev servers (codecanvas, demo apps), always kill them when done. Stale processes hold ports (especially Vite's HMR WebSocket on port 24679) and cause "Port is already in use" errors.

```bash
# Kill stale codecanvas/node processes on known ports
lsof -ti :4400 -ti :4401 -ti :24679 | xargs kill 2>/dev/null

# Or kill all node processes started from this project
pkill -f "designtools-codecanvas"
```

**Important**: If you start a dev server in a background task, make sure to stop it (via `TaskStop` or `kill`) before finishing. Do not leave orphan processes.

## Common tasks

### Type-check everything

```bash
npx tsc --noEmit --project packages/codecanvas/tsconfig.json
npx tsc --noEmit --project packages/core/tsconfig.json
npx tsc --noEmit --project packages/studio/tsconfig.json
npx tsc --noEmit --project packages/shadows/tsconfig.json
```

### Build for production

```bash
npm run build
```

### Run codecanvas in dev

```bash
# Terminal 1: demo app
cd demos/studio-app && npm run dev

# Terminal 2: codecanvas
npm run dev:codecanvas
```

### Run legacy tools

```bash
npm run dev:studio
npm run dev:shadows
```

### Publish

```bash
npm run publish:codecanvas    # publish codecanvas only
npm run publish               # publish all packages
```

## Adding a new demo app

1. Create `demos/<name>/` with: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`
2. Use a unique port in the `dev` script: `next dev --port <N>`
3. **Do not** add demos to the workspaces array — they are standalone
