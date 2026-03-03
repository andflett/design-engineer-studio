# Plan: CSS Functions & Styles — Authored Values, Responsive Safety, and Function UIs

## Problem Statement

When users define styles using CSS functions (`clamp()`, `calc()`, `min()`, `max()`, `var()`),
or use Tailwind responsive prefixes (`md:px-2`, `lg:text-xl`), the editor currently:

1. **Shows resolved snapshots** instead of the authored value — `18.4px` instead of `clamp(14px, 2vw, 24px)`
2. **Silently destroys** responsive/dynamic values when the user makes any edit
3. **Cannot parse** Tailwind arbitrary values containing functions — `text-[clamp(...)]` falls to `other`
4. **Ignores breakpoint prefixes** during conflict detection, risking clobbered responsive overrides
5. **Generates invalid** arbitrary Tailwind classes for function values (missing underscore escaping)

### Root Cause

`getComputedStyle()` resolves everything. The editor never sees the original authored CSS text.
Without that, it cannot know a value is dynamic, which breakpoint variant is active, or that
editing will destroy responsive intent.

---

## Architecture Overview

```
IFRAME (user's app)           postMessage            EDITOR UI               HTTP             WRITE SERVER
surface.tsx ──────────────────────────────► app.tsx ─────────────────────────────► write-element.ts
 │                                          │ iframe-bridge.ts                     │ ast-helpers.ts
 │ getComputedStyle()                       │ computed-styles.ts                   │ write-css-rule.ts
 │ NEW: getAuthoredStyles()                 │ computed-property-panel.tsx           │
 │ NEW: getActiveBreakpoint()               │                                      │
 │                                          │                                      │
 ▼ Browser DOM APIs                         ▼ shared/tailwind-parser.ts            ▼ shared/tailwind-parser.ts
   (framework-agnostic)                       shared/tailwind-map.ts                 shared/tailwind-map.ts
```

**Key constraint**: The postMessage protocol must remain framework-agnostic. All framework-specific
work stays in the iframe (`surface.tsx`). The editor and write server are shared across all frameworks.

**Plugin surface area**: `surface.tsx` exists as near-identical copies in `next-plugin` and
`vite-plugin` (differs only by a `"use client"` pragma). `astro-plugin` wraps `vite-plugin`.
All editor/server code lives in `packages/surface/src/`.

---

## Implementation Steps

### Step 1: Authored Values in the Protocol

**Goal**: Send the original, pre-resolution CSS text from the iframe to the editor alongside
the existing computed values. This is the foundation — everything else depends on it.

**Browser APIs used** (standard, no libraries):
- `document.styleSheets` — access all loaded stylesheets
- `CSSStyleRule.style.getPropertyValue()` — returns **authored** text, not resolved
- `CSSMediaRule` — represents `@media` blocks; recurse into `.cssRules`
- `Element.matches(selectorText)` — test if a rule applies to the element
- `HTMLElement.style.getPropertyValue()` — inline style authored value
- `window.matchMedia()` — test if a media query is currently active

#### Files Changed

**`packages/next-plugin/src/surface.tsx`** and **`packages/vite-plugin/src/surface.tsx`**

Add `getAuthoredStyles()` function inside the Surface component's IIFE (next to `extractElementData`):

