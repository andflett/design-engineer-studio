# CodeCanvas Reference

Technical reference for AI assistants working on the codecanvas package. Covers architecture, key decisions, and UI conventions established during development.

## Architecture

### Overview

CodeCanvas is a hybrid visual editor. The editor UI runs in its own Vite-served React app (port 4400), while the target app runs unmodified at its own dev server (port 3000). The editor embeds the target app in an iframe and communicates via postMessage. There is no proxy layer.

```
Editor UI (Vite SPA, port 4400)
  ├── iframe src="http://localhost:3000"
  │     └── Target app with <CodeCanvas /> component
  │           injected by codecanvas-mount-loader
  │           communicates via postMessage
  └── Write server (Express API routes on same port)
        ├── POST /api/write-element   ← element class changes
        ├── POST /api/tokens          ← CSS custom property edits
        ├── POST /api/component       ← CVA variant class edits
        └── GET  /scan/all            ← unified scan data
```

### How the target app is instrumented

Two things are injected into the target app by `@designtools/next-plugin`:

1. **Babel loader** (`loader.ts`): Adds `data-source="file:line:col"` to every JSX element at compile time. This gives exact source mapping without runtime markers.

2. **Mount loader** (`codecanvas-mount-loader.ts`): Auto-injects `<CodeCanvas />` into the root layout (detected by `<html>` tag). Uses a plain import — `"use client"` on the component is sufficient for Next.js RSC compatibility. Do NOT use `next/dynamic` with `ssr: false` — that's forbidden in Server Components (Next.js 15+).

### postMessage protocol

Defined in `packages/codecanvas/src/shared/protocol.ts`.

**Target app → Editor:**
- `tool:injectedReady` — CodeCanvas component mounted
- `tool:elementSelected` — user clicked an element, sends `SelectedElementData`
- `tool:pathChanged` — iframe navigation

**Editor → Target app:**
- `tool:enterSelectionMode` / `tool:exitSelectionMode`
- `tool:previewInlineStyle` — live preview via inline style
- `tool:revertInlineStyles` — undo preview
- `tool:reselectElement` — re-extract data after source write + HMR
- `tool:setTheme` — toggle dark/light

### Data normalization

The `<CodeCanvas />` component sends flat fields (`sourceFile`, `sourceLine`, `sourceCol`, `instanceSourceFile`, etc.). The `iframe-bridge.ts` normalizes these into nested `SelectedElementData` format before the editor receives them.

## Instance vs Component editing

This is the most important architectural decision in the write system.

### The problem

When you click a `<CardTitle>` on the page, the rendered `<h3>` has `data-source="components/ui/card.tsx:37:4"` — the component **definition**. Editing there changes ALL CardTitle instances. But the Instance tab should only change THIS specific usage.

### The solution

**Selection (`codecanvas.tsx`):** When clicking an element with `data-slot` (component instance), walks up the DOM to find the nearest ancestor whose `data-source` points to a **different file**. That ancestor is in the page file (the usage site). This becomes `instanceSource`. The component name is derived from the `data-slot` (e.g., `"card-title"` → `"CardTitle"`).

**Write API:** Three write paths:

| Write type | Target file | Use case |
|-----------|-------------|----------|
| `replaceClass` / `addClass` | Element's own source file | Plain elements (no `data-slot`) |
| `instanceOverride` | Page file (from `instanceSource`) | Component instances — modifies `<CardTitle className="...">` at the usage site |
| Component tab writes | Component definition file | Edits CVA variant classes, affects all instances |

**Element finding:**
- `findElementAtSource(ast, line, col)` — exact line:col match for plain elements
- `findComponentNearSource(ast, componentName, lineHint, textHint)` — finds `<ComponentName>` near a line in the page file, uses text content for disambiguation when multiple instances exist

### Why not EID markers

The legacy studio used `data-studio-eid` attributes written into source files to track elements across edits. CodeCanvas avoids this — `data-source` coordinates plus component name + text hint is sufficient for element identification without mutating user files.

## Editor UI

### Three-tab structure

The editor panel always renders, regardless of selection state. It has three tabs:

1. **Token** (default on load) — edit design tokens globally. Shows color swatches with OKLCH editor, radius inputs, spacing inputs. Always functional even with no selection.

2. **Component** (only for elements with `data-slot`) — edit CVA variant definitions. Changes affect all instances of the component.

3. **Instance / Element** — edit this specific element's styles. For components, writes to the usage site. For plain elements, writes to the element's source.

When no element is selected, Component and Instance tabs show "Select an element..." empty state. The Token tab works regardless.

### UI conventions

