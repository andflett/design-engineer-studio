# CLAUDE.md

Reference for AI assistants working on this codebase. Read this before making changes.

## What this project is

Visual editing CLI tools for design tokens, component variants, and shadows. The tools proxy a target app inside an iframe, inject a selection script, and let you visually edit tokens/classes/shadows — writing changes back to source files.

## Monorepo layout

```
packages/
  core/       Shared scanner, server, client, CLI, and inject infrastructure
  studio/     Main editing CLI (tokens, components, instances)
  shadows/    Shadow-specific editing CLI
  demo/       Tailwind CSS v4 demo app (Next.js)
demos/
  bootstrap-app/      Bootstrap 5 demo
  w3c-tokens-app/     W3C Design Tokens demo
  css-variables-app/  Plain CSS variables demo
```

- `packages/core`, `packages/studio`, `packages/shadows` are npm workspaces.
- `packages/demo` and `demos/*` are standalone Next.js apps (not workspaces).

## Key conventions

### Module system

- Everything is ESM (`"type": "module"` in root package.json).
- **All relative imports must use `.js` extensions**, even for `.ts` source files. This is required by Node ESM resolution. Example: `import { foo } from "./bar.js"`.

### TypeScript

- `tsconfig.base.json` at root: ES2022, ESNext modules, bundler resolution, react-jsx, strict.
- Each package extends it: `"extends": "../../tsconfig.base.json"`.
- Cross-package references use path aliases: `@designtools/core/*` → `../core/src/*`.
- Type-check with: `npx tsc --noEmit --project packages/<name>/tsconfig.json`.

### Package exports (core)

Core exposes subpath exports — import from specific paths, not the root:

```typescript
import { bootstrap } from "@designtools/core/cli";
import { createToolServer } from "@designtools/core/server";
import { detectFramework } from "@designtools/core/scanner";
import { detectStylingSystem } from "@designtools/core/scanner/detect-styling";
import { parseBlock } from "@designtools/core/scanner/scan-tokens";
import { ToolChrome } from "@designtools/core/client/components/tool-chrome";
```

The exports map in `packages/core/package.json` uses wildcards: `"./scanner/*": "./src/scanner/*.ts"`.

### Build system

- **Client (React SPA)**: Vite + React + Tailwind via `@tailwindcss/vite`.
- **CLI (Node server)**: tsup, ESM format, bundles `@designtools/core` inline (noExternal), externalizes everything else.
- Both build via: `npm run build` (runs `vite build src/client && tsup`).
- Output goes to `dist/cli.js` (with shebang) and `dist/client/`.
- For dev: `npm -w packages/studio run dev` uses tsx to run CLI directly.

### Naming patterns

| Kind | Convention | Example |
|------|-----------|---------|
| Package | `@designtools/<name>` | `@designtools/shadows` |
| CLI binary | `designtools-<name>` | `designtools-shadows` |
| Scanner files | `scan-<noun>.ts` | `scan-shadows.ts` |
| Detector files | `detect-<noun>.ts` | `detect-styling.ts` |
| API routers | `write-<noun>.ts` | `write-shadows.ts` |
| Preset files | `presets/<framework>.ts` | `presets/bootstrap.ts` |
| Client components | `<noun>-<role>.tsx` | `shadow-controls.tsx` |

### Styling system types

The `StylingSystem.type` union drives framework-specific behavior:

```typescript
type: "tailwind-v4" | "tailwind-v3" | "bootstrap" | "css-variables" | "plain-css" | "unknown"
```

When adding a new framework, update:
1. `packages/core/src/scanner/detect-styling.ts` — add detection logic and type
2. `packages/shadows/src/server/scanner/presets/<framework>.ts` — add preset values
3. `packages/shadows/src/server/scanner/scan-shadows.ts` — wire into scan pipeline
4. `packages/shadows/src/server/api/write-shadows.ts` — add write support
5. `packages/shadows/src/client/components/shadow-list.tsx` — handle save routing

## Architecture patterns

### Adding a new tool package

1. Create `packages/<name>/` with:
   - `package.json` (private, bin: `designtools-<name>`, same scripts as shadows)
   - `tsconfig.json` extending `../../tsconfig.base.json`
   - `vite.config.ts` and `tsup.config.ts` (copy from shadows, change ports)
