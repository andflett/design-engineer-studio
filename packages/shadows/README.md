# @designtools/shadows

Visual shadow editing CLI — scan, preview, and edit box-shadow values in your project. Detects your styling system and reads/writes shadows in the appropriate format.

## Install

```bash
npm install -g @designtools/shadows
```

## Usage

Start your dev server, then run the CLI in your project directory:

```bash
designtools-shadows
```

Or use `npx` without installing:

```bash
npx @designtools/shadows
```

The editor opens at [http://localhost:4410](http://localhost:4410) with your app proxied inside.

### Options

```
--port <number>   Port your dev server is running on (default: 3000)
```

```bash
designtools-shadows --port 5173
```

## Supported styling systems

| System | Detection | Shadow format |
|--------|-----------|---------------|
| Tailwind CSS v4 | `tailwindcss ^4` in package.json | `@theme { --shadow-*: ... }` |
| Tailwind CSS v3 | `tailwindcss ^3` + config file | `:root` CSS custom properties |
| Bootstrap 5 | `bootstrap` in package.json | Sass `$box-shadow-*` and CSS `--bs-box-shadow-*` |
| W3C Design Tokens | `.tokens.json` files with `$type: "shadow"` | DTCG composite values |
| CSS Variables | `--*` custom properties in `:root` | Standard `box-shadow` values |

## How it works

The CLI scans your project to detect the framework and styling system, loads shadow presets for the detected framework, and starts an Express server that proxies your app with a visual shadow editor. Edits are written back to the appropriate source file format (CSS, Sass, JSON, etc.).

## Part of @designtools

This package is part of the [@designtools](https://github.com/andflett/designtools) monorepo. See also [`@designtools/studio`](https://www.npmjs.com/package/@designtools/studio) for token, component, and instance editing.

## License

CC BY-NC 4.0 — free to use and modify for non-commercial purposes with attribution.
