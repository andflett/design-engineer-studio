# Framework & Styling Coverage

What we support, what demos exercise it, what tests cover it, and where the gaps are.

## Dimensions

Two orthogonal axes determine behavior:

| Axis | Values | Affects |
|------|--------|---------|
| **App framework** | `nextjs`, `vite`, `remix`, `astro`, `svelte` | Source annotation (data-source), Surface mount strategy, HMR handling |
| **Styling system** | `tailwind-v4`, `tailwind-v3`, `css` | Write path (class mode vs CSS mode), token block (`@theme` vs `:root`), theme resolution |

A third axis — **CSS authoring pattern** — matters within the `css` styling system:

| Pattern | Example demo | Write strategy |
|---------|-------------|----------------|
| Plain CSS + CSS variables | `vite-react-css` | Find rule in project stylesheets, write property |
| CSS Modules | `vite-react-css` (StatusCard) | Resolve `.module.css` import, find `.className` rule |
| Scoped `<style>` blocks | `astro-css`, `svelte-css` | Parse SFC `<style>` block, find/create rule |

## Demo ↔ Test Matrix

### Comprehensive test suites (next-react-tailwind)

The `next-react-tailwind` project is the reference suite with full coverage:

| Spec file | What it tests |
|-----------|---------------|
| `selection.spec.ts` | Element selection, name display, tab visibility |
| `component-props.spec.ts` | CVA variant prop editing (Component tab) |
| `component-styles.spec.ts` | Component definition style editing |
| `instance-props.spec.ts` | Instance prop overrides (variant dropdowns) |
| `instance-styles.spec.ts` | Instance style overrides (className) |
| `element-tailwind.spec.ts` | Direct Tailwind class editing on plain elements |
| `token-color.spec.ts` | Color token editing |

### Basic test suites (all other projects)

Each has a `basic.spec.ts` with 2 tests: token edit + element edit.

| Demo | Framework | Styling | Tests | Port (app/tool) |
|------|-----------|---------|-------|-----------------|
| `next-react-tailwind` | Next.js | `tailwind-v4` | 7 spec files (14 tests) | 3100 / 4500 |
| `vite-react-tailwind` | Vite | `tailwind-v4` | `basic.spec.ts` (2) + `token-add-delete.spec.ts` (4) | 3101 / 4501 |
| `vite-react-css` | Vite | `css` | `element-css.spec.ts` + `element-css-modules.spec.ts` + `token-add-delete.spec.ts` | 3103 / 4503 |
| `astro-css` | Astro | `css` | `basic.spec.ts` (2 tests) | 3105 / 4505 |
| `svelte-css` | SvelteKit | `css` | `basic.spec.ts` (2 tests) | 3106 / 4506 |
| `remix-react-tailwind` | Remix | `tailwind-v4` | `basic.spec.ts` (2 tests) | 3107 / 4507 |
| `vite-react-tailwind-v3` | Vite | `tailwind-v3` | `basic.spec.ts` (2 tests) | 3109 / 4509 |
| `svelte-tailwind` | SvelteKit | `tailwind-v4` | `basic.spec.ts` (2 tests) | 3110 / 4510 |

## Gaps

### E2E test gaps

1. **Component/instance editing — only tested on Next.js.** CVA component props, component styles, instance props, and instance styles are only tested in `next-react-tailwind`. No coverage for these features on Vite, Remix, Astro, or Svelte frameworks. This is the biggest coverage gap — the component/instance editing workflow (Component tab, Instance tab, variant props, style overrides) should be exercised on at least one more framework to catch framework-specific regressions.

2. **Astro + Tailwind — no demo or tests.** Astro is only tested with plain CSS scoped styles. An `astro-tailwind` demo would cover the Astro plugin + Tailwind write path combination.

### Unit/integration test coverage (good)

These areas are well-covered by `npm test` (327 tests):

- Tailwind class parsing & mapping (`tailwind-parser.test.ts`, `tailwind-map.test.ts`)
- CSS rule find/write (`write-css-rule.test.ts`)
- AST helpers for JSX manipulation (`ast-helpers.test.ts`, `find-element.test.ts`)
- Server write API — all write types including CSS modules, scoped styles, path traversal (`write-element.test.ts`)
- Tailwind theme resolution v3 + v4 (`resolve-tailwind-theme.test.ts`)
- Astro source transform (`astro-source-transform.test.ts`)
- Svelte source transform (`svelte-source-transform.test.ts`)
- Scoped style read/write (`scoped-style.test.ts`)
- Vite mount transform (`mount-transform.test.ts`)
- Safe path validation (`safe-path.test.ts`)

## Framework plugin matrix

| Plugin | Framework | Source annotation | Surface mount | Scoped styles |
|--------|-----------|-------------------|---------------|---------------|
| `next-plugin` | Next.js | Babel transform (`.tsx`/`.jsx`) | `withDesigntools()` config wrapper | N/A |
| `vite-plugin` | Vite, Remix | Vite `transform` hook (`.tsx`/`.jsx`) | `transformIndexHtml` injection | N/A |
| `astro-plugin` | Astro | `@astrojs/compiler` parse + string splice (`.astro`) + wraps vite-plugin for `.tsx` | `injectScript("page", ...)` | Yes — `<style>` blocks |
| `svelte-plugin` | SvelteKit | `svelte/compiler` parse (`.svelte`) + wraps vite-plugin for `.tsx` | `transformIndexHtml` injection | Yes — `<style>` blocks |