```typescript
/**
 * Walk document.styleSheets to find the authored (pre-resolution) CSS value
 * for each property on the given element. Returns the authored text from the
 * highest-specificity matched rule, or null if only computed is available.
 *
 * Unlike getComputedStyle(), CSSStyleRule.style.getPropertyValue() returns
 * the original authored text — e.g. "clamp(14px, 2vw, 24px)" instead of "18.4px".
 */
function getAuthoredStyles(
  el: Element,
  props: string[]
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const p of props) result[p] = null;

  // 1. Inline styles (highest specificity)
  const inlineStyle = (el as HTMLElement).style;
  for (const prop of props) {
    const val = inlineStyle.getPropertyValue(prop);
    if (val) result[prop] = val;
  }

  // 2. Walk matched CSS rules from stylesheets
  //    Later rules override earlier ones (cascade order approximation).
  //    We recurse into @media blocks and only consider active media queries.
  for (const sheet of document.styleSheets) {
    try {
      walkRules(sheet.cssRules, el, props, result);
    } catch {
      // Cross-origin stylesheet — skip
    }
  }

  return result;
}

function walkRules(
  rules: CSSRuleList,
  el: Element,
  props: string[],
  result: Record<string, string | null>
): void {
  for (const rule of rules) {
    if (rule instanceof CSSMediaRule) {
      // Only recurse into active @media blocks
      if (window.matchMedia(rule.conditionText).matches) {
        walkRules(rule.cssRules, el, props, result);
      }
    } else if (rule instanceof CSSStyleRule) {
      // Ignore try/catch for invalid selectors in el.matches()
      try {
        if (el.matches(rule.selectorText)) {
          for (const prop of props) {
            if (result[prop] && (el as HTMLElement).style.getPropertyValue(prop)) {
              continue; // Inline style wins, don't override
            }
            const val = rule.style.getPropertyValue(prop);
            if (val) result[prop] = val;
          }
        }
      } catch {}
    }
  }
}
```

In `extractElementData()`, add after the existing computed collection (~line 680):

```typescript
const authoredStyles = getAuthoredStyles(el, relevantProps);
```

And include in the return object (~line 773):

```typescript
return {
  // ...existing fields...
  computedStyles,
  authoredStyles,     // NEW
};
```

**`packages/surface/src/shared/protocol.ts`**

Add `authored` to `SelectedElementData`:

```typescript
export interface SelectedElementData {
  // ...existing fields unchanged...
  computed: Record<string, string>;
  authored: Record<string, string | null>;  // NEW — null means no authored value found
}
```

**`packages/surface/src/client/lib/iframe-bridge.ts`**

Extend `RawElementData` and `normalizeElementData()`:

```typescript
interface RawElementData {
  // ...existing fields...
  authoredStyles?: Record<string, string | null>;  // NEW
}

function normalizeElementData(data: RawElementData | SelectedElementData): SelectedElementData {
  // ...existing logic...
  return {
    // ...existing fields...
    authored: raw.authoredStyles || {},  // NEW — backwards compatible
  };
}
```

---

### Step 2: Active Breakpoint Reporting

**Goal**: Tell the editor which responsive breakpoint is currently active in the iframe, so
conflict detection can target the right variant (base vs `md:` vs `lg:` etc.).

**Browser APIs used**:
- `CSSMediaRule.conditionText` — read `@media` condition text
- `CSSStyleRule.selectorText` — extract Tailwind breakpoint prefix from selector
- `window.matchMedia()` — test which breakpoints are active
- `window.innerWidth` — current viewport width

#### Files Changed

**`packages/next-plugin/src/surface.tsx`** and **`packages/vite-plugin/src/surface.tsx`**

Add `getActiveBreakpoint()` next to the new `getAuthoredStyles()`:

```typescript
/**
 * Discover Tailwind breakpoints from the stylesheet's @media rules and
 * return the name of the highest active breakpoint (e.g. "md", "lg"),
 * or null if at the base (smallest) breakpoint.
 *
 * This is framework-agnostic — it reads breakpoints from whatever
 * @media rules exist in the document, regardless of how they were generated.
 */
function getActiveBreakpoint(): string | null {
  const seen = new Map<string, number>(); // name → minWidth

  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSMediaRule) {
          const mwMatch = rule.conditionText.match(/min-width:\s*([\d.]+)px/);
          if (!mwMatch) continue;
          const minWidth = parseFloat(mwMatch[1]);

          // Derive breakpoint name from selectors inside the @media block
          for (const child of rule.cssRules) {
            if (child instanceof CSSStyleRule) {
              // Match escaped colon in Tailwind selectors: .md\:px-2, .lg\:text-xl
              const prefixMatch = child.selectorText.match(/\.(\w+)\\:/);
              if (prefixMatch && !seen.has(prefixMatch[1])) {
                seen.set(prefixMatch[1], minWidth);
              }
            }
          }
        }
      }
    } catch {}
  }

  let active: string | null = null;
  const sorted = [...seen.entries()].sort((a, b) => a[1] - b[1]);
  for (const [name, minWidth] of sorted) {
    if (window.innerWidth >= minWidth) active = name;
  }
  return active;
}
```

