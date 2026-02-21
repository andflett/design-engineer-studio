# Design Tools

Visual editing CLI tools for web applications — edit styles, tokens, and components visually with changes written back to source files.

[Read the write-up](https://www.flett.cc/projects/design-engineer-studio)

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [`@designtools/codecanvas`](packages/codecanvas) | Hybrid visual editor — selection overlays in the target app, editor UI in a separate Vite app | **Active development** |
| [`@designtools/next-plugin`](packages/next-plugin) | Next.js config wrapper — injects `data-source` attributes and mounts `<Studio />` | **Active development** |
| [`@designtools/studio`](packages/studio) | Visual editor for tokens, components, and instances (proxy-based) | Legacy |
| [`@designtools/shadows`](packages/shadows) | Visual editor for box-shadow values (proxy-based) | Legacy |
| `@designtools/core` | Shared scanner, server, and client utilities | Legacy (shared) |

## Architecture

CodeCanvas uses a hybrid architecture where the **selection component** (`<Studio />`) lives inside the target app via the `withDesigntools()` config wrapper, while the **editor UI** remains a separate Vite-served React app. The iframe loads the target app directly (no proxy), and all communication happens via `postMessage`.

```
Editor UI (Vite, 4400)
  |-- <iframe src="http://localhost:3000" />   <- direct, no proxy
  |       |
  |       +-- Target app with <Studio /> component
  |               mounted by withDesigntools()
  |               communicates via postMessage
  |
  +-- Write server (API routes on same port)
```

Key design decisions:
- `data-source` attributes (injected at compile time) provide exact file:line:col mapping for every element
- CSS property/value pairs as the universal editing primitive, with styling-system hints to preserve tokens
- Framework plugins (Next.js, Vite, etc.) and styling-system adapters (Tailwind, CSS variables, etc.) are orthogonal

See [architecture plan](.claude/studio-hybrid-architecture-plan.md) and [exploration history](.claude/exploration-history.md) for full context.

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

# Terminal 2 — start codecanvas
npm run dev:codecanvas
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

## Legacy tools

The original `@designtools/studio` and `@designtools/shadows` packages are still in the repo and buildable. They use a proxy-based architecture that is being replaced by CodeCanvas. See the [exploration history](.claude/exploration-history.md) for why.

```bash
# Legacy studio
npm run dev:studio

# Legacy shadows
npm run dev:shadows
```

## Project structure

```
designtools/
├── packages/
│   ├── codecanvas/    Hybrid visual editor (active)
│   ├── next-plugin/   Next.js config wrapper + data-source transform
│   ├── core/          Shared scanner, server, and client utilities (legacy)
│   ├── studio/        Proxy-based visual editor (legacy)
│   └── shadows/       Shadow-specific editing tool (legacy)
├── demos/
│   ├── studio-app/              Tailwind CSS v4 + CVA demo
│   ├── bootstrap-app/           Bootstrap 5 demo
│   ├── w3c-tokens-app/          W3C Design Tokens demo
│   ├── css-variables-app/       Plain CSS variables demo
│   └── tailwind-shadows-app/    Tailwind CSS v4 shadows demo
```

## License

CC BY-NC 4.0 — free to use and modify for non-commercial purposes with attribution. See [LICENSE](LICENSE) for details.
