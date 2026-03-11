# Direct Manipulation Features: Plan

## What This Tool Is and What It Is Not

### What Surface Is

Surface is a **source-code-aware design editor**. Every change it makes is a real edit to a real source file — a Tailwind class added, a CSS property written, a JSX child reordered. The output is production code that a developer wrote, just faster.

### What Surface Is Not

Surface is not a page builder. It is not Webflow, Framer, or Wix. Those tools generate markup from a visual canvas — the source of truth is the visual layout, and code is an export artifact. Surface is the opposite: **code is the source of truth**, and the visual interface is a faster way to edit it.

This distinction matters for three reasons:

1. **No absolute positioning.** Page builders let you pixel-push elements anywhere. Surface respects the layout model your code already uses. If a container is `flex`, children reorder within flex. If it's `grid`, children reorder within grid. There is no "drag anywhere" mode because that would mean generating `position: absolute; top: 237px; left: 412px` — which no production codebase should contain.

2. **No dummy elements.** A dragged-in `<div>` with no purpose is technical debt the moment it lands in your source file. Surface doesn't insert arbitrary HTML. (A future phase could insert *design system components* — real `<Button>`, `<Card>`, etc. — but that's explicitly out of scope here.)

3. **No data fabrication.** Text editing only touches hardcoded string literals in your source code. If a heading says `{product.title}`, Surface won't let you change it to `"My Cool Product"` — because that's not editing a design, that's breaking a data binding. Surface shows you *why* the text isn't editable and *where* it comes from.

### Why These Constraints Exist

Designers will want to pixel-push. That's a valid workflow — in Figma. Surface's job is different: it's the bridge from design *to* code, not a replacement for either. The constraints aren't limitations; they're what make the output trustworthy. A developer can merge a Surface change without reviewing every line, because they know it won't have injected layout hacks or broken data bindings.

---

## AI Mode Behaviour (applies to all three features)

Surface has two write modes, toggled by the `WriteMode` switch in the editor footer:

- **Deterministic mode**: changes write immediately to the source file via the existing API endpoints. HMR picks them up.
- **AI mode**: changes accumulate as `ChangeIntent` objects. The user reviews the queue, then hits "Apply" to inject context into the Claude terminal. Claude makes the actual file edits.

**All three features respect this toggle without exception.** There is no per-feature override. This keeps the mode switch meaningful and predictable.

### How Each Feature Queues in AI Mode

| Feature | `ChangeIntent.type` | Key fields |
|---------|--------------------|----|
| Flex/Grid reorder | `"reorder"` | `fromIndex`, `toIndex`, `parentSource`, `siblingTags` |
| Resize width/height | `"class"` or `"style"` | existing fields — no change needed |
| Inline text edit | `"text"` | `childIndex`, `fromValue`, `toValue` |

### Live Preview in AI Mode

For resize and text editing, the iframe's inline style preview (`tool:previewInlineStyle`) is kept visible after the change is queued — the user sees their intended change immediately. The preview is only reverted when:
- Claude successfully applies the change (HMR fires, element re-renders with real classes/values)
- The user manually removes the `ChangeIntent` from the queue (chip × button)
- (Previews do **not** revert when the user selects a different element)