Include in `extractElementData()` return:

```typescript
return {
  // ...existing fields...
  activeBreakpoint: getActiveBreakpoint(),  // NEW
};
```

**`packages/surface/src/shared/protocol.ts`**

```typescript
export interface SelectedElementData {
  // ...existing fields...
  activeBreakpoint: string | null;  // NEW — "sm", "md", "lg", "xl", "2xl", or null (base)
}
```

**`packages/surface/src/client/lib/iframe-bridge.ts`**

```typescript
interface RawElementData {
  // ...existing fields...
  activeBreakpoint?: string | null;  // NEW
}

// In normalizeElementData():
return {
  // ...existing...
  activeBreakpoint: raw.activeBreakpoint || null,
};
```

---

### Step 3: Unified Property Model — Authored Value Awareness

**Goal**: Extend `UnifiedProperty` so the editor UI knows when a value is a CSS function,
what the authored text is, and can decide how to render it.

#### Files Changed

**`packages/surface/src/client/lib/computed-styles.ts`**

Extend the interface:

```typescript
export interface UnifiedProperty {
  // ...existing fields unchanged...

  /** Original authored CSS value before browser resolution, if available */
  authoredValue: string | null;

  /** True if the authored value contains a CSS function (clamp, calc, var, etc.) */
  isFunction: boolean;

  /** Name of the CSS function if isFunction is true (e.g. "clamp", "var", "calc") */
  functionName: string | null;
}
```

Update `buildUnifiedProperties()` signature to accept authored styles:

```typescript
export function buildUnifiedProperties(
  tag: string,
  className: string,
  computedStyles: Record<string, string>,
  parentComputedStyles: Record<string, string>,
  tokenGroups: Record<string, any[]>,
  authoredStyles?: Record<string, string | null>,   // NEW parameter
): CategorizedUnified {
```

In the property-building loop, extract function info:

```typescript
const authoredVal = authoredStyles?.[def.property] || null;
// Detect CSS function: word chars followed by opening paren
const fnMatch = authoredVal?.match(/^([\w-]+)\(/);
const isFn = !!fnMatch;
const fnName = fnMatch ? fnMatch[1] : null;

prop = {
  // ...existing fields...
  authoredValue: authoredVal,
  isFunction: isFn,
  functionName: fnName,
};
```

---

### Step 4: Editor UI — Function-Aware Controls

**Goal**: The `UnifiedControl` router dispatches to appropriate controls based on
whether the value is a CSS function and which function it is.

#### Decision Tree (updated)

```
UnifiedControl
  ├─ controlType === "color"         → ColorInput (existing)
  ├─ controlType === "readonly"      → display-only (existing)
  ├─ prop.isFunction                 → NEW BRANCH
  │   ├─ functionName === "clamp"    → ClampInput (Step 4a)
  │   ├─ functionName === "var"      → VarInput (Step 4b)
  │   └─ other functions             → FunctionFallback (Step 4c)
  ├─ prop.tokenMatch                 → ScaleInput (existing)
  ├─ cssProperty === "opacity"       → OpacitySlider (existing)
  ├─ twScale exists                  → ScaleInput (existing)
  ├─ controlType === "keyword"       → KeywordControl (existing)
  └─ fallback                        → ScrubInput (existing)
```

#### Files Changed

**`packages/surface/src/client/components/computed-property-panel.tsx`**

Add the `prop.isFunction` branch in `UnifiedControl` (~line 1240). See sub-steps below.

---

#### Step 4a: `ClampInput` — Three-Value Range Editor