- **Dark theme only** for the editor chrome. CSS variables prefixed `--studio-*` define the palette.
- **Font sizes**: Section headers 9px uppercase, property labels 10px, values 11px monospace.
- **Info boxes** (`.studio-tab-explainer`): Subtle rounded boxes with dim text explaining what each tab does. Background `--studio-input-bg`, border `--studio-border-subtle`, text `--studio-text-dimmed`.
- **Scrub inputs**: Icon + text input with drag-to-scrub on the icon for numeric values. The icon only shows the `ew-resize` cursor and drag behavior when the value is actually numeric (`.no-scrub` class disables it for non-numeric values like `auto`, `none`, `mixed`).
- **Scale inputs**: Composite control with a dropdown for scale values (Tailwind spacing/sizing scale) and an arbitrary text input, toggled by a button.
- **Segmented controls** (`.studio-segmented`): Used for tab switching and layout property toggles (flex-direction, align-items, etc.).
- **Color controls**: Swatch + value display, opens a popover with token picker or OKLCH editor.
- **Section headers** (`.studio-section-hdr`): Collapsible sections with chevron, uppercase label, count badge.
- **Tooltips**: Use `@radix-ui/react-tooltip` via the `<Tooltip>` wrapper in `components/tooltip.tsx`. Styled with `.studio-tooltip` CSS class. Dark background, subtle border, small font. The app is wrapped in `<TooltipProvider>` in `app.tsx`. Do NOT use HTML `title` attributes — always use the `<Tooltip>` component.

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

## Server-side scan

`/scan/all` returns unified `ScanData`:

```typescript
interface ScanData {
  framework: { name: string; version: string; };
  tokens: {
    tokens: any[];           // All CSS custom properties
    groups: Record<string, any[]>;  // Grouped by prefix
    cssFilePath: string;     // Path to the main CSS file
  };
  components: {
    components: any[];       // CVA components with data-slot
  };
}
```

The scanner detects the framework (`detect-framework.ts`), scans CSS for tokens (`scan-tokens.ts`), and scans `components/ui` for CVA components with `data-slot` attributes (`scan-components.ts`).

## Write system

All writes use recast (AST-based) to preserve formatting. Key helpers in `ast-helpers.ts`:

- `replaceClassInAttr` — handles string literals, `cn()` calls, template literals, ternaries
- `appendClassToAttr` — appends to first string argument of `cn()` or string literal
- `addClassNameAttr` — adds `className="..."` when none exists
- `replaceClassInExpression` — recursively walks expression trees (conditionals, logical, arrays)

The `computedToTailwindClass` mapping in `tailwind-map.ts` converts CSS property/value pairs to Tailwind utility classes.

## File structure

```
packages/codecanvas/
  src/
    cli.ts                          CLI entry point
    server/
      index.ts                      Express server + Vite middleware
      api/
        write-element.ts            Element + instance class writes
        write-tokens.ts             CSS custom property writes
        write-component.ts          CVA variant class writes
      lib/
        ast-helpers.ts              Recast-based JSX manipulation
        find-element.ts             Element + component finder
        safe-path.ts                Path validation
        scanner.ts                  Scan router (/scan/*)
        scan-tokens.ts              CSS token scanner
        scan-components.ts          CVA component scanner
        detect-framework.ts         Framework detection
    client/
      app.tsx                       Main React app, ScanData type
      styles.css                    All editor CSS (dark theme)
      components/
        tool-chrome.tsx             Main layout (toolbar + iframe + panel)
        editor-panel.tsx            Three-tab editor (Token|Component|Instance)
        computed-property-panel.tsx  Figma-style property controls
        token-editor.tsx            Token editing (colors, radius, spacing)
        property-panel.tsx          Class-based property editing (Component tab)
        color-popover.tsx           Color picker + OKLCH editor popovers
        token-overview.tsx          (legacy, no longer used as default view)
      lib/
        iframe-bridge.ts            postMessage normalization
        use-postmessage.ts          React hook for postMessage
        computed-styles.ts          Computed style → unified properties
    shared/
      protocol.ts                   postMessage type definitions
      tailwind-map.ts               CSS → Tailwind class mapping
      tailwind-parser.ts            Tailwind class parser
```

## Running

```bash
# Terminal 1: demo app
cd demos/studio-app && npm run dev

# Terminal 2: codecanvas
npm run codecanvas
```

## Common pitfalls

- **`next/dynamic` with `ssr: false`** does NOT work in Server Components. Use plain imports — `"use client"` on the imported component is sufficient.
- **Stale `.next` cache**: After changing the next-plugin, delete `demos/studio-app/.next` before restarting.
- **Rebuild next-plugin**: After changing `codecanvas.tsx` or `loader.ts`, run `npm -w packages/next-plugin run build`.
- **ESM imports**: All relative imports must use `.js` extensions, even for `.ts` source files.
- **Don't share code with legacy packages at import level**: Copy what you need from `core`/`studio` into codecanvas's own source tree.
