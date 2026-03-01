# @designtools/codesurface

A CLI-launched visual design layer for React applications. Select elements in your running app and edit styles, tokens, and component variants — changes write back to your source files.

## Requirements

- Node.js >= 18
- **Next.js** >= 14 (App Router)
- **React** >= 18
- A supported styling system: **Tailwind CSS** v3/v4, **CSS Custom Properties**, **Bootstrap**, or plain CSS

## Installation

```bash
npm install -D @designtools/codesurface @designtools/next-plugin
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

In development, this:

- Adds a Babel pass that injects `data-source="file:line:col"` attributes into every JSX element, mapping each element to its source location. These only exist in the compiled output — your source files are not modified.
- Auto-mounts the `<CodeSurface />` selection overlay component into your root layout (`app/layout.tsx` or `src/app/layout.tsx`).

Neither is included in production builds.

### 2. Add `data-slot` to your components

For CodeSurface to recognize reusable components (and distinguish them from plain HTML elements), add a `data-slot` attribute to the root element of each component:

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

Start your Next.js dev server, then run CodeSurface from your project root:

```bash
# Terminal 1: start your app
npm run dev

# Terminal 2: start the editor
npx codesurface
```

The CLI auto-detects your dev server on port 3000 (also scanning 3001 and 3002 in case Next.js picked a different port). The editor opens at `http://localhost:4400`.

Your app loads inside an iframe — no proxy, no middleware.

### CLI options

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `3000` | Port your dev server runs on |
| `--tool-port` | `4400` | Port for the editor UI |

Both ports auto-increment if the default is busy.

## How it works

1. Click an element in the iframe to select it
2. The editor panel shows its computed styles, Tailwind classes, and source location
3. Edit values — changes are written directly to your source files
4. Your dev server picks up the file change and hot-reloads

For Tailwind projects, changes are written as utility classes (e.g. `text-sm`, `bg-blue-500`). When no matching utility exists, arbitrary value syntax is used (e.g. `text-[14px]`).

## What it can edit

- **Element styles** — layout, spacing, typography, colors, borders, shadows, opacity
- **Design tokens** — CSS custom properties in your stylesheets
- **Component variants** — base classes and variant mappings (works with CVA)
- **Shadows** — shadow token definitions in CSS or Tailwind `@theme` blocks
- **Gradients** — gradient token definitions
- **Spacing** — spacing scale tokens
- **Borders** — border radius and border width tokens

## Limitations

- **Next.js only** — framework detection exists for Remix and Vite but they are untested
- **Tailwind for class writes** — CSS variable and plain CSS token editing works, but `className` writes produce Tailwind utility classes
- **Development only** — the plugin and overlays are stripped from production builds
- **App Router only** — the auto-mount targets `app/layout.tsx` (or `src/app/layout.tsx`). Pages Router is not supported

## License

CC-BY-NC-4.0