**New file**: `packages/surface/src/client/components/controls/clamp-input.tsx`

Follows the **BoxSpacing expand pattern**: collapsed shows authored text, expanded shows
three sub-editors.

```
┌─────────────────────────────────────────────────┐
│  Font Size    clamp(14px, 2vw, 24px)          ▼ │  ← collapsed
├─────────────────────────────────────────────────┤
│  Min   ┌──────────┐  14px                       │  ← ScrubInput
│  Pref  ┌──────────┐  2vw                        │  ← ScrubInput
│  Max   ┌──────────┐  24px                       │  ← ScrubInput
│                                                  │
│  ──●━━━━━━━━━━━━━━━━━━━●── (18.4px now)         │  ← range bar
│  14px                24px                        │    showing computed in context
└─────────────────────────────────────────────────┘
```

**Parsing**: Use a bracket-depth argument splitter (see Step 6) to decompose
`clamp(A, B, C)` into three arguments. Each argument gets its own `ScrubInput`.

**Commit**: On any sub-value change, reassemble `clamp(min, preferred, max)` and call
`onCommitStyle(cssProp, assembledValue)`.

**Range bar**: The bar is purely visual. It uses `computedValue` (the resolved px snapshot)
to show where in the min–max range the current viewport lands. Both `computedValue` and
`authoredValue` are available on the `UnifiedProperty`.

---

#### Step 4b: `VarInput` — Token Reference Picker

**New file**: `packages/surface/src/client/components/controls/var-input.tsx`

Follows the **ColorInput tabs pattern** (Tokens | Custom):

```
┌─────────────────────────────────────────────────┐
│  Text Color    var(--primary)                 ▼ │
├─────────────────────────────────────────────────┤
│  Variable: --primary                            │  ← from authored value
│  Resolved: rgb(59, 130, 246) ■                  │  ← computed value + swatch
│                                                  │
│  Available tokens:                               │
│  ■ --primary           rgb(59,130,246)          │  ← highlighted (current)
│  ■ --primary-light     rgb(96,165,250)          │
│  ■ --primary-dark      rgb(29,78,216)           │
│  ■ --secondary         rgb(168,85,247)          │
└─────────────────────────────────────────────────┘
```

**Parsing**: Extract variable name and optional fallback from `var(--name, fallback)`.

**Commit**: When user selects a different token, commit `var(--new-token-name)` — preserving
the `var()` wrapper rather than committing the resolved value.

**Token list**: Source from the existing `tokenGroups` data already available in
`buildUnifiedProperties()`.

---

#### Step 4c: `FunctionFallback` — Raw Text Editor for Other Functions

For `calc()`, `min()`, `max()`, `env()`, and any other/unknown CSS functions: show the
full authored text in a `ScrubInput`-style text field. Scrub is disabled (non-numeric),
but the user can edit the raw text and commit.

```
┌─────────────────────────────────────────────────┐
│  Width    calc(100% - 2rem)                     │  ← editable text input
│           Resolved: 968px                        │  ← computed value as hint
└─────────────────────────────────────────────────┘
```

**No new file needed** — this is the existing `ScrubInput` but fed `authoredValue` as its
display value instead of `computedValue`, with the computed shown as a secondary label/tooltip.

Implementation in `UnifiedControl`:

```typescript
if (prop.isFunction && prop.authoredValue) {
  if (prop.functionName === "clamp") {
    return <ClampInput prop={prop} onCommitStyle={onCommitStyle} ... />;
  }
  if (prop.functionName === "var") {
    return <VarInput prop={prop} onCommitStyle={onCommitStyle} ... />;
  }
  // Fallback: raw text editor showing authored value
  return (
    <div>
      <ScrubInput
        value={prop.authoredValue}
        tooltip={`Resolved: ${prop.computedValue}`}
        onCommit={(v) => onCommitStyle?.(prop, v)}
      />
      <span className="studio-resolved-hint">{prop.computedValue}</span>
    </div>
  );
}
```

