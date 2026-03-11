# Data-Driven Element Detection — Plan

## Status

| Area | Status |
|------|--------|
| Expand classify-element API | ✅ Done |
| Protocol types updated | ✅ Done |
| app.tsx reads full classification | ✅ Done |
| Overlay badge row + border colours | ✅ Done |
| Write warning in editor panel | ✅ Done |
| AI agent context injection | ✅ Done |

---

## What was built

### Two orthogonal signals

`inLoop` and `hasDynamicContent` are now tracked separately throughout the stack — they're not collapsed into one `isDataDriven` boolean.

- **`inLoop`** — element is rendered via `.map()`, `.flatMap()`, or `.filter()`
- **`hasDynamicContent`** — element's text/child content contains non-literal expressions (`contentType === "dynamic" | "mixed"`)

### Data source origin

When `inLoop` is true, the system now traces the identifier before `.map()` back to its declaration:

- **`"local"`** — iterated array is a literal defined in this file (e.g. `const stats = [{ ... }]`)
- **`"external"`** — comes from a hook, props, import, or state

### API (`classify-element.ts`)

Top-level response fields: `inLoop`, `hasDynamicContent`, `dataOrigin`, `iteratorExpression`, `contentExpression`. The legacy `instance` shape is retained for backwards compat.

`detectDataOrigin()` traces the identifier before `.map()` up through the AST scope to find its `VariableDeclarator`. Checks whether the init is a literal-only `ArrayExpression`.

### Overlay badge row (`surface.tsx`)

Replaces the previous single-icon right-side badge. Now a chip row anchored **above-left** of the selected element (falls below if near viewport top):

```
[ ⊞ CardTitle ]  [ loop ]  [ dynamic ]
```

**Border colour priority** (highest wins):
1. Loop → dashed purple `rgba(139,92,246,0.7)`
2. Dynamic content only → teal `rgba(20,184,166,0.7)`
3. Component mode → orange
4. Instance mode → blue
5. Inspect only → grey

### Editor panel write warning (`editor-panel.tsx`)

When `inLoop` is true, an informational notice renders at the top of the selected element panel:

> **Looped element** — style edits will apply to all instances rendered from this template, which uses local data defined in this file.
> `recentItems.map(…)`

Styled in purple to match the loop colour. Informational only — writes still proceed.

### AI agent context (`agent-chat.ts`)

`buildSystemContext()` now appends classification context to the AI's prompt prefix:

- If `inLoop`: warns that edits affect all instances, includes iterator expression and origin
- If `hasDynamicContent` (standalone): warns that text content is from a runtime variable
- Prevents AI from suggesting hardcoded text replacements for data-driven content

---

## What could still be done (near term)

### Hover tooltip shows classification chips

Currently the hover tooltip (the floating name badge on mouse-over) is a plain text label — it doesn't show loop/dynamic chips. The classification isn't known at hover time (it's async, fetched on click). Options:

- Pre-classify on hover start with a short debounce
- Show chips only once selected (current behaviour), accept the asymmetry
- Cache classify results per `data-source` coordinate across selections

### Spread prop detection

`{...item}` spread attributes are silently skipped in `classifyProps()`. An element like `<StatCard {...stat} />` inside a map has all-dynamic props, but they're invisible to the classifier. Should add: if any `JSXSpreadAttribute` is present, mark the element as data-driven regardless of iterator context.

### Per-prop editability in the editor (future)

`classifyProps()` already computes `isEditable` per prop (literal vs expression). This could surface in the editor panel as locked/greyed fields when a prop value is `{item.status}`. Deferred because it's about content editing, not styling — the styling panel isn't affected by whether text values are dynamic.

### Explorer opacity

Non-`data-slot` elements in the Page Explorer have `opacity: 0.5` by design. Now that these elements are selectable (since the `findSelectableElement` fix), the graying is more confusing — a selectable element looks disabled. Could either remove the opacity distinction or replace it with a subtler visual treatment.

### Write warning instance count

The loop warning says "all instances" but doesn't say how many. Could query the DOM in the iframe (count elements matching the same `data-source` coordinate) and show "affects all 4 instances". Minor but useful.

---

## Deferred (later / needs more thought)

### Finer data source distinctions

Currently binary: `local` vs `external`. A richer breakdown — `hook`, `props`, `imported`, `state` — is possible but:
- Requires more scope analysis (walk up to function parameters, check import statements)
- The distinction rarely matters for the UI; `external` covers all runtime cases
- May be useful for AI context ("data comes from a `useQuery` hook") but not urgent

### Tracing `contentExpression` back through the iterator

If `{item.name}` is the dynamic content and `item` is the map callback parameter, tracing `item` → callback → iterator → `stats` array → `"local"` or `"external"` is a two-step trace. Currently `dataOrigin` only applies to the loop element itself, not its content expressions.

### Write blocking / confirmation for loop elements

Currently the loop warning is informational — writes proceed silently. A stronger version would show a confirmation before writing (modal or inline confirm button). Probably too aggressive for styling changes, but might make sense for content changes if/when that's supported.

### Per-prop `isEditable` locking in the style panel

The data is computed but unused for styling. Would make more sense in a future content-editing panel where individual text nodes and prop values are editable inline.

### Detecting loops beyond `.map()/.flatMap()/.filter()`

`for...of`, `Array.from()`, custom render functions — currently undetected. Low priority since `.map()` covers ~95% of real-world cases in React JSX.