For reordering, there is no inline style preview (it's a structural change). In AI mode, the drag completes visually in the overlay (siblings animate to show the new order), but the actual DOM in the iframe doesn't change until Claude applies it.

### Queued Intent Indicators

Elements with one or more queued intents are highlighted subtly in the iframe overlay — a faint accent-coloured border or dot indicator on the element's bounding box — so the user can see at a glance which elements have pending changes. Without this, the queue becomes invisible once you navigate to another element.

Implementation: the editor maintains a set of `elementSource` keys for all pending intents. When rendering the selection/hover overlay, any element whose `data-source` matches a queued intent key gets the indicator applied. A new `EditorToIframe` message — `tool:setQueuedSources` — sends the full set of source keys whenever the queue changes. The iframe overlay renders the indicators.

### Intent Deduplication

Re-editing a property that already has a queued intent **replaces** the existing intent rather than appending a new one. The matching key is `(elementSource file+line+col, type, property/childIndex)`:

- **class/style/prop**: match on `elementSource` + `property`. Replacing a queued `padding: p-4` with `p-8` updates the existing chip, it does not add a second padding intent.
- **text**: match on `elementSource` + `childIndex`. Re-editing the same text segment replaces the queued value.
- **reorder**: match on `parentSource`. Dragging again in the same container replaces the queued reorder (last drag wins).

The preview in the iframe is updated to reflect the replacement value.

---

## `ChangeIntent` Extensions

**File: `packages/surface/src/shared/protocol.ts`**

Extend the existing `ChangeIntent` union to cover two new change types:

```typescript
/** Existing fields on all ChangeIntent variants */
interface ChangeIntentBase {
  elementSource: SourceLocation;
  currentClassName: string;
}

export type ChangeIntent =
  | (ChangeIntentBase & {
      type: "class" | "style" | "prop";
      property: string;
      fromValue: string;
      toValue: string;
    })
  | (ChangeIntentBase & {
      type: "reorder";
      parentSource: SourceLocation;
      fromIndex: number;
      toIndex: number;
      /** Tag names of all siblings, for AI context: ["<NavItem>", "<NavItem>", "<NavItem>"] */
      siblingTags: string[];
    })
  | (ChangeIntentBase & {
      type: "text";
      /** Child index within the JSX parent (same as write-text API) */
      childIndex: number;
      fromValue: string;
      toValue: string;
    });
```

The `buildChangesContext()` function in `terminal-panel.tsx` already formats intents as text for Claude. It needs updating to format the two new types as natural-language instructions — Claude acts on this text, so clarity beats brevity:

- **reorder**: `"In file:line, reorder the children of <nav>: move child at index 2 (<NavItem>) to index 0. Siblings in current order: [<Logo>, <NavLinks>, <NavItem>]."`
- **text**: `"In file:line, change the text content of child at index 1 inside <button> from \"Save\" to \"Save changes\"."`

The existing `class`/`style`/`prop` format (`property: fromValue → toValue`) is preserved — it's unambiguous for those types.

---

## Feature 1: Flex/Grid Child Reordering

### What It Does

When a user selects an element inside a `flex` or `grid` container, they can drag it to reorder among its siblings. In deterministic mode, the drag reorders JSX children in the source file immediately. In AI mode, it queues a `"reorder"` intent for Claude to apply.

### Hover & Editability UX

When hovering over an element in a flex/grid container:
- Siblings show subtle drag-handle icons (grip dots) to indicate reorderability
- Parent container gets a faint border/badge showing its layout mode ("flex row", "grid")
- If the container is `block` or non-reorderable: no drag handles shown, no affordance — the feature is simply absent, not disabled-looking

### Behaviour Rules

| Parent Display | Allowed? | Drag Axis |
|---|---|---|
| `flex` (row) | Yes | Horizontal |
| `flex` (column) | Yes | Vertical |
| `grid` | Yes | Both (grid position) |
| `block` / `inline` / other | No | — |

- Only direct children of the flex/grid container are draggable
- Dragging across component boundaries (different source files) is not allowed
- Elements whose source location is in `node_modules` are not draggable
- If children span multiple source files (e.g. layout composing page content), reorder is disabled

### Library

**@dnd-kit/core + @dnd-kit/sortable** — install in `packages/surface`.

dnd-kit runs in the **editor UI** (the Surface SPA at :4400), not in the iframe. The iframe overlay provides coordinates; the editor provides the drag interaction. This avoids polluting the target app's DOM with drag library artifacts.

### Implementation

#### Phase 1A: Detect Reorderable Containers

**File: `packages/surface/src/server/api/reorder-element.ts` (new)**

New server endpoint `POST /api/reorder-children`:
- Receives: `{ source: { file, line, col }, fromIndex: number, toIndex: number }`
- Parses the source file, finds the JSX element at source location
- Validates: element must have >1 JSX child that are JSXElements (not expressions, not fragments)
- Reorders children in the AST using Recast (move child node from `fromIndex` to `toIndex`)
- Preserves whitespace/formatting between children
- Writes file back, HMR picks it up

This endpoint is only called in **deterministic mode**. In AI mode, the client never calls it — the intent is queued instead.

**File: `packages/surface/src/server/lib/ast-helpers.ts` (extend)**

Add helper: `getReorderableChildren(ast, line, col)`:
- Find element at source location
- Return its JSX children that are JSXElements (with their source locations and tag names)
- Skip JSXText (whitespace), JSXExpressionContainers (mapped data)
- Return `null` if fewer than 2 reorderable children

Add helper: `reorderJSXChildren(ast, line, col, fromIndex, toIndex)`:
- Find element, get its children array
- Perform the splice (remove at fromIndex, insert at toIndex)
- Handle whitespace nodes between children (keep them properly distributed)

#### Phase 1B: Iframe — Expose Sibling Geometry

**File: `packages/vite-plugin/src/surface.tsx` (extend)**

When an element is selected, also send sibling information for the parent container:

Extend the `elementSelected` message (or add a new `reorderableContext` message) with:
```typescript
{
  parentSource: SourceLocation;
  parentDisplay: string;             // "flex" | "grid"
  parentFlexDirection: string;       // "row" | "column"
  siblings: Array<{
    index: number;
    domPath: string;
    boundingRect: DOMRect;
    tag: string;
    textContent: string;             // for label in drag preview
  }>;
}
```

Only send this when parent's computed `display` is `flex` or `grid` and there are 2+ element children.

**File: `packages/surface/src/shared/protocol.ts` (extend)**

Add `ReorderableContext` type and include it as optional field on `SelectedElementData`, or as a separate `IframeToEditor` message type.

Add new `EditorToIframe` message: `tool:reorderComplete` — tells iframe to re-select the moved element at its new position after HMR (deterministic mode only).

#### Phase 1C: Editor — Drag Interaction

**File: `packages/surface/src/client/components/reorder-overlay.tsx` (new)**

A React component rendered in the editor UI that:
1. Reads `reorderableContext` from the selected element state
2. Renders transparent drag handles over each sibling (positioned using bounding rects from iframe, translated to editor viewport coordinates)
3. Uses `@dnd-kit/sortable` with `SortableContext` for the sibling list
4. Constrains drag axis based on `parentFlexDirection` (horizontal for row, vertical for column)
5. Shows insertion indicator (line between siblings) during drag
6. On drop:
   - **Deterministic mode**: calls `POST /api/reorder-children`, then sends `tool:reorderComplete` to iframe
   - **AI mode**: pushes a `ChangeIntent` of `type: "reorder"` onto the pending changes queue; shows the new order in the overlay only (iframe DOM unchanged until Claude applies it)

**File: `packages/surface/src/client/components/editor-panel.tsx` (extend)**

- When `reorderableContext` is present, render `<ReorderOverlay>` alongside existing selection overlay
- Show subtle drag-handle icons on siblings when the parent container is selected
- Add visual indicator on the parent showing "Reorderable" badge (flex/grid icon)
- Pass `writeMode` and `onAddChangeIntent` down to `<ReorderOverlay>`

#### Framework Notes

- **Svelte/Astro**: The server-side reorder uses Babel for JSX. For `.svelte` files, use `svelte/compiler` to parse and locate children, then string-splice to reorder (same pattern as `svelte-source-transform.ts`). For `.astro` files, use `@astrojs/compiler`. The iframe side is framework-agnostic (pure DOM bounding rects + `data-source` attributes).
- Create a `getReorderableChildrenSvelte()` and `getReorderableChildrenAstro()` variant, or a single function that dispatches on file extension (like the source transforms already do).

---

## Feature 2: Resize Handles + Sizing Panel

### What It Does

Two related changes:

1. **Resize handles on canvas** — When an element is selected, show drag handles on the right edge, bottom edge, and corner. Dragging changes `width` / `height` by writing Tailwind classes (or CSS properties). Values snap to the Tailwind spacing/sizing scale.

2. **Always-visible sizing panel** — The current `SizeSection` only shows width/height/min/max when a Tailwind class is already set (the `sizeOnly` guard in `buildUnifiedProperties` skips them otherwise). Fix: always show width, height, min-width, min-height, max-width, max-height — with empty/placeholder state when unset — using token-aware scale inputs.

### Current Problem (Sizing Panel)

In `computed-styles.ts`, the property building logic has this pattern:

```typescript
if (sizeOnly) {
  // Skip size properties not set via class — computed values are noise
  continue;
}
```

And in `SizeSection`:
```typescript
const active = properties.filter((p) => p.hasValue);
```

This means: no `w-*` class set → no width control shown → user has to know to type `w-64` manually. The panel should always show sizing controls so users can *discover* and *set* dimensions visually.

### Behaviour Rules (Resize Handles)

- Resize writes `w-*` / `h-*` classes (Tailwind) or `width` / `height` CSS properties
- Values snap to the nearest Tailwind scale value (e.g., `w-64`, `h-12`). If between two scale values, show both with a "ruler" and snap to nearest on release
- Holding a modifier key (Alt/Option) allows arbitrary values: `w-[347px]`
- If an element has `max-w-*` or `min-w-*`, show those as secondary snap points
- Resize respects the layout context: resizing a flex child that's `flex-1` should switch to a fixed width (warn the user)
- Elements with `w-full` or `h-full` show the handle but visually indicate "100% of parent" — dragging overrides to a fixed value

### AI Mode Behaviour

The resize drag always shows live `tool:previewInlineStyle` feedback (works the same in both modes). On release:

- **Deterministic mode**: determines the best Tailwind class, calls `handleWriteClass()`, then `tool:revertInlineStyles`
- **AI mode**: determines the best Tailwind class, pushes a `ChangeIntent` of `type: "class"` (or `type: "style"` in CSS mode) onto the pending queue — the inline style preview is **kept** so the user sees their intended change, and `tool:revertInlineStyles` is NOT called

The inline style preview is only reverted when:
- Claude applies the change and HMR fires (the real class is now applied)
- The user removes the intent chip from the queue

### Implementation

#### Phase 2A: Sizing Panel Overhaul

**File: `packages/surface/src/client/lib/computed-styles.ts` (modify)**

Remove the `sizeOnly` skip guard. Size properties should always be included in the unified properties list, even when no class is set. Instead of skipping, mark them with `hasValue: false` so the UI can show them in an "unset" state.

Change the property building logic for size properties:
- When a size class is set: `hasValue: true`, show the resolved value and class name (current behaviour)
- When no size class is set: `hasValue: false`, show as an empty/addable control with the computed value as a faint placeholder

**File: `packages/surface/src/client/components/computed-property-panel.tsx` (modify `SizeSection`)**

Redesign `SizeSection` to always show all six sizing properties in a structured layout:

```
┌─────────────┬──────────────┐
│  W  [     ] │  H  [      ] │   ← always visible, ScaleInput
├─────────────┼──────────────┤
│ Min W [   ] │ Min H [    ] │   ← always visible, collapsed/subtle when unset
├─────────────┼──────────────┤
│ Max W [   ] │ Max H [    ] │   ← always visible, collapsed/subtle when unset
└─────────────┴──────────────┘
```

- Width and height: always prominent, full `ScaleInput` with Tailwind sizing scale
- Min/max: shown below, slightly de-emphasized when unset (lighter text, dashed border or similar)
- All controls use `ScaleInput` mapped to the spacing/sizing scale
- When unset, the computed pixel value shows as a placeholder/ghost value so users have context
- Token integration: scale dropdown shows design tokens when available, same as existing ScaleInput behaviour

**Interaction when unset:**
- Clicking an empty width control and selecting a scale value → calls `onCommitClass("w-48")` (same write path as existing property edits, respects `writeMode`)

#### Phase 2B: Resize Handle Overlay

**File: `packages/surface/src/client/components/resize-handles.tsx` (new)**

Rendered in the editor UI alongside the selection overlay. Receives `writeMode` as a prop.
- Three handles: right edge (vertical bar), bottom edge (horizontal bar), corner (square)
- Positioned from the selected element's `boundingRect`
- Pointer down + move on a handle → calculate delta in pixels
- During drag: send `tool:previewInlineStyle` to iframe (live feedback in both modes)
- On release:
  - Determine best Tailwind class using existing `tailwind-map.ts` reverse mapping
  - **Deterministic**: call `handleWriteClass()` + send `tool:revertInlineStyles`
  - **AI mode**: push `ChangeIntent` of `type: "class"` (or `type: "style"`), keep preview

**Scale snapping logic:**
- Read the Tailwind sizing scale from `ResolvedTailwindTheme` (already available in the editor)
- During drag, find the two nearest scale values bracketing the current pixel value
- Show a tooltip: `w-48 (192px)` or `w-[200px]` (if arbitrary)
- Snap to nearest scale value within a threshold (e.g., 8px)

**Resize handles ↔ sizing panel sync:**
- During drag, the sizing panel's width/height control updates in real-time (showing the snapped value)
- After commit, the panel reflects the newly written class
- Clicking a sizing panel control and dragging to resize are two paths to the same write — they share the snapping logic and write pipeline

#### Phase 2C: Smart Resize Awareness

**File: `packages/surface/src/client/lib/resize-logic.ts` (new)**

Logic for determining resize behaviour based on current styles:
- If element has `flex-1` / `flex-grow` / `flex-shrink`: warn before overriding with fixed size
- If element has `w-full`: show "currently 100%" indicator, drag sets explicit width
- If parent is `flex` with `gap`: account for gap in size calculation
- If element has `aspect-ratio`: dragging width also updates height (and vice versa), or show a lock icon

#### Phase 2D: Extend Existing Preview System

The preview mechanism (`tool:previewInlineStyle` / `tool:revertInlineStyles`) already exists and handles live feedback for style changes. Resize just uses it with `width` and `height` properties. No new iframe protocol needed.

**File: `packages/surface/src/client/components/editor-panel.tsx` (extend)**

- Render `<ResizeHandles>` when an element is selected, pass `writeMode` and `onAddChangeIntent`
- Hide handles during drag-to-reorder (avoid conflicting interactions)
- After resize write completes (deterministic), re-read computed styles to update the panel values

#### Framework Notes

- Resize is fully framework-agnostic. It uses the same write pipeline as existing style edits (`POST /api/write-element`). The iframe preview mechanism is DOM-based. No framework-specific work needed.
- The sizing panel changes are also framework-agnostic — they're purely editor UI changes that feed into the existing `onCommitClass` pipeline.

---

## Feature 3: Inline Text Editing

### What It Does

Users can double-click text in the iframe to edit hardcoded string literals directly. Dynamic content (variables, expressions, i18n calls) is visually locked and shows the user what data source it comes from.

### Hover & Editability UX

**On hover (selection mode active):**
- If the element contains **only static text**: cursor changes to a text-edit cursor (I-beam overlay on the text portions). Subtle underline or highlight indicates "editable."
- If the element contains **mixed content** (static + dynamic): static parts get the editable indicator; dynamic parts show a small data icon (chain-link or variable icon).
- If the element is **fully dynamic**: standard pointer cursor. A small badge/chip appears on hover showing the expression: `{user.name}` or `{t('hero.title')}` — so the user understands *why* it's not editable and *what* it's bound to.

**On double-click:**
- **Static text**: enters inline edit mode (see below)
- **Fully dynamic**: shows a tooltip/toast: "This text comes from `product.title`" (the expression source, extracted from the AST). No edit mode entered.
- **Mixed content**: enters inline edit mode with dynamic parts rendered as inert chips

### Behaviour Rules

- Only `JSXText` and `StringLiteral` AST nodes are editable (React/JSX)
- Only `Text` nodes are editable in Svelte (not `MustacheTag` / `{expression}`)
- Only text nodes are editable in Astro (not `Expression` nodes)
- String literal props (e.g., `label="Save"`, `placeholder="Search..."`, `alt="Hero image"`) are also editable via the same mechanism
- Escape cancels the edit and reverts to original text
- Enter confirms (for single-line text). Shift+Enter for multiline
- Empty string is allowed (user might want to clear placeholder text)
- Whitespace is preserved as authored (Recast/string-splice preserves formatting)

### AI Mode Behaviour

On Enter/confirm:
- **Deterministic mode**: calls `POST /api/write-text` immediately, HMR fires
- **AI mode**: pushes a `ChangeIntent` of `type: "text"` onto the pending queue; the contentEditable overlay **stays visible** showing the new value (the user sees their change). The original iframe text stays hidden (opacity: 0) until Claude applies the edit.

On Escape: always discards, always exits edit mode regardless of write mode.

On queue chip removal in AI mode: reverts the overlay (shows original text, restores opacity).

### Implementation

#### Phase 3A: Server — Content Classification Endpoint

**File: `packages/surface/src/server/api/classify-content.ts` (new)**

New endpoint `POST /api/classify-content`:
- Receives: `{ source: { file, line, col } }`
- Parses the file with the appropriate parser (Babel for JSX, `svelte/compiler` for .svelte, `@astrojs/compiler` for .astro)
- Finds the element at source location
- Walks its children and classifies each:

```typescript
type ContentSegment =
  | { type: "text"; value: string; childIndex: number }       // editable
  | { type: "expression"; display: string; childIndex: number } // locked, shows source

type ContentClassification = {
  segments: ContentSegment[];
  editable: boolean;           // true if any segment is text
  fullyDynamic: boolean;       // true if no text segments at all
};
```

- For each locked segment, `display` is the source code of the expression (e.g., `user.name`, `t('hero.title')`, `formatCurrency(price)`) — printed via Recast/source slice so it shows exactly what the developer wrote.

**File: `packages/surface/src/server/lib/ast-helpers.ts` (extend)**

Add: `classifyJSXChildren(ast, line, col): ContentClassification`
- Find element via `findElementAtSource()`
- Walk `element.children`:
  - `JSXText` → `{ type: "text", value: node.value }`
  - `JSXExpressionContainer` with `StringLiteral` → `{ type: "text", value: node.expression.value }`
  - `JSXExpressionContainer` with anything else → `{ type: "expression", display: source.slice(node.start, node.end) }`

Add framework variants:
- `classifySvelteChildren(source, line, col)`: uses `svelte/compiler` parse, classifies `Text` vs `MustacheTag`
- `classifyAstroChildren(source, line, col)`: uses `@astrojs/compiler` parse, classifies text vs expression

Dispatcher: `classifyContent(filePath, line, col)` — picks parser based on file extension.

#### Phase 3B: Server — Text Write Endpoint

**File: `packages/surface/src/server/api/write-text.ts` (new)**

New endpoint `POST /api/write-text`:
- Receives: `{ source: { file, line, col }, childIndex: number, newValue: string }`
- Parses file, finds element, finds the child at `childIndex`
- Validates: child must be `JSXText` or `StringLiteral` (server-side re-check, don't trust client)
- Replaces the text node's value
- For JSX: Recast handles it (modify `node.value` for `JSXText`, `node.expression.value` for `StringLiteral`)
- For Svelte/Astro: string splice (same approach as source-transform — replace characters between `node.start` and `node.end`)
- Writes file, HMR triggers

This endpoint is only called in **deterministic mode**.

#### Phase 3C: Iframe — Hover Classification & Edit Mode

**File: `packages/vite-plugin/src/surface.tsx` (extend)**

**Hover changes:**
- When hovering in selection mode, the iframe already shows a highlight overlay
- Extend: when hover target contains text, send a `tool:classifyHoverContent` message to editor
- Editor calls `POST /api/classify-content` with the element's `data-source`
- Result cached (keyed by source location — invalidated on HMR)
- Editor sends back `tool:showContentHints` with classification data
- Iframe renders:
  - For editable text: subtle underline (CSS `text-decoration` on overlay, not on actual element)
  - For dynamic expressions: small inline badge showing expression (positioned over the expression text using DOM Range API to find the text node boundaries)

**Double-click handling:**
- Intercept double-click on selected element
- If `fullyDynamic`: show tooltip with expression sources, do not enter edit mode
- If `editable`: enter inline edit mode

**Inline edit mode:**
- Create a `contentEditable` div in the overlay layer, positioned exactly over the text
- Pre-populate with the `segments`: text segments are editable spans, expression segments are inert styled chips (grey background, monospace, showing the expression like `{user.name}`)
- Style the editable div to match the element's computed font styles (size, weight, color, line-height, letter-spacing)
- Hide the original text element visually during edit (opacity: 0 on the overlay, not on the real element)
- On Enter:
  - **Deterministic**: collect text from editable spans, call `POST /api/write-text` for each changed segment
  - **AI mode**: push `ChangeIntent` of `type: "text"` per changed segment, keep overlay visible
- On Escape: discard changes, exit edit mode (both modes)
- On click-outside: treat as confirm

**File: `packages/surface/src/shared/protocol.ts` (extend)**

New messages:
- `EditorToIframe`: `tool:showContentHints` — sends content classification for rendering hover hints
- `IframeToEditor`: `tool:requestContentClassification` — iframe asks editor to classify an element's content
- `IframeToEditor`: `tool:commitTextEdit` — sends edited text back for writing (deterministic) or queuing (AI mode)
- `EditorToIframe`: `tool:enterTextEditMode` — tells iframe to activate inline editing on current selection
- `EditorToIframe`: `tool:exitTextEditMode` — tells iframe to deactivate inline editing
- `EditorToIframe`: `tool:reorderComplete` — tells iframe to re-select the moved element at its new position (deterministic mode only)
- `EditorToIframe`: `tool:setQueuedSources` — sends the full set of `"file:line:col"` strings for elements with queued intents; iframe overlay renders subtle accent indicators on those elements. Sent whenever the intent queue changes.

#### Phase 3D: Editor — Text Edit Integration

**File: `packages/surface/src/client/components/editor-panel.tsx` (extend)**

- When an element is selected, fetch its content classification
- In the property panel, show a "Content" section (above the style sections) when the element has editable text:
  - Shows the current text value in an editable field (alternative to inline editing for users who prefer the panel)
  - For mixed content, show text fields for editable parts and read-only chips for expressions
  - For fully dynamic content, show "Bound to `{expression}`" with no edit control
- On commit from panel field: same write-mode-aware path as inline edit (deterministic writes, AI mode queues)
- Double-click in iframe is the primary editing UX; the panel field is the secondary/fallback

#### Phase 3E: String Prop Editing

**File: `packages/surface/src/server/api/classify-content.ts` (extend)**

Also classify element attributes/props:
- For each JSX attribute (or Svelte/Astro attribute), check if value is a `StringLiteral`
- Return prop classification alongside children classification:

```typescript
type PropClassification = {
  name: string;              // "label", "placeholder", "alt"
  value: string;
  editable: boolean;         // true if StringLiteral
  expression?: string;       // source of expression if not editable
};
```

**File: `packages/surface/src/client/components/editor-panel.tsx` (extend)**

- Show editable string props in the panel (e.g., "label", "placeholder", "alt", "title")
- These render as simple text inputs
- On change: write-mode-aware — deterministic calls `POST /api/write-text` (extend to handle attribute writes); AI mode queues as `ChangeIntent` of `type: "prop"` (already exists in the type union)
- `fiberProps` already surfaces these values at runtime for React; for Svelte/Astro, fall back to AST-only

#### Framework Notes

- **React (JSX/TSX):** Full support via Babel/Recast. `JSXText` and `StringLiteral` classification. Recast preserves formatting.
- **Svelte:** `svelte/compiler` parse gives `Text` vs `MustacheTag` nodes. Write via string splice (source offset-based, matching existing `svelte-source-transform.ts` pattern).
- **Astro:** `@astrojs/compiler` parse gives text vs expression nodes. Write via string splice (matching existing `astro-source-transform.ts` pattern).
- All three share the same `ContentClassification` response shape and the same editor/iframe UX.

---

## Dependency Changes

```
packages/surface/package.json — add:
  "@dnd-kit/core": "^6.x"
  "@dnd-kit/sortable": "^10.x"
  "@dnd-kit/utilities": "^4.x"
```

No other new dependencies. Svelte compiler and Astro compiler are already in the dependency tree.

---

## Implementation Order

The three features are largely independent. Suggested order based on complexity and the shared infrastructure they build:

1. **Sizing panel overhaul (Feature 2A)** — pure editor UI change, no iframe or server work. Fastest to ship and immediately useful.
2. **Resize handles (Feature 2B–2D)** — builds on the sizing panel and existing preview/write pipeline. No new dependencies.
3. **Inline text editing (Feature 3)** — server + iframe + editor work, but React-only first version is self-contained.
4. **Flex/grid reordering (Feature 1)** — requires dnd-kit, most complex interaction model, most iframe surface area.

Within each feature: server-side first (AST classification/write), then iframe integration, then editor panel UI. Each layer is independently testable.

---

## What's Explicitly Out of Scope

- **Inserting new elements/components** (drag from palette) — future phase, depends on component palette UX design
- **Moving elements between containers** (cross-parent drag) — too risky for data flow integrity
- **Absolute/fixed positioning** — never, by design
- **Rich text editing** (bold, italic, links within text) — would require understanding the component's markup structure, too complex for initial version
- **Image/media editing** — requires asset pipeline integration, separate feature
- **Undo/redo** — important but orthogonal; should be designed as a system-wide feature, not per-feature