This is deliberately minimal for functions we don't have dedicated UIs for yet. We can
iterate case by case — add a `CalcInput`, `MinMaxInput`, etc. as demand warrants.

---

### Step 5: Prefix-Aware Conflict Detection

**Goal**: When the editor writes back a Tailwind class change, only touch the class variant
(base, `md:`, `lg:`, etc.) that matches the currently active breakpoint. Never clobber
responsive overrides.

#### Files Changed

**`packages/surface/src/server/api/write-element.ts`**

The `POST /` handler receives changes and finds conflicting classes. Currently at line 468:

```typescript
// CURRENT — prefix-blind, finds first match
const match = allParsed.find((p) => p.property === parserProp);
```

Change to:

```typescript
// NEW — only match classes whose prefix corresponds to the active breakpoint
const activePrefix = body.activeBreakpoint ? `${body.activeBreakpoint}:` : undefined;
const match = allParsed.find(
  (p) => p.property === parserProp && p.prefix === activePrefix
);
```

Also update the request body interface:

```typescript
interface WriteElementBody {
  // ...existing fields...
  activeBreakpoint?: string | null;  // NEW — from the client
}
```

And when generating the new class, preserve the prefix:

```typescript
if (match?.prefix) {
  newClass = `${match.prefix}${newClass}`;
}
```

**`packages/surface/src/shared/protocol.ts`**

The `StyleChange` interface may optionally carry the breakpoint context if changes are
sent from the editor. Or it can be a top-level field on the write request body (simpler).

---

### Step 6: Bracket-Depth Parser for Arbitrary Values

**Goal**: Replace the fragile `[\w.%]+` regex in `CLASS_PATTERNS` arbitrary value patterns
with a bracket-balancing parser that handles CSS functions inside Tailwind arbitrary values.

Currently, `text-[clamp(14px,2vw,24px)]` fails to parse because the regex can't match
parentheses. This means conflict detection can't find the existing class to replace it.

#### Files Changed

**`packages/surface/src/shared/tailwind-parser.ts`**

Add a utility function:

```typescript
/**
 * Extract a balanced bracket expression from a Tailwind class.
 * Handles nested parentheses (for CSS functions), colons (for type hints),
 * and any characters inside the brackets.
 *
 * Examples:
 *   "text-[14px]"                      → "[14px]"
 *   "text-[clamp(14px,2vw,24px)]"     → "[clamp(14px,2vw,24px)]"
 *   "w-[calc(100%-2rem)]"             → "[calc(100%-2rem)]"
 *   "text-[length:var(--size)]"       → "[length:var(--size)]"
 *   "bg-[url('image.png')]"           → "[url('image.png')]"
 */
function extractBracketValue(cls: string, prefixLen: number): string | null {
  if (cls.charAt(prefixLen) !== "[") return null;

  let depth = 0;
  for (let i = prefixLen; i < cls.length; i++) {
    if (cls[i] === "[") depth++;
    else if (cls[i] === "]") {
      depth--;
      if (depth === 0) {
        // Valid only if bracket closes at end of string
        return i === cls.length - 1 ? cls.slice(prefixLen, i + 1) : null;
      }
    }
  }
  return null; // Unbalanced
}
```

Refactor `CLASS_PATTERNS` to use this for arbitrary values. Replace the explicit arbitrary
regex entries (lines 114–141) with a dynamic matching approach:

