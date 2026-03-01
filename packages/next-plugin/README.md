# @designtools/next-plugin

Next.js config wrapper for [@designtools/surface](../surface). Adds source location annotations and mounts the selection overlay — development only.

## Installation

```bash
npm install -D @designtools/next-plugin
```

## Peer dependencies

- `next` >= 14
- `react` >= 18

## Usage

Wrap your Next.js config with `withDesigntools`:

```ts
// next.config.ts
import { withDesigntools } from "@designtools/next-plugin";

const nextConfig = {
  // your existing config
};

export default withDesigntools(nextConfig);
```

If you already have a `webpack` customization, it will still be called — `withDesigntools` chains onto it.

## What it does

In development (`next dev`), the plugin adds two webpack loaders:

### 1. Source annotation loader

Runs a Babel pass over every `.tsx` / `.jsx` file (excluding `node_modules`) that adds a `data-source="file:line:col"` attribute to each JSX element. This maps rendered DOM elements back to their source location so the editor can open the right file when you select an element.

SWC stays enabled as the primary compiler — Babel is only used for this annotation pass.

### 2. Surface mount loader

Transforms your root layout file (`app/layout.tsx` or `src/app/layout.tsx`) to auto-mount the `<Surface />` selection overlay component. This component handles element selection, hover highlighting, inline style previews, and postMessage communication with the editor UI.

Both loaders are skipped entirely in production builds.

## Exports

| Export | Description |
|--------|-------------|
| `@designtools/next-plugin` | `withDesigntools()` config wrapper |
| `@designtools/next-plugin/surface` | `<Surface />` React component (mounted automatically — you shouldn't need to import this directly) |

## License

CC-BY-NC-4.0
