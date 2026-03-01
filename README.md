# Design Tools

Visual editing CLI tools for web applications — edit styles, tokens, and components visually with changes written back to source files.

[Read the write-up](https://www.flett.cc/projects/design-engineer-studio)

## Packages

| Package | Description |
|---------|-------------|
| [`@designtools/surface`](packages/surface) | Hybrid visual editor — selection overlays in the target app, editor UI in a separate Vite app |
| [`@designtools/next-plugin`](packages/next-plugin) | Next.js config wrapper — injects `data-source` attributes and mounts `<Surface />` |

## Architecture

Surface uses a hybrid architecture where the **selection component** (`<Surface />`) lives inside the target app via the `withDesigntools()` config wrapper, while the **editor UI** remains a separate Vite-served React app. The iframe loads the target app directly (no proxy), and all communication happens via `postMessage`.

```
Editor UI (Vite, 4400)
  |-- <iframe src="http://localhost:3000" />   <- direct, no proxy
  |       |
  |       +-- Target app with <Surface /> component
  |               mounted by withDesigntools()
  |               communicates via postMessage
  |
  +-- Write server (API routes on same port)
```

Key design decisions:
- `data-source` attributes (injected at compile time) provide exact file:line:col mapping for every element
- CSS property/value pairs as the universal editing primitive, with styling-system hints to preserve tokens
- Framework plugins (Next.js, Vite, etc.) and styling-system adapters (Tailwind, CSS variables, etc.) are orthogonal

## Demo apps

| Demo | Styling | Port |
|------|---------|------|
| **Studio** (`demos/studio-app`) | Tailwind CSS v4, CVA, OKLch tokens | 3000 |
| **Bootstrap** (`demos/bootstrap-app`) | Bootstrap 5 Sass + CSS custom properties | 3001 |
| **W3C Tokens** (`demos/w3c-tokens-app`) | W3C Design Tokens Format (DTCG) | 3002 |
| **CSS Variables** (`demos/css-variables-app`) | Plain CSS custom properties | 3003 |
| **Tailwind Shadows** (`demos/tailwind-shadows-app`) | Tailwind CSS v4 `@theme` | 3004 |

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

## Supported styling systems

| System | Detection | Write format |
|--------|-----------|-------------|
| Tailwind CSS v4 | `tailwindcss ^4` in package.json | Utility class replacement via resolved theme |
| Tailwind CSS v3 | `tailwindcss ^3` + config file | Utility class replacement |
| Bootstrap 5 | `bootstrap` in package.json | Sass variables / CSS custom properties |
| W3C Design Tokens | `.tokens.json` files with `$type` | DTCG composite values |
| CSS Variables | `--*` custom properties in `:root` | Direct property writes |

## Project structure

```
designtools/
├── packages/
│   ├── surface/       Hybrid visual editor
│   └── next-plugin/   Next.js config wrapper + data-source transform
├── demos/
│   ├── studio-app/              Tailwind CSS v4 + CVA demo
│   ├── bootstrap-app/           Bootstrap 5 demo
│   ├── w3c-tokens-app/          W3C Design Tokens demo
│   ├── css-variables-app/       Plain CSS variables demo
│   └── tailwind-shadows-app/    Tailwind CSS v4 shadows demo
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