```typescript
// Map of Tailwind prefix → { category, property, label }
const ARBITRARY_PREFIXES: Record<string, { category: PropertyCategory; property: string; label: string }> = {
  "text-":     { category: "typography", property: "fontSize",      label: "Font Size" },
  "leading-":  { category: "typography", property: "lineHeight",    label: "Line Height" },
  "tracking-": { category: "typography", property: "letterSpacing", label: "Letter Spacing" },
  "font-":     { category: "typography", property: "fontWeight",    label: "Font Weight" },
  "p-":        { category: "spacing",    property: "padding",       label: "Padding" },
  "px-":       { category: "spacing",    property: "paddingX",      label: "Padding X" },
  "py-":       { category: "spacing",    property: "paddingY",      label: "Padding Y" },
  "pt-":       { category: "spacing",    property: "paddingTop",    label: "Padding Top" },
  // ... all other prefixes currently in the regex patterns
  "rounded-":  { category: "shape",      property: "borderRadius",  label: "Radius" },
};

// In parseClasses(), after CLASS_PATTERNS matching fails:
for (const [prefix, meta] of Object.entries(ARBITRARY_PREFIXES)) {
  if (core.startsWith(prefix)) {
    const bracketVal = extractBracketValue(core, prefix.length);
    if (bracketVal) {
      result[meta.category].push({
        category: meta.category,
        property: meta.property,
        label: meta.label,
        value: bracketVal,        // e.g. "[clamp(14px,2vw,24px)]"
        fullClass: cls,           // e.g. "md:text-[clamp(14px,2vw,24px)]"
        prefix,
      });
      matched = true;
      break;
    }
  }
}
```

This handles all current arbitrary patterns plus any CSS function, type hint, or
special character inside brackets — without regex.

---

### Step 7: Shorthand-Aware Property Hierarchy

**Goal**: When the editor changes `padding-left`, detect conflicts with both `pl-*` (exact),
`px-*` (axis shorthand), and `p-*` (full shorthand). When replacing a shorthand, expand
remaining sides.

#### Files Changed

**`packages/surface/src/server/api/write-element.ts`**

Add hierarchy map:

```typescript
const PROPERTY_HIERARCHY: Record<string, string[]> = {
  paddingTop:    ["paddingTop",    "paddingY", "padding"],
  paddingRight:  ["paddingRight",  "paddingX", "padding"],
  paddingBottom: ["paddingBottom", "paddingY", "padding"],
  paddingLeft:   ["paddingLeft",   "paddingX", "padding"],
  marginTop:     ["marginTop",     "marginY",  "margin"],
  marginRight:   ["marginRight",   "marginX",  "margin"],
  marginBottom:  ["marginBottom",  "marginY",  "margin"],
  marginLeft:    ["marginLeft",    "marginX",  "margin"],
};
```

Update conflict detection:

```typescript
const hierarchy = PROPERTY_HIERARCHY[parserProp] || [parserProp];
const activePrefix = body.activeBreakpoint ? `${body.activeBreakpoint}:` : undefined;

const match = allParsed.find(
  (p) => hierarchy.includes(p.property) && p.prefix === activePrefix
);
```

When a shorthand match is found (e.g., replacing `p-4` when changing `padding-left`),
the system should expand the shorthand into individual sides and only replace the
changed one. This involves generating the remaining side classes from the shorthand's
computed values.

---

## File Change Summary

| File | Changes | Step |
|------|---------|------|
| `packages/next-plugin/src/surface.tsx` | Add `getAuthoredStyles()`, `getActiveBreakpoint()`, extend `extractElementData()` return | 1, 2 |
| `packages/vite-plugin/src/surface.tsx` | Same changes (near-identical file) | 1, 2 |
| `packages/surface/src/shared/protocol.ts` | Add `authored`, `activeBreakpoint` to `SelectedElementData` | 1, 2 |
| `packages/surface/src/client/lib/iframe-bridge.ts` | Extend `RawElementData` and `normalizeElementData()` | 1, 2 |
| `packages/surface/src/client/lib/computed-styles.ts` | Add `authoredValue`, `isFunction`, `functionName` to `UnifiedProperty`; update `buildUnifiedProperties()` | 3 |
| `packages/surface/src/client/components/computed-property-panel.tsx` | Add `isFunction` branch in `UnifiedControl` router | 4 |
| `packages/surface/src/client/components/controls/clamp-input.tsx` | **New file** — three-value clamp editor | 4a |
| `packages/surface/src/client/components/controls/var-input.tsx` | **New file** — token reference picker for var() | 4b |
| `packages/surface/src/server/api/write-element.ts` | Prefix-aware conflict detection, shorthand hierarchy | 5, 7 |
| `packages/surface/src/shared/tailwind-parser.ts` | Bracket-depth parser for arbitrary values | 6 |

