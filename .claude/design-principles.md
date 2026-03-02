# Surface: Design Principles

Guiding principles for development. These aren't aspirational — they're constraints that should influence every PR.

---

## 1. Write reliability is the product

The #1 reason a developer will uninstall Surface is a bad `git diff`. Every write adapter must produce changes that look like a human wrote them:

- **Preserve formatting.** Use AST transforms (recast) that maintain the author's style — indentation, quote style, trailing commas. Never reformat surrounding code.
- **Predictable diffs.** A single property change should produce a single-line diff. No cascading reformats, no surprise whitespace changes.
- **No file corruption.** Partial writes, encoding issues, or mangled syntax are unacceptable. If a write can't be done cleanly, fail explicitly rather than write garbage.
- **Clear change visibility.** The user should always be able to `git diff` and immediately understand what Surface changed and why.
- **Easy revert.** Every change should be revertable with a simple `git checkout`. Never write to multiple files atomically in a way that makes partial reverts dangerous.

This applies to every write adapter — Tailwind class replacement, CSS property edits, token value changes, component variant writes. Each new adapter gets judged by: "would I accept this PR?"

## 2. Systems, not screens

Surface encourages design-system thinking rather than freeform pixel pushing:

- **Tokens over magic numbers.** The UI should make it easy to use existing tokens and hard to introduce arbitrary values. Show the token scale first, arbitrary input second.
- **Component-level edits over instance overrides.** When a user edits a component instance, surface the option to edit the component definition instead (affecting all instances).
- **Constraints are features.** Limiting edits to what the styling system supports (Tailwind scale, CSS variable values, component variants) prevents drift from the design system.

## 3. The protocol is the API — keep it agnostic

The postMessage protocol between editor and target app uses CSS property/value pairs as the universal primitive. It must never reference a specific styling system:

- **No Tailwind classes in messages.** The protocol speaks CSS. Styling system translation happens at write time, on the server.
- **Framework plugins are interchangeable.** A Vite plugin, Nuxt plugin, or SvelteKit plugin should all populate the same `ComponentTreeNode[]` shape and respond to the same message types.
- **Hints are optional.** The `hint` field on `StyleChange` carries styling-system metadata (e.g. `tailwindClass`). Adapters that don't need hints ignore them.

## 4. Works on the app you already have

Surface's moat is working on real, messy production codebases — not just clean greenfield projects:

- **Multi-system support.** Don't assume Tailwind. The editor UI and write system must dispatch by detected styling system. If we detect 6 systems but only write for 1, we've broken the promise.
- **No project modifications required.** `data-source` attributes are injected at compile time. The user's source files are never touched for instrumentation. `data-slot` is opt-in enrichment, not a requirement.
- **Graceful degradation.** If detection fails, prompt for overrides. If a write adapter doesn't exist for the detected system, say so clearly rather than silently doing nothing.

## 5. Local-first is an advantage

- **No cloud dependency.** Everything runs on the developer's machine. No accounts, no telemetry, no network calls beyond localhost.
- **No build step required for the target app.** Surface works with the app's existing dev server. We don't bundle, compile, or sandbox the target app ourselves.
- **Fast startup.** The CLI should be ready in seconds, not minutes. Scan results are cached. The editor connects to the running dev server immediately.

## 6. Editor UI conventions

- **Figma-style property controls.** Developers and designers both understand this visual language. Scale dropdowns, scrub-to-adjust numeric inputs, color swatches with popovers.
- **Dark theme only** for the editor chrome. CSS variables prefixed `--studio-*`.
- **Radix primitives for all overlays.** Popovers, tooltips, selects — use `@radix-ui` components. Never hand-roll positioning/dismiss logic.
- **The shared color picker** (`color-picker.tsx`) is the only color input. Never use native `<input type="color">`.

## 7. Keep the target app fast

The `<Surface />` component lives inside the user's running app. It must not degrade their development experience:

- **No layout shifts.** Overlays are fixed-position and don't affect document flow.
- **No heavy dependencies.** The component is self-contained — no design system libraries, no state management, no CSS framework.
- **Passive until activated.** Selection mode listeners are lightweight. Heavy work (fiber walking, tree extraction) only happens on demand.
- **Clean removal.** In production builds, the component and all instrumentation are stripped entirely. Zero runtime cost.
