# Tailwind v3 Styling Guidelines

## Class application

- Use Tailwind utility classes to apply styles — never add inline `style` attributes unless explicitly instructed
- Prefer named scale values (e.g., `p-4`, `text-lg`) over arbitrary values (e.g., `p-[16px]`, `text-[18px]`)
- Use the project's design tokens from `tailwind.config.js` when available

## Tailwind v3 specifics

- Tailwind v3 uses `tailwind.config.js` (or `.ts`) for theme configuration
- Colors, spacing, and other scales may be extended or overridden in the config
- JIT mode is default — arbitrary values with `[]` syntax are supported
- Responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
- Dark mode: `dark:` prefix (check config for `darkMode` strategy)
- The `@apply` directive may be used in stylesheets — prefer utility classes over `@apply` additions

## Class replacement rules

- When replacing a class, remove the old class and add the new one — never duplicate
- When adding a breakpoint variant, append it alongside the base class (e.g., keep `p-4` and add `md:p-8`)
- Preserve all existing class variants (hover, focus, dark, responsive) that are not being changed

## Common patterns

- Spacing: `p-{n}`, `px-{n}`, `py-{n}`, `m-{n}`, `mx-{n}`, `my-{n}`, `gap-{n}`
- Sizing: `w-{n}`, `h-{n}`, `max-w-{n}`, `min-h-{n}`
- Typography: `text-{size}`, `font-{weight}`, `leading-{n}`, `tracking-{n}`
- Colors: `text-{color}-{shade}`, `bg-{color}-{shade}`, `border-{color}-{shade}`
- Flexbox: `flex`, `flex-col`, `items-{align}`, `justify-{align}`, `flex-{n}`
- Grid: `grid`, `grid-cols-{n}`, `col-span-{n}`
- Border: `border`, `border-{n}`, `rounded-{n}`
