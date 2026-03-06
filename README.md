# @designtools/surface

A multi-framework design tool that understands your design system, sits on top of your production code, and writes changes back to source.

[Read the write-up](https://www.flett.cc/projects/design-engineer-studio) · [Website](https://designsurface.dev)

> **Active development** — things will break, APIs will change. If you like living on the edge, the source is open and the packages are published.

---

## Getting started

Pick your framework and follow the setup below. Each one takes under a minute.

- [Next.js](#nextjs)
- [Vite + React](#vite--react)
- [Remix](#remix)
- [Astro](#astro)
- [SvelteKit](#sveltekit)

### Prerequisites

- Node.js 18+
- A running dev server for your app

---

### Next.js

#### Install the plugin

```bash
npm install -D @designtools/next-plugin
```

#### Wrap your config — this adds source mapping to every element

```ts
// next.config.ts
import { withDesigntools } from "@designtools/next-plugin";

export default withDesigntools({
  /* your existing config */
});
```

#### Run both servers — your app and the visual editor side by side

```bash
# Terminal 1 — start your app
npm run dev

# Terminal 2 — start surface
npx @designtools/surface
```

> **Demo:** `demos/studio-app` — Tailwind CSS v4 + CVA components

---

### Vite + React

#### Install the plugin

```bash
npm install -D @designtools/vite-plugin
```

#### Add to your Vite config — must come before the React plugin

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import designtools from "@designtools/vite-plugin";

export default defineConfig({
  plugins: [designtools(), react()],
});
```

#### Run both servers — your app and the visual editor side by side

```bash
# Terminal 1 — start your app
npm run dev

# Terminal 2 — start surface
npx @designtools/surface
```

> **Demo:** `demos/vite-app` — Tailwind CSS v4

---

### Remix

Remix uses Vite under the hood, so the setup is the same as Vite + React.

#### Install the plugin

```bash
npm install -D @designtools/vite-plugin
```

#### Add to your Vite config — must come before the React Router plugin

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import designtools from "@designtools/vite-plugin";

export default defineConfig({
  plugins: [designtools(), reactRouter()],
});
```

#### Start the editor — your app's dev server should already be running

```bash
npx @designtools/surface
```

> **Demo:** `demos/remix-app`

---

### Astro

#### Install the plugin

```bash
npm install -D @designtools/astro-plugin
```

#### Add the integration — works alongside other Astro integrations

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import designtools from "@designtools/astro-plugin";

export default defineConfig({
  integrations: [react(), designtools()],
});
```

#### Start the editor — your app's dev server should already be running

```bash
npx @designtools/surface
```

> **Demo:** `demos/astro-app` — Astro + React islands

---

### SvelteKit

#### Install the plugin

```bash
npm install -D @designtools/svelte-plugin
```

#### Add to your Vite config — works alongside the SvelteKit plugin

```ts
// vite.config.ts
import { sveltekit } from "@sveltejs/kit/vite";
import designtools from "@designtools/svelte-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit(), designtools()],
});
```

#### Start the editor — your app's dev server should already be running

```bash
npx @designtools/surface
```

> **Demo:** `demos/svelte-app` — SvelteKit + Tailwind v4

---

## Styling systems

Surface auto-detects your styling approach and writes changes in your project's native format.

| System | Detection | Write format | Status |
|--------|-----------|-------------|--------|
| Tailwind CSS v4 | `tailwindcss ^4` in package.json | Utility classes via resolved theme | Stable |
| Tailwind CSS v3 | `tailwindcss ^3` + config file | Utility classes via theme config | Stable |
| CSS Variables | `--*` custom properties in stylesheets | Direct property writes in CSS files | Stable |
| Plain CSS | `.css` files with class selectors | Direct property writes in CSS files | Stable |
| CSS Modules | `.module.css` imports in JSX | Property writes in module CSS files | Stable |
| Sass / SCSS | — | — | Planned |

---

## Architecture

Surface uses a hybrid architecture where the **selection component** (`<Surface />`) lives inside the target app, while the **editor UI** is a separate Vite-served React app. The iframe loads the target app directly (no proxy), and all communication happens via `postMessage`.

```
Editor UI (localhost:4400)
  |-- <iframe src="http://localhost:3000" />   <- direct, no proxy
  |       |
  |       +-- Target app with <Surface /> component
  |               mounted by framework plugin
  |               communicates via postMessage
  |
  +-- Write server (API routes on same port)
```

Key design decisions:
- `data-source` attributes (injected at compile time) map every element to its exact file:line:col
- CSS property/value pairs as the universal editing primitive, with hints to preserve tokens
- Framework plugins and styling-system adapters are orthogonal
- Tailwind theme resolution for both v3 configs and v4 `@theme` blocks

---

## Packages

| Package | Description |
|---------|-------------|
| [`@designtools/surface`](packages/surface) | Hybrid visual editor — CLI + write server + React editor UI |
| [`@designtools/next-plugin`](packages/next-plugin) | Next.js config wrapper — `data-source` Babel transform + `<Surface />` mount |
| [`@designtools/vite-plugin`](packages/vite-plugin) | Vite plugin — `data-source` transform + `<Surface />` auto-mount |
| [`@designtools/astro-plugin`](packages/astro-plugin) | Astro integration — `.astro` template transform + `<Surface />` auto-mount |
| [`@designtools/svelte-plugin`](packages/svelte-plugin) | SvelteKit plugin — `.svelte` template transform + `<Surface />` auto-mount |

## Demo apps

| Demo | Framework | Styling | Run command |
|------|-----------|---------|-------------|
| `demos/next-react-tailwind` | Next.js | Tailwind CSS v4, CVA, OKLch tokens | `npm run demo:next-react-tailwind` |
| `demos/vite-react-tailwind` | Vite + React | Tailwind CSS v4 | `npm run demo:vite-react-tailwind` |
| `demos/remix-react-tailwind` | Remix | Tailwind CSS v4 | `npm run demo:remix-react-tailwind` |
| `demos/vite-react-tailwind-v3` | Vite + React | Tailwind CSS v3 custom theme | `npm run demo:vite-react-tailwind-v3` |
| `demos/vite-react-css` | Vite + React | Plain CSS + CSS Variables + CSS Modules | `npm run demo:vite-react-css` |
| `demos/astro-css` | Astro | Plain CSS + scoped styles | `npm run demo:astro-css` |
| `demos/svelte-css` | SvelteKit | Scoped styles + CSS Variables | `npm run demo:svelte-css` |
| `demos/svelte-tailwind` | SvelteKit | Tailwind CSS v4 | `npm run demo:svelte-tailwind` |

```bash
# Clone and build
git clone https://github.com/andflett/designtools.git
cd designtools
npm install
npm run build

# Install a demo and run
cd demos/next-react-tailwind && npm install && cd ../..

# Terminal 1
cd demos/next-react-tailwind && npm run dev

# Terminal 2
npm run demo:next-react-tailwind
```

The editor opens at [http://localhost:4400](http://localhost:4400).

---

## Project structure

```
designtools/
├── packages/
│   ├── surface/       Hybrid visual editor
│   ├── next-plugin/   Next.js config wrapper + data-source transform
│   ├── vite-plugin/   Vite plugin + data-source transform
│   ├── astro-plugin/  Astro integration + .astro template transform
│   └── svelte-plugin/ SvelteKit plugin + .svelte template transform
├── demos/
│   ├── next-react-tailwind/      Next.js + Tailwind v4 + CVA
│   ├── vite-react-tailwind/      Vite + React + Tailwind v4
│   ├── remix-react-tailwind/     Remix + Tailwind v4
│   ├── vite-react-tailwind-v3/   Vite + Tailwind v3 custom theme
│   ├── vite-react-css/           Plain CSS + CSS Variables + CSS Modules
│   ├── astro-css/                Astro + plain CSS + scoped styles
│   ├── svelte-css/               SvelteKit + scoped styles + CSS vars
│   └── svelte-tailwind/          SvelteKit + Tailwind v4
├── tests/
│   ├── e2e/           Playwright E2E tests (per-project directories)
│   └── fixtures/      Test fixture projects (integration tests)
```

## Testing with a local project

To test local changes against your own project:

### 1. Build the packages

```bash
cd /path/to/designtools
npm run build
```

### 2. Link the plugin for your framework

```bash
# Next.js
cd packages/next-plugin && npm link
cd /path/to/your-app && npm link @designtools/next-plugin

# Vite / Remix
cd packages/vite-plugin && npm link
cd /path/to/your-app && npm link @designtools/vite-plugin

# Astro
cd packages/astro-plugin && npm link
cd /path/to/your-app && npm link @designtools/astro-plugin

# SvelteKit
cd packages/svelte-plugin && npm link
cd /path/to/your-app && npm link @designtools/svelte-plugin
```

### 3. Run surface from source

```bash
# Terminal 1
cd /path/to/your-app && npm run dev

# Terminal 2
cd /path/to/your-app && node /path/to/designtools/packages/surface/dist/cli.js
```

### After making changes

Rebuild and the link picks up changes automatically:

```bash
cd /path/to/designtools
npm run build
```

Then restart the dev server and surface.

> `npm install` in the target project removes links. Re-run `npm link` after installing.

## Testing

### Unit & integration tests

```bash
npm test              # run all tests once
npm run test:watch    # watch mode
```

### E2E tests (Playwright)

Playwright starts the required demo servers automatically via `webServer` config.

```bash
# Run all E2E tests
npm run test:e2e

# Run with Playwright UI
npm run test:e2e:ui

# Run a single project
npx playwright test --project=next-react-tailwind
npx playwright test --project=vite-react-tailwind
npx playwright test --project=vite-react-css
npx playwright test --project=astro-css
npx playwright test --project=svelte-css
npx playwright test --project=svelte-tailwind
npx playwright test --project=remix-react-tailwind
npx playwright test --project=vite-react-tailwind-v3

# Run a single spec file
npx playwright test --project=vite-react-css tests/e2e/vite-react-css/element-css-modules.spec.ts
```

| Project | Demo | What it tests |
|---------|------|---------------|
| `next-react-tailwind` | next-react-tailwind | Tailwind v4 classes, CVA component/instance editing, selection, color tokens |
| `vite-react-tailwind` | vite-react-tailwind | Tailwind v4 class editing, token CRUD (`@theme` block) |
| `vite-react-css` | vite-react-css | Plain CSS properties, CSS Modules, token add/delete (`:root`) |
| `astro-css` | astro-css | Scoped styles, CSS variables |
| `svelte-css` | svelte-css | Scoped styles, CSS variables |
| `svelte-tailwind` | svelte-tailwind | Tailwind v4 classes on `.svelte` files, token editing |
| `remix-react-tailwind` | remix-react-tailwind | Tailwind v4 class editing (Remix) |
| `vite-react-tailwind-v3` | vite-react-tailwind-v3 | Tailwind v3 class editing |

## License

CC BY-NC 4.0 — free to use and modify for non-commercial purposes with attribution. See [LICENSE](LICENSE) for details.
