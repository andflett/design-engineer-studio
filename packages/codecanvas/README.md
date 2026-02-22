# @designtools/codecanvas

A CLI-launched visual design layer for React applications. Select elements in your running app and edit styles, tokens, and component variants — changes write back to your source files.

## Requirements

- Node.js >= 18
- **Next.js** >= 14 (only supported framework currently)
- **React** >= 18
- **Tailwind CSS** v3 or v4 (only supported styling system for class writes)

## Installation

```bash
npm install -D @designtools/codecanvas @designtools/next-plugin
```

## Setup

### 1. Wrap your Next.js config

```ts
// next.config.ts
import { withDesigntools } from "@designtools/next-plugin";

const nextConfig = {
  // your existing config
};

export default withDesigntools(nextConfig);
```

This does two things in development (at compile time only — your source files are not modified):

- Injects `data-source` attributes into every JSX element at build time, mapping each element to its source file, line, and column. These only exist in the compiled output.
- Auto-mounts the `<CodeCanvas />` selection overlay component in your root layout.

Neither is included in production builds.

### 2. Add `data-slot` to your components

For CodeCanvas to recognize reusable components (and distinguish them from plain HTML elements), add a `data-slot` attribute to the root element of each component:

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

### 3. Run it

Start your Next.js dev server, then start CodeCanvas from your project root:

```bash
# Terminal 1
npm run dev

# Terminal 2
npx designtools-codecanvas
```

The editor opens at `http://localhost:4400`. Your app loads inside an iframe — no proxy, no middleware.

### CLI options

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `3000` | Port your dev server runs on |
| `--tool-port` | `4400` | Port for the editor UI |

## How it works

1. Click an element in the iframe to select it
2. The editor panel shows its computed styles and Tailwind classes
3. Edit values — changes are written directly to your source files as Tailwind utility classes
4. Your dev server picks up the file change and hot-reloads

Changes are written as Tailwind classes (e.g. `text-sm`, `bg-blue-500`). When no matching utility exists, arbitrary value syntax is used (e.g. `text-[14px]`).

## What it can edit

- **Element styles** — layout, spacing, typography, colors, borders, shadows, opacity
- **Design tokens** — CSS custom properties in your stylesheets
- **Component variants** — base classes and variant mappings (works with CVA)
- **Box shadows** — shadow token definitions in CSS or `@theme` blocks

## Limitations

- **Next.js only** — framework detection exists for Remix and Vite but they are untested
- **Tailwind only for class writes** — CSS variable and plain CSS token editing works, but className writes produce Tailwind utility classes
- **Development only** — the plugin and overlays are stripped from production builds
- **App Router** — the auto-mount targets `app/layout.tsx` (or `src/app/layout.tsx`). Pages Router is not supported for auto-mounting

## License

CC-BY-NC-4.0
