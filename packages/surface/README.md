# @designtools/surface

A CLI-launched visual design layer for web applications. Select elements in your running app and edit styles, tokens, and component variants — changes write back to your source files.

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
- A supported styling system: **Tailwind CSS** v3/v4, **CSS Custom Properties**, **Plain CSS**, or **CSS Modules**

---

### Next.js

```bash
npm install -D @designtools/next-plugin
```

```ts
// next.config.ts
import { withDesigntools } from "@designtools/next-plugin";

export default withDesigntools({
  /* your existing config */
});
```

```bash
# Terminal 1 — start your app
npm run dev

# Terminal 2 — start surface
npx @designtools/surface
```

---

### Vite + React

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

The plugin must be listed **before** `@vitejs/plugin-react`.

```bash
# Terminal 1 — start your app
npm run dev

# Terminal 2 — start surface
npx @designtools/surface
```

---

### Remix

Remix uses Vite under the hood, so the setup is the same as Vite + React.

```bash
npm install -D @designtools/vite-plugin
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import designtools from "@designtools/vite-plugin";

export default defineConfig({
  plugins: [designtools(), reactRouter()],
});
```

```bash
npx @designtools/surface
```

---

### Astro

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

```bash
npx @designtools/surface
```

---

### SvelteKit

```bash
npm install -D @designtools/svelte-plugin
```

```ts
// vite.config.ts
import { sveltekit } from "@sveltejs/kit/vite";
import designtools from "@designtools/svelte-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit(), designtools()],
});
```

```bash
npx @designtools/surface
```

---

## What the plugins do

In development, each framework plugin:

- Injects `data-source="file:line:col"` attributes into every element, mapping each element to its source location. These only exist in the compiled output — your source files are not modified.
- Auto-mounts the `<Surface />` selection overlay component into your app.

Neither is included in production builds.

## Component editing with `data-slot`

For Surface to recognize reusable components (and distinguish them from plain HTML elements), add a `data-slot` attribute to the root element of each component:

```tsx
// components/ui/button.tsx
export function Button({ children, className, ...props }) {
  return (
    <button data-slot="button" className={cn("...", className)} {...props}>
      {children}
    </button>
  );
}
```

The `data-slot` value should be a kebab-case name matching the component (e.g. `card-title` for `CardTitle`). This enables component-level editing — selecting a Button in the editor will let you modify its base styles in the component file, not just the instance.

Components without `data-slot` can still be selected and edited at the element level.

## CLI options

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `3000` | Port your dev server runs on |
| `--tool-port` | `4400` | Port for the editor UI |
| `--components` | auto-detected | Path to your UI components directory |
| `--css` | auto-detected | Path to your CSS tokens file |

Both ports auto-increment if the default is busy. Component and CSS paths are auto-detected but can be overridden when detection fails.

## How it works

1. Click an element in the iframe to select it
2. The editor panel shows its computed styles, Tailwind classes, and source location
3. Edit values — changes are written directly to your source files
4. Your dev server picks up the file change and hot-reloads

For Tailwind projects, changes are written as utility classes. When a project customizes its Tailwind theme (v3 config or v4 `@theme` blocks), Surface resolves the custom scales and uses them for class suggestions. When no matching utility exists, arbitrary value syntax is used (e.g. `text-[14px]`).

For CSS/CSS Modules/CSS Variables projects, writes go directly to the relevant CSS files. Inline style fallback when no matching CSS rule is found.

## What it can edit

- **Element styles** — layout, spacing, typography, colors, borders, shadows, opacity
- **Design tokens** — CSS custom properties in your stylesheets
- **Component variants** — base classes and variant mappings (works with CVA)
- **Shadows** — shadow token definitions in CSS or Tailwind `@theme` blocks
- **Gradients** — gradient token definitions
- **Spacing** — spacing scale tokens
- **Borders** — border radius and border width tokens

## Support matrix

### Frameworks

| Framework | Plugin | Status |
|-----------|--------|--------|
| Next.js (App Router) | `@designtools/next-plugin` | Stable |
| Vite + React | `@designtools/vite-plugin` | Stable |
| Astro | `@designtools/astro-plugin` | Stable |
| SvelteKit | `@designtools/svelte-plugin` | Stable |
| Remix | `@designtools/vite-plugin` | Beta |

### Styling systems

| System | Write format | Status |
|--------|-------------|--------|
| Tailwind CSS v4 | Utility classes via resolved theme | Stable |
| Tailwind CSS v3 | Utility classes via theme config | Stable |
| CSS Variables | Direct property writes in CSS files | Stable |
| Plain CSS | Direct property writes in CSS files | Stable |
| CSS Modules | Property writes in .module.css files | Stable |
| Sass / SCSS | — | Planned |

## Limitations

- **Development only** — the plugin and overlays are stripped from production builds
- **Next.js App Router only** — the auto-mount targets `app/layout.tsx`. Pages Router is not supported.
- **Remix** — should work via Vite plugin but is not yet fully tested

## License

CC-BY-NC-4.0