---

## Implementation Order

| Priority | Step | What | Risk without it |
|----------|------|------|-----------------|
| **P0** | 1 | Authored values in protocol | Editor shows misleading resolved snapshots; all other steps blocked |
| **P0** | 3 | `isFunction` flag + function-aware display | Users unknowingly destroy dynamic values on any edit |
| **P1** | 4c | Function fallback (raw text) | No graceful handling of calc/min/max — they display as resolved px |
| **P1** | 2 | Active breakpoint reporting | Responsive class edits clobber wrong variant |
| **P1** | 5 | Prefix-aware conflict detection | `md:px-2` ignored during writes, duplicates accumulate |
| **P1** | 6 | Bracket-depth arbitrary parser | `text-[clamp(...)]` unparseable, breaks conflict detection |
| **P2** | 4a | Clamp UI | Clamp values work but show as raw text instead of structured editor |
| **P2** | 4b | Var UI | var() values work but don't show token picker |
| **P2** | 7 | Shorthand hierarchy | `p-4` + `pl-8` duplication on shorthand/longhand edits |

---

## Testing Strategy

### Unit Tests

- `tailwind-parser.test.ts`: Add cases for arbitrary values with CSS functions
  - `text-[clamp(14px,2vw,24px)]` → parsed as `fontSize` with value `[clamp(14px,2vw,24px)]`
  - `w-[calc(100%-2rem)]` → parsed as `width` with value `[calc(100%-2rem)]`
  - `bg-[var(--color)]` → parsed as `backgroundColor` with value `[var(--color)]`
  - `text-[length:var(--size)]` → parsed with Tailwind type hint preserved
  - Nested functions: `w-[min(calc(100%-2rem),1200px)]`

- `tailwind-map.test.ts`: Verify `computedToTailwindClass()` doesn't generate broken
  arbitrary classes for values containing spaces (Tailwind requires underscores)

- `computed-styles.test.ts`: Verify `buildUnifiedProperties()` correctly flags functions
  and passes through authored values

### Integration Tests

- Select an element with `font-size: clamp(...)` → verify editor shows authored text
- Edit a clamp sub-value → verify the full clamp expression is written back
- Select element with `className="px-4 md:px-2"` at md viewport → verify only `md:px-2`
  is shown as the "active" class value
- Edit padding at md viewport → verify only the `md:` prefixed class is replaced

### Manual QA

- Verify no regression on standard (non-function) style editing
- Verify cross-origin stylesheets don't cause errors (caught by try/catch)
- Test with Tailwind v3 and v4 projects
- Test with CSS modules, plain CSS, and Tailwind projects

---

## Open Questions

1. **Specificity accuracy**: Walking `document.styleSheets` in order approximates the cascade
   but doesn't account for selector specificity (`.card.active` beats `.card`). For V1 this
   is acceptable — the computed value is always available as ground truth. A future improvement
   could use `CSS.highlights` or a specificity calculator.

2. **Performance**: `getAuthoredStyles()` walks all stylesheets on every element selection.
   For large apps with many stylesheets this could be slow. Mitigation: only walk sheets on
   initial selection, cache results keyed by element identity, invalidate on resize/navigation.

3. **Shadow DOM**: Components using Shadow DOM have their own `adoptedStyleSheets`. The current
   `document.styleSheets` walk won't find those. This is a known limitation for V1.

4. **Server Components**: In Next.js RSC, some elements may not have corresponding client-side
   stylesheets loaded. The authored value would be null for those — the editor falls back to
   computed values (same as today).

5. **`calc()` / `min()` / `max()` custom UIs**: Deferred to future iterations. For now these
   show as raw editable text with the resolved value as a hint. We can add structured editors
   case by case as demand warrants.
