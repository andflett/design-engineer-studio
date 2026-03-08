# Selection & Editability: Plan

Supplementary to the [direct manipulation plan](./direct-manipulation-plan.md). This work is independent of drag/drop, resize, and text editing mechanics — but it provides the **selection-level editability model** that all three features consume. Build this first or in parallel.

---

## The Problem

When you select an element that is both a component and an instance, the editor currently shows three tabs: Token | Component | Instance. Two problems:

1. **Both tabs show identical data.** The `ComputedPropertyPanel` receives the same `className`, `computedStyles`, and `authoredStyles` in both modes — all sourced from the rendered DOM element. The only difference is the write callback (`handleWriteElement` vs `handleInstanceOverride`). The user can't tell what they're editing because the panel looks the same either way.

2. **The file path never changes.** It always shows the component definition file (`element.source`), even in instance mode. The user has no visual confirmation that switching tabs changed their editing context.

The tab approach is also indirect — it's a panel-level concept that doesn't connect to what's happening on canvas. There's no feedback in the overlay itself about which mode you're in.

---

## The Solution

Replace the component/instance tabs with a **toggle on the selection overlay itself**, mirrored in the panel header. The toggle switches between two distinct data views:

### Component Mode
Shows the **authored styles from the component definition file**. This is a source-level read — what the developer wrote in the component, regardless of how any particular instance renders. The data comes from the server reading the component file's AST and associated stylesheets (CSS modules, scoped styles, Tailwind classes — whatever styling method the component uses).

- File path: component definition file
- Writes target: component definition file
- Available actions: variant editing, component class changes

### Instance Mode
Shows the **winning rendered styles on this specific instance**. This is what the panel does today — the runtime result from the DOM, including authored stylesheet values, computed fallbacks, and Tailwind class parsing. Additionally, values that are inherited from the component (not overridden by the instance) are visually marked as "from component" — present but de-emphasized, non-editable in instance mode.

- File path: instance usage site (the page file where `<Button className="...">` is written)
- Writes target: instance usage site
- Available actions: instance prop changes, instance style overrides, reset overrides

---

## Overlay UX

### Toggle on the Selection Overlay

When a selected element is both a component and an instance, the selection overlay shows a small toggle in the top-right corner:

- **Component icon** (filled diamond / component symbol) — switches to component mode
- **Instance icon** (outlined diamond / instance symbol) — switches to instance mode
- Active state is visually distinct (filled vs outlined, or highlighted background)
- Mirrors the existing Figma convention for component/instance badges

The toggle is **absent** when:
- The element is a plain HTML element (only `data-source`, no `data-slot`) — no toggle, just direct element editing
- The component comes from `node_modules` (has `packageName`, no editable `source`) — only instance mode available, no toggle. Show package name badge instead.

### Panel Header

The panel header mirrors the overlay toggle:
- Shows the same component/instance toggle icons
- Displays the correct file path for the active mode
- Element name adapts: component mode shows the component name (`Button`), instance mode shows `<Button>` with the instance context

### Editability Indicators

For **non-editable elements** (npm packages, elements without source):
- Overlay shows a lock icon or package badge instead of the toggle
- Panel shows "Inspect only" with the package name
- Properties are visible but read-only (current behaviour, unchanged)

---

## Element Editability Classification

This is the work currently scattered across the direct manipulation plan (reorder skipping expression containers, `classify-content.ts` for text editing, hover editability UX). It belongs here because it's fundamentally a **selection concern** — before any editing action is offered, we need to know what's authored and what's data-driven. The answer is the same whether you're trying to edit styles, reorder, resize, or change text.

### The Core Question

When you click on a rendered `<Card>` in the preview, the selection needs to determine:

1. **Is this instance authored or data-driven?** — Is the `<Card>` written literally in JSX, or is it rendered inside a `.map()` / `{#each}` / loop over dynamic data?
2. **What parts of this element are authored?** — Are its children static JSX, or are they expressions (`{item.title}`)? Are its props string literals or variable references?
3. **What can you actually change from here?** — If this card is one of N rendered from an array, you can't meaningfully reorder *this instance* or edit *this instance's text*. But you can always edit the *component definition*.

### Classification Model

When an element is selected, the server classifies it:

