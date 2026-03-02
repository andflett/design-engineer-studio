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
