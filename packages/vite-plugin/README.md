# @designtools/vite-plugin

Vite plugin for [designtools](https://github.com/andflett/designtools). Adds source annotation attributes and auto-mounts the `<Surface />` selection overlay in development.

## Install

```bash
npm install @designtools/vite-plugin
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import designtools from "@designtools/vite-plugin";

export default defineConfig({
  plugins: [designtools(), react()],
});
```

The plugin must be listed **before** `@vitejs/plugin-react` (it uses `enforce: "pre"` to ensure correct ordering).

## What it does

In development (`vite dev`):

1. **Source annotation** — Adds `data-source="file:line:col"` to native JSX elements and `data-instance-source` to component instances
2. **Surface auto-mount** — Injects `<Surface />` into `src/main.tsx` alongside your app root
3. **Component registry** — Generates `src/designtools-registry.ts` for component isolation preview

In production builds, the plugin is a no-op.

## Options

```ts
designtools({
  componentDir: "src/components/ui", // Override component scan directory
});
```

## Running with Surface

```bash
# Terminal 1: Start your Vite app
npm run dev

# Terminal 2: Start the Surface editor
npx @designtools/surface
```

The Surface editor opens at `localhost:4400` and loads your Vite app in an iframe.

## Supported frameworks

The Vite plugin works with any Vite-based React project:

| Framework | Notes |
|-----------|-------|
| Vite + React | Direct support |
| Remix | Vite-based — works with the standard Vite plugin |

For **Next.js**, use [`@designtools/next-plugin`](../next-plugin) instead.
For **Astro**, use [`@designtools/astro-plugin`](../astro-plugin) instead.
For **SvelteKit**, use [`@designtools/svelte-plugin`](../svelte-plugin) instead.

## Supported styling systems

All styling systems supported by Surface work with the Vite plugin:

| System | Status |
|--------|--------|
| Tailwind CSS v3 / v4 | Stable |
| CSS Variables | Stable |
| Plain CSS | Stable |
| CSS Modules | Stable |
| Sass / SCSS | Planned |

See the [Surface README](../surface/README.md) for the full support matrix.

## License

CC-BY-NC-4.0
