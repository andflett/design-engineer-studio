# Design Engineer Studio

Visual editing CLI for design tokens, component variants, and Tailwind classes — writes changes back to source files.

[Read the write-up](https://www.flett.cc/projects/design-engineer-studio)

## Try the demos

Four demo apps cover the major styling approaches. Each is a self-contained Next.js app you can run alongside the studio.

| Demo | Styling | Shadows | Port |
|------|---------|---------|------|
| **Tailwind** (`packages/demo`) | Tailwind CSS v4, CVA, OKLch tokens | `@theme` shadow variables | 3000 |
| **Bootstrap** (`demos/bootstrap-app`) | Bootstrap 5 Sass + CSS custom properties | `$box-shadow-*` / `--bs-box-shadow-*` | 3001 |
| **W3C Tokens** (`demos/w3c-tokens-app`) | W3C Design Tokens Format (DTCG) | `.tokens.json` with `$type: "shadow"` | 3002 |
| **CSS Variables** (`demos/css-variables-app`) | Plain CSS custom properties | `--shadow-xs` through `--shadow-xl` | 3003 |

### Prerequisites

- Node.js 18+

### Setup

```bash
git clone https://github.com/andflett/design-engineer-studio.git
cd design-engineer-studio

# Install monorepo dependencies and build the studio
npm install
npm run build
```

Then install the demo you want to try:

```bash
# Tailwind demo (existing)
cd packages/demo && npm install && cd ../..

# Bootstrap demo
cd demos/bootstrap-app && npm install && cd ../..

# W3C Design Tokens demo
cd demos/w3c-tokens-app && npm install && cd ../..

# CSS Variables demo
cd demos/css-variables-app && npm install && cd ../..
```

### Run

You need two terminals — one for the demo app, one for the studio.

**Terminal 1** — start a demo app:

```bash
# Tailwind (port 3000)
npm run demo

# Or run any demo directly:
cd demos/bootstrap-app && npm run dev      # port 3001
cd demos/w3c-tokens-app && npm run dev     # port 3002
cd demos/css-variables-app && npm run dev  # port 3003
```

**Terminal 2** — start the studio (from the project root):

```bash
# Default (connects to port 3000)
npx design-engineer-studio

# For other demos, pass --port:
npx design-engineer-studio --port 3001  # Bootstrap
npx design-engineer-studio --port 3002  # W3C Tokens
npx design-engineer-studio --port 3003  # CSS Variables
```

The studio opens at [http://localhost:4400](http://localhost:4400) with the demo app proxied inside it.

### Shadows tool

The shadows tool is a standalone editor for box-shadow values. It detects the styling system in use and reads/writes shadows in the appropriate format:

```bash
# Default (port 3000)
npx designtools-shadows

# For other demos:
npx designtools-shadows --port 3001  # Bootstrap
npx designtools-shadows --port 3002  # W3C Tokens
npx designtools-shadows --port 3003  # CSS Variables
```

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
npm install -g @flett/design-engineer-studio
```

Start your dev server, then run the CLI in your project directory:

```bash
design-engineer-studio
```

Pass `--port` if your dev server isn't on port 3000:

```bash
design-engineer-studio --port 5173
```

## Project structure

```
design-engineer-studio/
├── packages/
│   ├── core/          Shared scanner, server, and client utilities
│   ├── studio/        Main visual editing CLI
│   ├── shadows/       Shadow-specific editing tool
│   └── demo/          Tailwind CSS demo app
├── demos/
│   ├── bootstrap-app/      Bootstrap 5 demo
│   ├── w3c-tokens-app/     W3C Design Tokens demo
│   └── css-variables-app/  Plain CSS variables demo
```

## License

CC BY-NC 4.0 — free to use and modify for non-commercial purposes with attribution. See [LICENSE](LICENSE) for details.
