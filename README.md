# CLI Design Tools

Visual editing CLI tools for design tokens, component variants, and shadows — writes changes back to source files.

[Read the write-up](https://www.flett.cc/projects/design-engineer-studio)

## Packages

| Package | Description | CLI command |
|---------|-------------|-------------|
| [`@designtools/studio`](packages/studio) | Visual editor for tokens, components, and instances | `npx @designtools/studio` |
| [`@designtools/shadows`](packages/shadows) | Visual editor for box-shadow values | `npx @designtools/shadows` |
| `@designtools/core` | Shared scanner, server, and client utilities (internal) | — |

## Try the demos

Five demo apps cover the major styling approaches. Each is a self-contained Next.js app you can run alongside the tools.

| Demo | Styling | Shadows | Port |
|------|---------|---------|------|
| **Studio** (`demos/studio-app`) | Tailwind CSS v4, CVA, OKLch tokens | Component editing demo | 3000 |
| **Bootstrap** (`demos/bootstrap-app`) | Bootstrap 5 Sass + CSS custom properties | `$box-shadow-*` / `--bs-box-shadow-*` | 3001 |
| **W3C Tokens** (`demos/w3c-tokens-app`) | W3C Design Tokens Format (DTCG) | `.tokens.json` with `$type: "shadow"` | 3002 |
| **CSS Variables** (`demos/css-variables-app`) | Plain CSS custom properties | `--shadow-xs` through `--shadow-xl` | 3003 |
| **Tailwind Shadows** (`demos/tailwind-shadows-app`) | Tailwind CSS v4 `@theme` | `--shadow-xs` through `--shadow-xl` | 3004 |

### Prerequisites

- Node.js 18+

### Setup

```bash
git clone https://github.com/andflett/designtools.git
cd designtools

# Install monorepo dependencies and build the tools
npm install
npm run build
```

Then install the demo you want to try:

```bash
# Studio demo (Tailwind v4 + CVA)
cd demos/studio-app && npm install && cd ../..

# Bootstrap demo
cd demos/bootstrap-app && npm install && cd ../..

# W3C Design Tokens demo
cd demos/w3c-tokens-app && npm install && cd ../..

# CSS Variables demo
cd demos/css-variables-app && npm install && cd ../..

# Tailwind Shadows demo
cd demos/tailwind-shadows-app && npm install && cd ../..
```

### Run

You need two terminals — one for the demo app, one for the tool.

**Terminal 1** — start a demo app:

```bash
# Studio (port 3000)
npm run demo

# Or run any demo directly:
cd demos/bootstrap-app && npm run dev          # port 3001
cd demos/w3c-tokens-app && npm run dev         # port 3002
cd demos/css-variables-app && npm run dev      # port 3003
cd demos/tailwind-shadows-app && npm run dev   # port 3004
```

**Terminal 2** — start a tool (from the project root):

```bash
# Studio — default (connects to port 3000)
npx @designtools/studio

# Studio — for other demos, pass --port:
npx @designtools/studio --port 3001  # Bootstrap
npx @designtools/studio --port 3002  # W3C Tokens
npx @designtools/studio --port 3003  # CSS Variables

# Shadows tool
npx @designtools/shadows
npx @designtools/shadows --port 3001  # Bootstrap
npx @designtools/shadows --port 3004  # Tailwind Shadows
```

The studio opens at [http://localhost:4400](http://localhost:4400) and shadows at [http://localhost:4410](http://localhost:4410), with the demo app proxied inside.

## What you can edit

- **Tokens** — CSS custom properties (colors, spacing, radius) at the system level
- **Components** — CVA variant definitions (button sizes, badge styles, etc.)
- **Instances** — individual component classNames in your source code
- **Shadows** — box-shadow values across Tailwind, Bootstrap, W3C Design Tokens, and plain CSS

All changes are written directly back to your source files.

## Supported styling systems

| System | Detection | Shadow format |
|--------|-----------|---------------|
| Tailwind CSS v4 | `tailwindcss ^4` in package.json | `@theme { --shadow-*: ... }` |
| Tailwind CSS v3 | `tailwindcss ^3` + config file | `:root` CSS custom properties |
| Bootstrap 5 | `bootstrap` in package.json | Sass `$box-shadow-*` and CSS `--bs-box-shadow-*` |
| W3C Design Tokens | `.tokens.json` files with `$type: "shadow"` | DTCG composite values |
| CSS Variables | `--*` custom properties in `:root` | Standard `box-shadow` values |

## Use with your own project

```bash
npm install -g @designtools/studio
```

Start your dev server, then run the CLI in your project directory:

```bash
designtools-studio
```

Or use `npx` without installing:

```bash
npx @designtools/studio
```

Pass `--port` if your dev server isn't on port 3000:

```bash
designtools-studio --port 5173
```

For shadows only:

```bash
npm install -g @designtools/shadows
designtools-shadows --port 5173
```

## Project structure

```
designtools/
├── packages/
│   ├── core/          Shared scanner, server, and client utilities
│   ├── studio/        Main visual editing CLI
│   └── shadows/       Shadow-specific editing tool
├── demos/
│   ├── studio-app/              Tailwind CSS v4 + CVA demo
│   ├── bootstrap-app/           Bootstrap 5 demo
│   ├── w3c-tokens-app/          W3C Design Tokens demo
│   ├── css-variables-app/       Plain CSS variables demo
│   └── tailwind-shadows-app/    Tailwind CSS v4 shadows demo
```

## License

CC BY-NC 4.0 — free to use and modify for non-commercial purposes with attribution. See [LICENSE](LICENSE) for details.
