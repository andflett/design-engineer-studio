# @designtools/studio

Visual editing CLI for design tokens, component variants, and Tailwind classes. Proxies your app inside an iframe, injects a selection script, and lets you visually edit tokens, components, and instances — writing changes back to source files.

## Install

```bash
npm install -g @designtools/studio
```

## Usage

Start your dev server, then run the CLI in your project directory:

```bash
designtools-studio
```

Or use `npx` without installing:

```bash
npx @designtools/studio
```

The studio opens at [http://localhost:4400](http://localhost:4400) with your app proxied inside.

### Options

```
--port <number>   Port your dev server is running on (default: 3000)
```

```bash
designtools-studio --port 5173
```

## What you can edit

- **Tokens** — CSS custom properties (colors, spacing, radius) at the system level
- **Components** — CVA variant definitions (button sizes, badge styles, etc.)
- **Instances** — individual component classNames in your source code

All changes are written directly back to your source files.

## Supported styling systems

| System | Detection |
|--------|-----------|
| Tailwind CSS v4 | `tailwindcss ^4` in package.json |
| Tailwind CSS v3 | `tailwindcss ^3` + config file |
| Bootstrap 5 | `bootstrap` in package.json |
| CSS Variables | `--*` custom properties in `:root` |

## How it works

The CLI scans your project to detect the framework and styling system, starts an Express server that proxies your app, injects a selection overlay script, and serves a React SPA as the editing interface. Edits are regex-based find-and-replace operations on your source files — no AST parsing.

## Part of @designtools

This package is part of the [@designtools](https://github.com/andflett/designtools) monorepo. See also [`@designtools/shadows`](https://www.npmjs.com/package/@designtools/shadows) for shadow-specific editing.

## License

CC BY-NC 4.0 — free to use and modify for non-commercial purposes with attribution.