```typescript
type ElementEditability = {
  // Instance-level editability
  instance: {
    // Is this specific instance authored in the source?
    // false if it's rendered from a loop/map/iterator over dynamic data
    isAuthored: boolean;

    // What produced this instance if not authored directly
    dataSource?: {
      type: "map" | "each" | "for" | "iterator";  // the loop construct
      expression: string;                            // e.g. "products.map(...)", "{#each items}"
      dataOrigin?: string;                           // if detectable: "props", "fetch", "state", etc.
    };

    // Styles: can you add/override classes on this instance?
    // true if the instance JSX has (or can have) a className/class prop
    canOverrideStyles: boolean;

    // Children: classification of each child (text vs expression)
    // Pulled from what was classify-content in the drag-and-drop plan
    content: ContentClassification;

    // Children: can you reorder siblings?
    // false if children are expression containers (mapped data)
    canReorderChildren: boolean;

    // Props: which props are editable string literals vs expressions
    props: PropClassification[];
  };

  // Component-level editability (always present if this is a component)
  component?: {
    canEditStyles: boolean;     // true if source file is local (not node_modules)
    canEditContent: boolean;    // true if component has authored children/text
    canEditVariants: boolean;   // true if component uses a variant system (CVA/tv/etc)
    filePath: string;
    exportName: string;
  };
};
```

### How It's Determined

**Instance authored check (is this a `.map()` child?):**
- Read the source file at the instance's `data-source` location
- Walk up the AST from that element
- If the nearest ancestor expression is a `.map()` callback, `Array.from()`, or similar iterator → `isAuthored: false`
- For Svelte: check if element is inside `{#each ...}` block
- For Astro: check if element is inside `{items.map(...)}` expression
- If the element is a direct JSX child of a component/page → `isAuthored: true`

**Content classification (was `classify-content.ts` in the drag-and-drop plan):**
- Same logic, but runs as part of the selection classification, not as a separate endpoint
- `JSXText` / `StringLiteral` → editable text
- `JSXExpressionContainer` with non-literal → locked, show expression source
- For Svelte: `Text` vs `MustacheTag`
- For Astro: text vs `Expression`

**Prop classification (was phase 3E in the drag-and-drop plan):**
- For each attribute on the element, check if value is `StringLiteral` (editable) or expression (locked)
- Return both the value and the expression source for locked props

**Reorder check:**
- Look at the parent element's children in the AST
- If children are all authored JSXElements → reorderable
- If children include expression containers (`.map()`, spread, etc.) → not reorderable
- This replaces the `getReorderableChildren` check in the drag-and-drop plan — same logic, but evaluated once at selection time and cached

### What This Replaces in the Direct Manipulation Plan

| Original location | What it did | Now lives here as |
|---|---|---|
| Feature 1, Phase 1A: `getReorderableChildren` skips `JSXExpressionContainers` | Checked if children are reorderable | `instance.canReorderChildren` |
| Feature 1: Hover & Editability UX | "If container is non-reorderable: no affordance" | Overlay reads `canReorderChildren` from classification |
| Feature 3, Phase 3A: `POST /api/classify-content` | Classified children as text vs expression | `instance.content` (same `ContentClassification` type) |
| Feature 3, Phase 3E: Prop classification | Classified props as editable vs expression | `instance.props` |
| Feature 3: Hover & Editability UX | "Fully dynamic: shows tooltip with expression" | Overlay reads `instance.content.fullyDynamic` |

The drag-and-drop plan's features still own their **action mechanics** (the actual reorder, resize, text edit). They just consume the editability classification from the selection layer rather than computing it themselves.

### Endpoint

**`GET /api/classify-element?file=...&line=...&col=...`**

