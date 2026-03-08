# CSS Styling Guidelines

## Where to write changes

1. **CSS Modules** — if the element uses a `.module.css` import (e.g., `styles.card`), edit the corresponding `.foo {}` rule in the module file
2. **Project stylesheets** — if the element uses a global class, find the matching rule in the project's CSS files and edit the property there
3. **Inline styles** — only add `style={{ property: value }}` as a last resort when no CSS rule can be found

## CSS property rules

- Edit the existing property value inside the existing rule — do not add a new rule if one already exists
- Preserve specificity: do not add `!important` unless the existing rule already uses it
- Preserve CSS custom property references: if a value uses `var(--token)`, update the token value in the `:root` or `@theme` block, not the computed value
- Use shorthand properties consistently with what is already in the file (e.g., if file uses `padding: 8px 16px`, don't switch to `padding-top: 8px; padding-left: 16px;`)

## CSS variables / design tokens

- If the project uses CSS custom properties (e.g., `--color-primary`, `--spacing-md`), prefer updating the token value at its definition rather than overriding it at the selector
- Maintain the same unit type as the existing value (px → px, rem → rem, % → %)

## Scoped styles (.astro / .svelte)

- For `.astro` files: edit the `<style>` block within the same file
- For `.svelte` files: edit the `<style>` block within the same file
- Do not move scoped styles to a separate stylesheet
