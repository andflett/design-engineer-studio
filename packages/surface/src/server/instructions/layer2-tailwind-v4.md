# Tailwind v4 Styling Guidelines

## Class application

- Use Tailwind utility classes to apply styles — never add inline `style` attributes unless explicitly instructed
- Prefer named scale values (e.g., `p-4`, `text-lg`) over arbitrary values (e.g., `p-[16px]`, `text-[18px]`)
- Use the project's design token variables when available (e.g., `bg-[var(--color-primary)]`)

## Tailwind v4 specifics

- Tailwind v4 uses CSS `@theme` blocks — tokens are CSS custom properties, not JS config values
- Spacing, color, and sizing scales are defined in the project's CSS file, not `tailwind.config.js`
- Responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
- Dark mode: `dark:` prefix
- Arbitrary values use square brackets: `w-[320px]`, `grid-cols-[1fr_2fr]`

## Class replacement rules

- When replacing a class, remove the old class and add the new one — never duplicate
- When adding a breakpoint variant, append it alongside the base class (e.g., keep `p-4` and add `md:p-8`)
- Preserve all existing class variants (hover, focus, dark, responsive) that are not being changed

## Common patterns

- Spacing: `p-{n}`, `px-{n}`, `py-{n}`, `m-{n}`, `mx-{n}`, `my-{n}`, `gap-{n}`
- Sizing: `w-{n}`, `h-{n}`, `max-w-{n}`, `min-h-{n}`
- Typography: `text-{size}`, `font-{weight}`, `leading-{n}`, `tracking-{n}`
- Colors: `text-{color}`, `bg-{color}`, `border-{color}`
- Flexbox: `flex`, `flex-col`, `items-{align}`, `justify-{align}`, `flex-{n}`
- Grid: `grid`, `grid-cols-{n}`, `col-span-{n}`
- Border: `border`, `border-{n}`, `rounded-{n}`
