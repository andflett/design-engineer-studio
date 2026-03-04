# @designtools/svelte-plugin

SvelteKit plugin for [designtools](https://github.com/andflett/designtools). Adds source annotation attributes to `.svelte` templates and auto-mounts the `<Surface />` selection overlay in development.

## Install

```bash
npm install @designtools/svelte-plugin
```

## Usage

```ts
// vite.config.ts
import { sveltekit } from "@sveltejs/kit/vite";
import designtools from "@designtools/svelte-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit(), designtools()],
});
```

## What it does

In development (`vite dev`):

1. **`.svelte` template annotation** — Parses `.svelte` files with `svelte/compiler` and injects `data-source="file:line:col"` on native HTML elements and `data-instance-source` on component instances via string splicing (preserves exact formatting)
2. **React/JSX annotation** — Uses the Vite plugin's Babel transform to add `data-source` attributes to any `.tsx`/`.jsx` files in the project
3. **Surface auto-mount** — Injects `<Surface />` into the HTML shell via `transformIndexHtml`
4. **Component registry** — Generates a component registry for isolation preview

In production builds, the plugin is a no-op.

## Options

```ts
designtools({
  componentDir: "src/lib/components", // Override component scan directory
});
```

## Running with Surface

```bash
# Terminal 1: Start your SvelteKit app
npm run dev

# Terminal 2: Start the Surface editor
npx @designtools/surface
```

The Surface editor opens at `localhost:4400` and loads your SvelteKit app in an iframe.

## How annotation works

### `.svelte` files

The plugin runs as a Vite `enforce: "pre"` load hook before Svelte's own compiler. It parses the `.svelte` source with `svelte/compiler` (modern AST mode), walks the AST to find element and component nodes, then splices `data-source` / `data-instance-source` attributes at the reported offsets. This preserves your exact formatting — no AST serialization or reformatting.

- Native HTML elements (`<div>`, `<p>`, `<section>`) get `data-source`
- Svelte components (`<Card>`, `<Button>`) get `data-instance-source`
- `<style>`, `<script>`, `<slot>`, `<svelte:head>`, `<svelte:window>`, `<svelte:body>`, `<svelte:document>` are skipped
- Block children (`{#if}`, `{#each}`, `{#await}`, `{#key}`, `{#snippet}`) are traversed recursively

### Svelte 5 compatibility

The plugin uses `svelte/compiler`'s modern AST mode (`parse(code, { modern: true })`), which is the default in Svelte 5. It handles all Svelte 5 AST node types including `RegularElement`, `Component`, `SvelteComponent`, `SvelteSelf`, and all block types.

## Supported styling systems

All styling systems supported by Surface work with the SvelteKit plugin:

| System | Status |
|--------|--------|
| Tailwind CSS v3 / v4 | Stable |
| CSS Variables | Stable |
| Plain CSS | Stable |
| CSS Modules | Stable |
| Scoped `<style>` blocks | Stable |
| Sass / SCSS | Planned |

See the [Surface README](../surface/README.md) for the full support matrix.

## License

CC-BY-NC-4.0