2. Create `src/cli.ts` — call `bootstrap()` from `@designtools/core/cli`
3. Create `src/server/index.ts` — call `createToolServer()`, mount API routers
4. Create `src/server/scanner/` — tool-specific scan logic
5. Create `src/server/api/` — Express routers for reading/writing
6. Create `src/client/` — React SPA with `ToolChrome` from core
7. Add to root `package.json` workspaces array
8. Add build/dev scripts to root package.json

### Server architecture

Every tool follows the same pattern:

```
CLI (bootstrap) → Server (createToolServer) → Express app
  ├── GET  /proxy/*        Proxies target app, injects script
  ├── GET  /tool-inject.js  Compiled injection script (esbuild)
  ├── GET  /scan/*          Cached scanner results
  ├── POST /scan/rescan     Force re-scan
  ├── POST /api/<noun>      Write changes to source files
  └── Vite middleware        Serves client SPA
```

### Scanner pipeline

```
detectFramework(projectRoot)
  → FrameworkInfo { name, appDir, componentDir, cssFiles }

detectStylingSystem(projectRoot, framework)
  → StylingSystem { type, cssFiles, scssFiles, hasDarkMode }

// Tool-specific scans run in parallel:
Promise.all([
  scanTokens(projectRoot, framework),     // Core
  scanToolSpecific(projectRoot, ...),     // Tool
  scanRoutes(projectRoot, framework),     // Core
])
```

Scan results are cached in memory. `POST /scan/rescan` re-runs the full pipeline.

### Iframe communication

The inject script and tool client communicate via `window.postMessage`:

**Tool → Iframe**: `tool:enterSelectionMode`, `tool:setProperty`, `tool:previewClass`, `tool:setTheme`
**Iframe → Tool**: `tool:injectedReady`, `tool:elementSelected`

Use `sendToIframe()` and `onIframeMessage()` from `@designtools/core/client/lib/iframe-bridge`.

### API write pattern

All write endpoints follow this shape:

```typescript
router.post("/", async (req, res) => {
  try {
    const { filePath, ...rest } = req.body;
    const fullPath = path.join(projectRoot, filePath);
    let content = await fs.readFile(fullPath, "utf-8");
    content = transformContent(content, ...rest);
    await fs.writeFile(fullPath, content, "utf-8");
    res.json({ ok: true, ...rest });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

File modifications are regex-based find-and-replace on the source text. No AST parsing.

### Client UI patterns

- React 19, hooks only (no class components)
- Icons: `@radix-ui/react-icons`
- Styling: Tailwind v4 utility classes + inline `style` for theme variables
- Theme variables: `--studio-surface`, `--studio-border`, `--studio-text`, `--studio-text-dimmed`, `--studio-accent`, etc.
- Layout: `ToolChrome` wraps everything (toolbar + viewport iframe + editor panel)

## Adding a new demo app

1. Create `demos/<name>/` with: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`
2. Use a unique port in the `dev` script: `next dev --port <N>`
3. Add `"demo:<name>": "cd demos/<name> && npm run dev"` to root package.json scripts
4. **Do not** add demos to the workspaces array — they are standalone

## Ports

| Service | Default port |
|---------|-------------|
| Demos | 3000 |
| Studio tool | 4400 |
| Studio Vite dev | 4401 |
| Shadows tool | 4410 |
| Shadows Vite dev | 4411 |

## Common tasks

### Type-check everything

```bash
npx tsc --noEmit --project packages/core/tsconfig.json
npx tsc --noEmit --project packages/studio/tsconfig.json
npx tsc --noEmit --project packages/shadows/tsconfig.json
```

### Build for production

```bash
npm run build
```

### Run a demo with a tool

Terminal 1: `npm run demo` (or `npm run demo:bootstrap`, etc.)
Terminal 2: `npx designtools-studio` (or the tool of choice)

### Add a framework preset (shadows)

1. Create `packages/shadows/src/server/scanner/presets/<framework>.ts`
2. Export a `<FRAMEWORK>_SHADOW_PRESETS: ShadowPreset[]` array
3. Optionally export scanner functions for override detection
4. Wire into `scan-shadows.ts` by adding an `else if (styling.type === "<framework>")` branch
5. Handle saves in `write-shadows.ts` if the framework uses a non-CSS format

### Add a new scan dimension

1. Add scanner in `packages/core/src/scanner/scan-<noun>.ts` (if shared) or `packages/<tool>/src/server/scanner/`
2. Add types to the scan result interface in the tool's `scanner/index.ts`
3. Add to the `Promise.all` in `runScan()`
4. Expose via `GET /scan/<noun>` endpoint
5. Consume in the client via fetch
