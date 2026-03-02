# @designtools/surface

Visual editing for production frontends. @designtools/surface is a multi-framework design tool that understands your design system, sits on top of your production code, and writes changes back to source.

[Read the write-up](https://www.flett.cc/projects/design-engineer-studio)

## Packages

| Package | Description |
|---------|-------------|
| [`@designtools/surface`](packages/surface) | Hybrid visual editor — selection overlays in the target app, editor UI in a separate Vite app |
| [`@designtools/next-plugin`](packages/next-plugin) | Next.js config wrapper — injects `data-source` attributes and mounts `<Surface />` |
| [`@designtools/vite-plugin`](packages/vite-plugin) | Vite plugin — injects `data-source` attributes and auto-mounts `<Surface />` |
| [`@designtools/astro-plugin`](packages/astro-plugin) | Astro integration — `.astro` template transform and auto-mounts `<Surface />` |

## Architecture

Surface uses a hybrid architecture where the **selection component** (`<Surface />`) lives inside the target app via the `withDesigntools()` config wrapper, while the **editor UI** remains a separate Vite-served React app. The iframe loads the target app directly (no proxy), and all communication happens via `postMessage`.

```
Editor UI (Vite, 4400)
  |-- <iframe src="http://localhost:3000" />   <- direct, no proxy
  |       |
  |       +-- Target app with <Surface /> component
  |               mounted by withDesigntools() or vite-plugin
  |               communicates via postMessage
  |
  +-- Write server (API routes on same port)
```

Key design decisions:
- `data-source` attributes (injected at compile time) provide exact file:line:col mapping for every element
- CSS property/value pairs as the universal editing primitive, with styling-system hints to preserve tokens
- Framework plugins (Next.js, Vite) and styling-system adapters (Tailwind, CSS variables, etc.) are orthogonal
- Tailwind theme resolution — custom scales from v3 configs and v4 `@theme` blocks are auto-detected and used for class suggestions

### Support Matrix

#### Frameworks

| Framework | Plugin | Status | Notes |
|-----------|--------|--------|-------|
| Next.js | `@designtools/next-plugin` | Stable | App Router. Babel transform for `data-source` attributes |
| Vite + React | `@designtools/vite-plugin` | Stable | Any Vite + React project |
| Astro | `@designtools/astro-plugin` | Stable | `.astro` templates + React/Preact islands |
| Remix | `@designtools/vite-plugin` | Beta | Vite-based — use the Vite plugin |
| Vue / Nuxt | — | Planned | |
| Svelte / SvelteKit | — | Planned | |

#### Styling Systems

| System | Detection | Write format | Status |
|--------|-----------|-------------|--------|
| Tailwind CSS v4 | `tailwindcss ^4` in package.json | Utility classes via resolved theme | Stable |
| Tailwind CSS v3 | `tailwindcss ^3` + config file | Utility classes via theme config | Stable |
| CSS Variables | `--*` custom properties in stylesheets | Direct property writes in CSS files | Stable |
| Plain CSS | `.css` files with class selectors | Direct property writes in CSS files | Stable |
| CSS Modules | `.module.css` imports in JSX | Property writes in module CSS files | Stable |
| Sass / SCSS | — | — | Planned |

## Demo apps

| Demo | Styling | Port |
|------|---------|------|
| **Studio** (`demos/studio-app`) | Tailwind CSS v4, CVA, OKLch tokens | 3000 |
| **Bootstrap** (`demos/bootstrap-app`) | Bootstrap 5 Sass + CSS custom properties | 3001 |
| **W3C Tokens** (`demos/w3c-tokens-app`) | W3C Design Tokens Format (DTCG) | 3002 |
| **CSS Variables** (`demos/css-variables-app`) | Plain CSS custom properties | 3003 |
| **Tailwind Shadows** (`demos/tailwind-shadows-app`) | Tailwind CSS v4 `@theme` | 3004 |
| **Vite** (`demos/vite-app`) | Tailwind CSS v4 (Vite + React) | 3000 |
| **Tailwind v3** (`demos/tailwind-v3-app`) | Tailwind CSS v3 custom theme | 3000 |
| **CSS** (`demos/css-app`) | Plain CSS + CSS Variables | 3000 |
| **CSS Modules** (`demos/css-modules-app`) | CSS Modules (.module.css) | 3000 |

### Prerequisites

- Node.js 18+

### Setup

```bash
git clone https://github.com/andflett/designtools.git
cd designtools

# Install monorepo dependencies and build
npm install
npm run build
```

Then install the demo you want to try:

```bash
cd demos/studio-app && npm install && cd ../..
```

### Run

```bash
# Terminal 1 — start a demo app
cd demos/studio-app && npm run dev

# Terminal 2 — start surface
npm run surface
```

The editor opens at [http://localhost:4400](http://localhost:4400) with the target app loaded in an iframe.

### Framework setup

#### Next.js

```bash
npm install -D @designtools/next-plugin
```

```ts
// next.config.ts
import { withDesigntools } from "@designtools/next-plugin";
export default withDesigntools({ /* your config */ });
```

#### Vite + React (including Remix)

```bash
npm install -D @designtools/vite-plugin
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import designtools from "@designtools/vite-plugin";

export default defineConfig({
  plugins: [designtools(), react()],
});
```

#### Astro

```bash
npm install -D @designtools/astro-plugin
```

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import designtools from "@designtools/astro-plugin";

export default defineConfig({
  integrations: [react(), designtools()],
});
```

## Supported styling systems

| System | Detection | Write format |
|--------|-----------|-------------|
| Tailwind CSS v4 | `tailwindcss ^4` in package.json | Utility class replacement via resolved theme |
| Tailwind CSS v3 | `tailwindcss ^3` + config file | Utility class replacement |
| CSS Variables | `--*` custom properties in stylesheets | Direct property writes in CSS files |
| Plain CSS | `.css` files with class selectors | Direct property writes in CSS files |
| CSS Modules | `.module.css` imports in JSX | Property writes in module CSS files |

## Project structure

```
designtools/
├── packages/
│   ├── surface/       Hybrid visual editor
│   ├── next-plugin/   Next.js config wrapper + data-source transform
│   ├── vite-plugin/   Vite plugin + data-source transform
│   └── astro-plugin/  Astro integration + .astro template transform
├── demos/
│   ├── studio-app/              Tailwind CSS v4 + CVA demo
│   ├── bootstrap-app/           Bootstrap 5 demo
│   ├── w3c-tokens-app/          W3C Design Tokens demo
│   ├── css-variables-app/       Plain CSS variables demo
│   ├── tailwind-shadows-app/    Tailwind CSS v4 shadows demo
│   ├── vite-app/                Tailwind CSS v4 (Vite + React)
│   ├── tailwind-v3-app/         Tailwind CSS v3 custom theme
│   ├── css-app/                 Plain CSS + CSS Variables
│   └── css-modules-app/         CSS Modules (.module.css)
```

## Testing with a local project

To test local changes to `surface` and `next-plugin` against any Next.js project on your machine:

### 1. Build the packages

```bash
cd /path/to/designtools
npm run build
```

### 2. Link the Next.js plugin

The `next-plugin` lives in your target project's `node_modules`, so use `npm link` to point it at your local build:

```bash
# Register the package globally (one-time)
cd packages/next-plugin && npm link

# In your target project
cd /path/to/your-app
npm link @designtools/next-plugin
```

### Vite / Astro projects

```bash
# Register the vite-plugin globally (one-time)
cd packages/vite-plugin && npm link

# In your target project
cd /path/to/your-app
npm link @designtools/vite-plugin
```

For Astro projects, link `@designtools/astro-plugin` instead.

### 3. Run surface from source

Since surface is a standalone CLI (not a dependency), run it directly from the build output instead of linking:

```bash
# Terminal 1 — start your app
cd /path/to/your-app && npm run dev

# Terminal 2 — run surface from your local build
cd /path/to/your-app && node /path/to/designtools/packages/surface/dist/cli.js
```

### After making changes

Rebuild and the link picks up changes automatically:

```bash
cd /path/to/designtools
npm run build --workspace=packages/next-plugin
npm run build --workspace=packages/surface
```

Then restart the dev server and surface CLI.

### Notes

- `npm install` in the target project removes links. Re-run `npm link @designtools/next-plugin` after installing.
- To unlink: `cd /path/to/your-app && npm unlink @designtools/next-plugin`

## License

CC BY-NC 4.0 — free to use and modify for non-commercial purposes with attribution. See [LICENSE](LICENSE) for details.