- Single endpoint, called once on selection (prefetched alongside `component-styles`)
- Response cached by file + line:col + mtime (same cache strategy as component styles)
- Returns `ElementEditability`
- Consumed by:
  - The component/instance toggle (determines if toggle appears and what modes are available)
  - The overlay (what affordances to show: drag handles, text edit cursor, lock icons)
  - The panel (what sections to render, what's editable, what shows "bound to `{expression}`")
  - Each direct manipulation feature (reorder checks `canReorderChildren`, text edit checks `content.editable`, etc.)

### UX Implications

**Data-driven instance selected (`.map()` child):**
- Overlay shows the element with a data-source badge: `"from products.map()"`
- Instance mode is inspect-only for content and reordering (styles can still be overridden if the component accepts className)
- Component mode is fully available — "Edit the component that renders these"
- No drag handles on siblings (they're all data-driven)
- No text edit cursor (text comes from data)
- Panel shows: "This element is rendered from `products.map()`. Editing the content or order requires changing the data source. You can edit the component definition or override styles on this instance."

**Authored instance selected (directly written in JSX):**
- Full instance editing: styles, text (if static), reorder (if siblings are authored)
- Component mode available for editing the underlying component
- All affordances shown based on content classification

**npm package component:**
- Instance mode only, inspect + style override
- No component mode (source not local)
- Package badge on overlay

---

## Data Architecture

### Current State

Both modes receive identical data from the iframe:

```
SelectedElementData {
  className: "flex p-4 text-red-500 mt-8"  // merged from component + instance
  computed: { display: "flex", ... }         // getComputedStyle() — final cascade
  authored: { padding: "1rem", ... }         // from matching stylesheet rules — merged
  source: { file: "button.tsx", line: 5 }   // component definition
  instanceSource: { file: "page.tsx", line: 12 }  // usage site
}
```

### New: Component-Authored Styles Endpoint

**`GET /api/component-styles?file=...&line=...&col=...`**

New server endpoint that reads the component definition file and extracts authored styles from source. Returns the styles the component defines on its root element, independent of any particular instance.

#### What It Extracts (by styling method)

**Tailwind classes (className attribute):**
- Parse the JSX element at the source location
- Extract `className` attribute value via `findAttr()`
- For string literals: parse directly
- For expressions (`cn()`, `clsx()`, ternaries): extract the static base classes (the always-applied ones). Variant-conditional classes are returned separately with their conditions.
- Run through `parseClasses()` to get structured CSS property → value mapping

**CSS modules:**
- `findCssModuleImports()` already identifies module imports in the file
- Resolve which module class is applied to this element (`resolveModuleClassNames()`)
- Read the `.module.css` file and extract all CSS properties from the matching rule
- Return as authored key-value pairs: `{ "padding": "1rem", "color": "var(--primary)" }`

**Scoped styles (Svelte/Astro):**
- `sfc-parse.ts` already extracts `<style>` blocks and element class lists
- Find scoped CSS rules that match the element's classes
- Extract authored properties from matching rules
- Return as authored key-value pairs

**Inline style prop:**
- Extract `style` attribute from JSX/template AST
- Parse object expression to key-value pairs

**Response shape:**

```typescript
type ComponentAuthoredStyles = {
  // CSS properties authored on this element, with their source values
  properties: Record<string, {
    value: string;              // as written: "1rem", "var(--space-4)", "p-4", etc.
    source: "class" | "css-module" | "scoped-style" | "inline-style";
    tailwindClass?: string;     // if from a Tailwind class, the full class string
  }>;

  // Variant-conditional styles (from CVA/tv/etc)
  variantStyles?: Array<{
    variantName: string;
    variantValue: string;
    properties: Record<string, string>;
  }>;
};
```

#### Caching

- Cache by file path + line:col + file mtime
- Invalidate on HMR (file change notification)
- Component files change infrequently — this cache will have high hit rates

### Instance Attribution

In instance mode, the panel needs to show which values are inherited from the component vs overridden by the instance. This uses both data sources:

1. Fetch `ComponentAuthoredStyles` for the component (same endpoint, cached)
2. Use the existing runtime data (`authored`, `computed`, `className`) from the iframe
3. For each CSS property in the panel:
   - If the instance's value differs from the component's authored value → **overridden** (highlight, editable)
   - If the instance's value matches the component's authored value → **inherited from component** (de-emphasised, shows "from Component" label, not directly editable in instance mode)
   - If the property exists in the instance but not in the component → **instance-added** (editable, shown normally)
   - If the property exists in the component but the instance has removed/reset it → edge case, probably rare

This diffing happens client-side in the editor — it already has both datasets.

---

## Implementation

### Phase 1: Element Classification Endpoint

**File: `packages/surface/src/server/api/classify-element.ts` (new)**

- `GET /api/classify-element?file=<path>&line=<n>&col=<n>`
- Parse file, find element at source location
- Walk up AST to check for `.map()` / `{#each}` / iterator ancestors → sets `instance.isAuthored`
- Classify children (text vs expression) → `instance.content`
- Classify props (string literal vs expression) → `instance.props`
- Check parent's children for reorderability → `instance.canReorderChildren`
- Return `ElementEditability`
- Cache by file + line:col + mtime

**File: `packages/surface/src/server/lib/ast-helpers.ts` (extend)**

Add: `classifyElement(ast, line, col, source: string): ElementEditability`
- Consolidates `classifyJSXChildren`, `getReorderableChildren`, and the loop-ancestor check
- Framework variants for Svelte (`{#each}` blocks, `MustacheTag`) and Astro (expression nodes)
- Dispatcher: `classifyElement(filePath, line, col)` — picks parser based on file extension

### Phase 2: Component Styles Endpoint

**File: `packages/surface/src/server/api/component-styles.ts` (new)**

- `GET /api/component-styles?file=<path>&line=<n>&col=<n>`
- Parse the file with appropriate parser (Babel for JSX/TSX, `svelte/compiler` for .svelte, `@astrojs/compiler` for .astro)
- Find element at source location
- Extract styles from all sources:
  - `findAttr(element, "className")` → parse Tailwind classes or resolve CSS module references
  - `findAttr(element, "style")` → parse inline style object
  - For SFC: `sfc-parse` to find matching scoped style rules
  - `findCssModuleImports()` + `resolveModuleClassNames()` for CSS modules
  - Read referenced CSS files and extract matching rule properties
- Return `ComponentAuthoredStyles`

**File: `packages/surface/src/server/lib/ast-helpers.ts` (extend)**

Add: `extractElementStyles(ast, line, col, source: string)`:
- Finds element, extracts className value (handling string literals, expressions, function calls)
- Returns raw className string for Tailwind parsing, or resolved module class references
- Handles the expression complexity (cn/clsx calls, ternaries) by extracting static base arguments

**Framework dispatch:** check file extension, route to JSX/Svelte/Astro parser (same pattern as existing transforms).

### Phase 3: Selection Overlay Toggle

**File: `packages/surface/src/client/components/selection-overlay.tsx` (new or extend existing)**

- When selected element has both `source` and `instanceSource` (is a component + instance):
  - Render toggle icons in top-right corner of the selection overlay border
  - Component icon / Instance icon, mutually exclusive
  - Click toggles `selectionMode: "component" | "instance"` state
- When element is plain HTML (no `data-slot`): no toggle
- When element is npm package (has `packageName`, no `source`): no toggle, show package badge

**File: `packages/surface/src/shared/protocol.ts` (extend)**

No new iframe messages needed. The toggle is purely editor-side state. The iframe selection doesn't change — same DOM element stays selected.

### Phase 4: Panel Data Switching

**File: `packages/surface/src/client/components/editor-panel.tsx` (modify)**

Replace the tab system with mode-aware rendering:

**State:**
```typescript
const [selectionMode, setSelectionMode] = useState<"component" | "instance">("instance");
```

Auto-set on element selection: default to "instance" (most common intent is editing this specific usage).

**Loading & transition behaviour:**

Switching to component mode triggers a server fetch (`GET /api/component-styles`). Even though the response is fast (AST parse + cache), it's async and the panel needs to handle the gap:

- **Skeleton loading state.** When `selectionMode` switches to `"component"` and data hasn't arrived yet, the property panel shows skeleton placeholders in place of property rows. Not a spinner — skeletons in the shape of the property rows (label + value pill), so the layout doesn't jump. Same skeleton treatment if the fetch errors and retries.
- **Keep previous data while loading instance attribution.** In instance mode, the runtime data from the iframe is already available (no fetch needed for the primary view). The component-authored data fetch for attribution markers is additive — render the instance properties immediately, then layer in the "from component" / "overridden" markers when the attribution data arrives. Properties render without attribution initially, then fade in the markers. No skeleton needed for this — the panel is already populated.
- **Prefetch on selection.** When an element is selected and it's a component instance, kick off the `component-styles` fetch immediately in the background — don't wait for the user to toggle. By the time they switch to component mode, the data is likely already cached. This also means instance-mode attribution markers appear faster.
- **Error state.** If the endpoint fails (file deleted, parse error), show an inline error in the panel body: "Could not read component styles" with a retry action. Don't fall back to instance data in component mode — that would be misleading.
- **Transition feel.** The toggle itself should feel instant (active state changes on click, not on data arrival). The panel content transitions with a brief crossfade (~100ms) between modes. If component data is already cached, the crossfade is the only delay the user perceives.

**Component mode active:**
- Fetch from `GET /api/component-styles` using `element.source`
- Pass component-authored data to the property panel instead of runtime data
- File path shows component definition file
- `onCommitClass` routes to `handleWriteElement(element.source, ...)`
- `onCommitStyle` routes to `handleWriteStyle(element.source, ...)`
- Show variant editing (existing `ComponentVariantSection`) below styles

**Instance mode active:**
- Use existing runtime data from iframe (`className`, `authored`, `computed`)
- Also fetch component-authored data (for attribution — "inherited from component" markers)
- File path shows instance usage site (`element.instanceSource`)
- `onCommitClass` routes to `handleInstanceOverride(element.instanceSource, ...)`
- Properties inherited from component are marked and de-emphasised

**Remove:** The three-tab system (`token | component | instance`). Token editing moves to a separate access point (it's not element-selection-dependent).

### Phase 5: Instance Attribution UI

**File: `packages/surface/src/client/lib/style-attribution.ts` (new)**

Client-side diffing logic:

```typescript
function attributeStyles(
  instanceProperties: UnifiedProperty[],       // from runtime (current panel data)
  componentAuthored: ComponentAuthoredStyles,   // from server endpoint
): AttributedProperty[] {
  return instanceProperties.map(prop => {
    const componentValue = componentAuthored.properties[prop.cssProperty];
    if (!componentValue) {
      return { ...prop, attribution: "instance-added" };
    }
    if (valuesMatch(prop, componentValue)) {
      return { ...prop, attribution: "inherited", componentSource: componentValue };
    }
    return { ...prop, attribution: "overridden", componentSource: componentValue };
  });
}
```

**File: `packages/surface/src/client/components/computed-property-panel.tsx` (extend)**

- Accept optional `attribution` data
- For `"inherited"` properties: render with reduced opacity, "from Component" label, click-to-edit disabled (or click shows "edit in component mode" prompt)
- For `"overridden"` properties: render normally with a small indicator showing the component's original value (tooltip or inline chip)
- For `"instance-added"` properties: render normally, no special indicator

### Phase 6: Token Tab Relocation

The token tab is currently part of the three-tab system being removed. Tokens aren't element-specific — they're global design system values.

Options (to be decided):
- Move to a separate panel/section accessible from the sidebar
- Show as a collapsible section at the bottom of the property panel
- Keep as a mode but separate from the component/instance toggle

This is a minor UI reorganisation, not a data architecture change.

---

## What Changes Where

| Location | Change |
|----------|--------|
| **Server** | New `GET /api/classify-element` endpoint (editability classification) |
| **Server** | New `GET /api/component-styles` endpoint (authored styles from source) |
| **AST helpers** | New `classifyElement()` and `extractElementStyles()` functions |
| **Selection overlay (canvas)** | Add component/instance toggle, data-source badges, editability affordances |
| **Panel header** | Mirror toggle, show correct file path per mode |
| **Panel body** | Switch data source: server-provided component styles vs runtime instance styles |
| **Protocol** | No changes — toggle and classification are editor-side state |
| **Iframe (surface.tsx)** | No changes — same element stays selected |
| **Tab system** | Removed, replaced by overlay/header toggle |
| **Direct manipulation plan** | Remove `classify-content.ts`, hover editability UX — consumed from here |

---

## Dependency on Other Work

**This plan provides infrastructure the direct manipulation plan consumes.** The `classify-element` endpoint and `ElementEditability` model replace scattered editability checks across all three drag-and-drop features. The direct manipulation plan's features still own their action mechanics — the reorder, resize, and text edit implementations — but they read editability from the selection layer rather than computing it per-feature.

Specifically, the direct manipulation plan should be updated to:
- Remove `POST /api/classify-content` (Phase 3A) — replaced by `GET /api/classify-element`
- Remove `getReorderableChildren`'s editability logic (Phase 1A) — reorder reads `canReorderChildren` from selection state
- Remove the hover editability UX sections from Features 1 and 3 — the overlay reads classification from selection state
- Keep all action endpoints: `POST /api/reorder-children`, `POST /api/write-text`, resize handles, etc.

**Shared infrastructure:** The `extractElementStyles` function builds on the same AST helpers used by the write pipeline and would be used by the resize handles (Feature 2) to understand what sizing values the component authors vs what the instance overrides. The `classify-element` endpoint uses the same AST traversal patterns already in `find-element.ts` and `ast-helpers.ts`.
