# Plan: Playwright E2E Tests for Surface — Tabs + Write Paths

## 0. Design Rationale

Tests are organized around **the three editor tabs and their write paths**, which directly mirrors:

- What the server implements (`/api/tokens`, `/api/component`, `/api/write-element`)
- What the client renders (Token tab, Component tab, Instance/Element tab)
- What file gets modified (global CSS, component def `.tsx`, element source `.tsx`, usage site `.tsx`)

Each spec file tests exactly one write path. A failure identifies not just "something broke" but "the Component tab Props sub-tab write path is broken."

**Write path matrix:**

| Tab | Sub-tab | Handler | API call | Target file |
|-----|---------|---------|----------|-------------|
| Token | — | `saveToken()` | `POST /api/tokens` | global `.css` |
| Component | Props | `handleComponentClassChange` | `POST /api/component` | component def `.tsx` |
| Component | Styles | `handleWriteElement` replaceClass | `POST /api/write-element` | component def `.tsx` |
| Element | — (Tailwind) | `handleWriteElement` replaceClass | `POST /api/write-element` | element source `.tsx` |
| Element | — (CSS mode) | `handleWriteStyle` | `POST /api/write-element` cssProperty | `.css` / `.module.css` |
| Instance | Props | `handleInstancePropChange` | `POST /api/write-element` prop | usage site `.tsx` |
| Instance | Styles | `handleInstanceOverride` | `POST /api/write-element` instanceOverride | usage site `.tsx` |

---

## 1. File Layout

```
tests/e2e/
  shared/
    fixtures.ts                         (existing — extended per section 5)
  studio-app/
    selection.spec.ts                   smoke: iframe click → panel + correct tab
    component-props.spec.ts             Component tab → Props sub-tab → /api/component
    component-styles.spec.ts            Component tab → Styles sub-tab → write-element replaceClass
    instance-props.spec.ts              Instance tab → Props sub-tab → write-element prop
    instance-styles.spec.ts             Instance tab → Styles sub-tab → write-element instanceOverride
    element-tailwind.spec.ts            Element tab, Tailwind mode → write-element replaceClass
  vite-app/
    element-tailwind.spec.ts            Element tab, Tailwind mode (Vite, simpler fixture)
  css-app/
    element-css.spec.ts                 Element tab, plain CSS mode → write-element cssProperty
  css-modules-app/
    element-css-modules.spec.ts         Element tab, CSS Modules mode → write-element cssProperty
  design-system/
    token-color.spec.ts                 Token tab → color token edit → /api/tokens
```

`playwright.config.ts` is structurally unchanged. Port assignments:

| App | App port | Tool port | Project name |
|-----|----------|-----------|--------------|
| studio-app | 3100 | 4500 | studio |
| vite-app | 3101 | 4501 | vite |
| design-system | 3102 | 4502 | design-system |
| css-app | 3103 | 4503 | css |
| css-modules-app | 3104 | 4504 | css-modules |

---

## 2. Target Elements

### studio-app (`demos/studio-app/app/(marketing)/page.tsx`)

**For Component tab tests — Alert component:**
- Selector: `[data-slot="alert"]`
- CVA file: `demos/studio-app/components/ui/alert.tsx`
- Variants: `variant` (default, destructive, success, warning), `size` (sm, default, lg), `border` (default, thick, left)
- Page usage: `<Alert variant="warning">` around line 34

**For Instance tab tests — Badge component:**
- Selector: `[data-slot="badge"]`
- Variants: `variant` (default, secondary, destructive, outline, muted), `size` (sm, default, lg), `weight` (normal, medium, semibold, bold)
- Page usage: `<Badge variant="secondary" size="sm">Active</Badge>` in the table (line ~55)
- Instance prop write target: `demos/studio-app/app/(marketing)/page.tsx`

**For Element tab tests (plain element):**
- Selector: `main`
- Classes: `mx-auto max-w-4xl px-4 py-8 space-y-5`
- Source: `demos/studio-app/app/(marketing)/page.tsx` line 29

### vite-app
- Selector: `header`
- Source: `demos/vite-app/src/App.tsx`

### css-app
- Selector: `.card`
- CSS file: `demos/css-app/src/styles.css`

### css-modules-app
- Selector: `[class*="page"]`
- CSS Module file: `demos/css-modules-app/src/App.module.css`

### design-system
- Token: `--primary-500` → testid `token-row-primary-500`
- CSS file: `demos/design-system/app/globals.css`

---

## 3. New `data-testid` Anchors Required

### Already in place (no changes needed)

| testid | Component | Notes |
|--------|-----------|-------|
| `selection-mode-btn` | `tool-chrome.tsx` | + `data-active` attr |
| `editor-element-name` | `editor-panel.tsx` | element name span |
| `save-indicator` | `editor-panel.tsx` | "Saved" span |
| `editor-tabs` | `editor-panel.tsx` | mode switcher container |
| `editor-tab-{mode}` | `editor-panel.tsx` | token / component / instance |
| `scale-dropdown-{cssProp}` | `scale-input.tsx` | Radix Select trigger |
| `scale-arbitrary-input-{cssProp}` | `scale-input.tsx` | arbitrary text input |
| `scale-toggle-{cssProp}` | `scale-input.tsx` | mode toggle button |
| `token-row-{tokenId}` | `token-editor.tsx` | wrapper div per token |

### Additions needed in `editor-panel.tsx`

**Component tab sub-tabs (line ~466–482):**
```tsx
<button data-testid="component-subtab-props" ...>Props</button>
<button data-testid="component-subtab-styles" ...>Styles</button>
```

**Instance tab sub-tabs (line ~627–641):**
```tsx
<button data-testid="instance-subtab-props" ...>Props</button>
<button data-testid="instance-subtab-styles" ...>Styles</button>
```

**ComponentVariantSection collapse button (line ~802):**
```tsx
<button
  onClick={() => setCollapsed(!collapsed)}
  className="studio-section-hdr"
  data-testid={`component-variant-section-${dim.name}`}
>
```

**InstanceVariantSection StudioSelect (line ~1002):**
```tsx
<StudioSelect
  value={effectiveValue}
  onChange={onSelect}
  options={...}
  data-testid={`instance-prop-${dim.name}`}
/>
```
(The `data-testid` passthrough to `Select.Trigger` is already wired up in `select.tsx`.)

---

## 4. Fixture Extensions (`tests/e2e/shared/fixtures.ts`)

Add these methods to `SurfacePage`:

```typescript
/** Switch to a Props or Styles sub-tab within Component or Instance tab. */
async switchSubTab(scope: "component" | "instance", tab: "props" | "styles"): Promise<void> {
  await this.page.locator(`[data-testid="${scope}-subtab-${tab}"]`).click();
}

/** Change an instance prop dimension via its StudioSelect dropdown. */
async selectInstanceProp(dimName: string, value: string): Promise<void> {
  await this.page.locator(`[data-testid="instance-prop-${dimName}"]`).click();
  await this.page.locator('[role="option"]').getByText(value, { exact: true }).click();
}

/** Expand a ComponentVariantSection by its dimension name (toggle if collapsed). */
async expandComponentVariantSection(dimName: string): Promise<void> {
  await this.page.locator(`[data-testid="component-variant-section-${dimName}"]`).click();
}

/** Expand a specific option row inside an already-expanded variant section. */
async expandVariantOption(optionLabel: string): Promise<void> {
  await this.page
    .locator(".studio-tree-node")
    .filter({ hasText: new RegExp(`^${optionLabel}`) })
    .locator(".studio-section-hdr")
    .click();
}
```

---

## 5. Complete Spec Files

### `tests/e2e/studio-app/selection.spec.ts`

No writes. Validates postMessage protocol and tab auto-selection.

```typescript
import { test, expect } from "../shared/fixtures.js";

test("clicking a CVA component shows its name and activates Instance tab", async ({ surfacePage }) => {
  await surfacePage.selectElement('[data-slot="alert"]');
  const name = await surfacePage.getElementName();
  expect(name.toLowerCase()).toContain("alert");
  await expect(surfacePage.page.locator('[data-testid="editor-tab-instance"]')).toHaveClass(/active/);
});

test("clicking a plain HTML element shows <tag> format", async ({ surfacePage }) => {
  await surfacePage.selectElement("main");
  const name = await surfacePage.getElementName();
  expect(name).toMatch(/^<\w+>$/);
});

test("clicking different elements updates the panel", async ({ surfacePage }) => {
  await surfacePage.selectElement("main");
  const first = await surfacePage.getElementName();
  await surfacePage.selectElement('[data-slot="alert"]');
  const second = await surfacePage.getElementName();
  expect(first).not.toBe(second);
});

test("Component tab is only shown for CVA components", async ({ surfacePage }) => {
  await surfacePage.selectElement("main");
  await expect(surfacePage.page.locator('[data-testid="editor-tab-component"]')).not.toBeVisible();

  await surfacePage.selectElement('[data-slot="alert"]');
  await expect(surfacePage.page.locator('[data-testid="editor-tab-component"]')).toBeVisible();
});
```

---

### `tests/e2e/studio-app/component-props.spec.ts`

Component tab → Props sub-tab → `POST /api/component`. Writes to **alert.tsx** (component definition).

```typescript
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALERT_TSX = path.resolve(__dirname, "../../../demos/studio-app/components/ui/alert.tsx");

test("Component tab Props sub-tab is active by default", async ({ surfacePage }) => {
  await surfacePage.selectElement('[data-slot="alert"]');
  await surfacePage.switchTab("Component");
  await expect(surfacePage.page.locator('[data-testid="component-subtab-props"]')).toHaveClass(/active/);
});

test("Component tab Props sub-tab shows variant dimension sections", async ({ surfacePage }) => {
  await surfacePage.selectElement('[data-slot="alert"]');
  await surfacePage.switchTab("Component");
  // Variant section header should be present
  await expect(surfacePage.page.locator('[data-testid="component-variant-section-variant"]')).toBeVisible();
  await expect(surfacePage.page.locator('[data-testid="component-variant-section-size"]')).toBeVisible();
});

test("editing a variant option class writes to the component definition file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(ALERT_TSX);

  await surfacePage.selectElement('[data-slot="alert"]');
  await surfacePage.switchTab("Component");
  await surfacePage.switchSubTab("component", "props");

  // Expand the 'variant' section
  await surfacePage.expandComponentVariantSection("variant");
  // Expand the 'warning' option
  await surfacePage.expandVariantOption("warning");

  // Change padding within the warning variant — use the scale arbitrary input for padding
  await surfacePage.setScaleValue("padding-top", "pt-3");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(ALERT_TSX);
  expect(updated).toContain("pt-3");
});
```

---

### `tests/e2e/studio-app/component-styles.spec.ts`

Component tab → Styles sub-tab → `POST /api/write-element` replaceClass. Writes to **alert.tsx**.

```typescript
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALERT_TSX = path.resolve(__dirname, "../../../demos/studio-app/components/ui/alert.tsx");

test("Component tab Styles sub-tab shows the property panel", async ({ surfacePage }) => {
  await surfacePage.selectElement('[data-slot="alert"]');
  await surfacePage.switchTab("Component");
  await surfacePage.switchSubTab("component", "styles");
  // Property panel sections should be visible
  await expect(surfacePage.page.locator('.studio-section-hdr').first()).toBeVisible();
});

test("editing a style in Component Styles sub-tab writes to the component definition file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(ALERT_TSX);

  await surfacePage.selectElement('[data-slot="alert"]');
  await surfacePage.switchTab("Component");
  await surfacePage.switchSubTab("component", "styles");

  // Change padding-left via the arbitrary scale input
  await surfacePage.setScaleValue("padding-left", "pl-6");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(ALERT_TSX);
  expect(updated).toContain("pl-6");
});
```

---

### `tests/e2e/studio-app/instance-props.spec.ts`

Instance tab → Props sub-tab → `POST /api/write-element` type:prop. Writes to **page.tsx** (usage site).

```typescript
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE_TSX = path.resolve(__dirname, "../../../demos/studio-app/app/(marketing)/page.tsx");

test("Instance tab Props sub-tab shows variant dropdowns for CVA components", async ({
  surfacePage,
}) => {
  await surfacePage.selectElement('[data-slot="badge"]');
  // Instance tab is auto-selected; Props sub-tab should be default
  await surfacePage.switchSubTab("instance", "props");
  // variant and size dropdowns should be visible
  await expect(surfacePage.page.locator('[data-testid="instance-prop-variant"]')).toBeVisible();
  await expect(surfacePage.page.locator('[data-testid="instance-prop-size"]')).toBeVisible();
});

test("changing a variant prop writes to the usage site file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(PAGE_TSX);

  await surfacePage.selectElement('[data-slot="badge"]');
  await surfacePage.switchSubTab("instance", "props");

  // Current variant is "secondary" — change to "destructive"
  await surfacePage.selectInstanceProp("variant", "destructive");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(PAGE_TSX);
  expect(updated).toContain('variant="destructive"');
  expect(updated).not.toContain('variant="secondary"');
});

test("changing a size prop writes to the usage site file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(PAGE_TSX);

  await surfacePage.selectElement('[data-slot="badge"]');
  await surfacePage.switchSubTab("instance", "props");

  // Current size is "sm" — change to "lg"
  await surfacePage.selectInstanceProp("size", "lg");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(PAGE_TSX);
  expect(updated).toContain('size="lg"');
});
```

---

### `tests/e2e/studio-app/instance-styles.spec.ts`

Instance tab → Styles sub-tab → `POST /api/write-element` type:instanceOverride. Writes to **page.tsx** (usage site).

```typescript
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE_TSX = path.resolve(__dirname, "../../../demos/studio-app/app/(marketing)/page.tsx");

test("Instance tab Styles sub-tab shows property panel", async ({ surfacePage }) => {
  await surfacePage.selectElement('[data-slot="badge"]');
  await surfacePage.switchSubTab("instance", "styles");
  await expect(surfacePage.page.locator('.studio-section-hdr').first()).toBeVisible();
});

test("adding a class override writes instanceOverride to the usage site file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(PAGE_TSX);

  await surfacePage.selectElement('[data-slot="badge"]');
  await surfacePage.switchSubTab("instance", "styles");

  // Add a margin-top class override
  await surfacePage.setScaleValue("margin-top", "mt-2");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(PAGE_TSX);
  // The instanceOverride write adds className to the Badge usage in page.tsx
  expect(updated).toContain("mt-2");
});
```

---

### `tests/e2e/studio-app/element-tailwind.spec.ts`

Element tab (plain element, Tailwind mode) → `POST /api/write-element` replaceClass. Writes to **page.tsx**.

```typescript
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE_TSX = path.resolve(__dirname, "../../../demos/studio-app/app/(marketing)/page.tsx");

test("Element tab is shown for plain HTML elements", async ({ surfacePage }) => {
  await surfacePage.selectElement("main");
  const name = await surfacePage.getElementName();
  expect(name).toBe("<main>");
  await expect(surfacePage.page.locator('[data-testid="editor-tab-component"]')).not.toBeVisible();
});

test("replacing a Tailwind class on a plain element writes to source file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(PAGE_TSX);

  await surfacePage.selectElement("main");
  // main has px-4 — change to px-6
  await surfacePage.setScaleValue("padding-left", "px-6");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(PAGE_TSX);
  expect(updated).toContain("px-6");
  expect(updated).not.toContain("px-4");
});
```

---

### `tests/e2e/vite-app/element-tailwind.spec.ts`

Same write path as above but via Vite plugin rather than Next.js plugin.

```typescript
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_TSX = path.resolve(__dirname, "../../../demos/vite-app/src/App.tsx");

test("replacing a Tailwind class in a Vite app writes to source file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(APP_TSX);

  // header has h-14 — change to h-16
  await surfacePage.frame.locator("header").click({ force: true });
  await surfacePage.page.waitForSelector('[data-testid="editor-element-name"]');

  await surfacePage.setScaleValue("height", "h-16");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(APP_TSX);
  expect(updated).toContain("h-16");
  expect(updated).not.toContain("h-14");
});
```

---

### `tests/e2e/css-app/element-css.spec.ts`

Element tab, plain CSS mode → `POST /api/write-element` cssProperty. Writes to **styles.css**.

```typescript
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STYLES_CSS = path.resolve(__dirname, "../../../demos/css-app/src/styles.css");

test("changing a CSS property writes to the source stylesheet", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(STYLES_CSS);

  await surfacePage.selectElement(".card");
  await surfacePage.setScaleValue("border-radius", "20px");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(STYLES_CSS);
  expect(updated).toMatch(/\.card\s*\{[^}]*border-radius:\s*20px/s);
});
```

---

### `tests/e2e/css-modules-app/element-css-modules.spec.ts`

Element tab, CSS Modules mode → `POST /api/write-element` cssProperty. Writes to **.module.css**.

```typescript
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_MODULE_CSS = path.resolve(
  __dirname,
  "../../../demos/css-modules-app/src/App.module.css"
);

test("changing padding in a CSS Module writes to .module.css", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(APP_MODULE_CSS);

  await surfacePage.frame.locator('[class*="page"]').first().click({ force: true });
  await surfacePage.page.waitForSelector('[data-testid="editor-element-name"]');

  await surfacePage.setScaleValue("padding", "48px");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(APP_MODULE_CSS);
  expect(updated).toMatch(/\.page\s*\{[^}]*padding:\s*48px/s);
});
```

---

### `tests/e2e/design-system/token-color.spec.ts`

Token tab → color token edit → `POST /api/tokens`. Writes to **globals.css**.

```typescript
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLOBALS_CSS = path.resolve(
  __dirname,
  "../../../demos/design-system/app/globals.css"
);

test("Token tab is visible without selecting an element", async ({ surfacePage }) => {
  // Token tab is always visible — it has content even without an element selected
  await expect(surfacePage.page.locator('[data-testid="editor-tab-token"]')).not.toBeVisible();
  // Token content renders in the default (no selection) state
  await expect(surfacePage.page.locator('[data-testid^="token-row-"]').first()).toBeVisible({
    timeout: 10_000,
  });
});

test("editing a color token writes the updated value to the CSS file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(GLOBALS_CSS);

  const tokenRow = surfacePage.page.locator('[data-testid="token-row-primary-500"]');
  await tokenRow.waitFor({ timeout: 10_000 });

  // The ColorInput renders a swatch button and a text value input — open the swatch
  await tokenRow.locator('button[class*="swatch"], button[class*="color"]').first().click();

  // Find the hex/value input inside the color picker popover
  const colorInput = surfacePage.page.locator('.studio-popover input[type="text"]').last();
  await colorInput.fill("#ff1234");
  await colorInput.press("Enter");

  await surfacePage.waitForSave();

  const updated = await sourceFile.read(GLOBALS_CSS);
  expect(updated).toContain("#ff1234");
});
```

---

## 6. Implementation Sequence

| Step | File(s) | Why this order |
|------|---------|----------------|
| 1 | Add `data-testid` anchors to `editor-panel.tsx` (sub-tabs + InstanceVariantSection + ComponentVariantSection) | Needed before any Component/Instance tests can run |
| 2 | Extend `tests/e2e/shared/fixtures.ts` with `switchSubTab`, `selectInstanceProp`, `expandComponentVariantSection`, `expandVariantOption` | Needed by all Component/Instance specs |
| 3 | `tests/e2e/studio-app/selection.spec.ts` | No writes, fastest smoke validation |
| 4 | `tests/e2e/vite-app/element-tailwind.spec.ts` | Simplest write path (Vite, plain element, 1 file) |
| 5 | `tests/e2e/css-app/element-css.spec.ts` | CSS mode write |
| 6 | `tests/e2e/css-modules-app/element-css-modules.spec.ts` | CSS Modules write |
| 7 | `tests/e2e/studio-app/element-tailwind.spec.ts` | Next.js plain element write |
| 8 | `tests/e2e/studio-app/instance-props.spec.ts` | Instance props (prop write, usage site) |
| 9 | `tests/e2e/studio-app/instance-styles.spec.ts` | Instance styles (instanceOverride) |
| 10 | `tests/e2e/studio-app/component-props.spec.ts` | Component props (most complex — nested tree) |
| 11 | `tests/e2e/studio-app/component-styles.spec.ts` | Component styles |
| 12 | `tests/e2e/design-system/token-color.spec.ts` | Token write |

---

## 7. Before Running Tests

1. Build surface: `npm run build:surface` (tests run against `dist/cli.js`)
2. Run: `npm run test:e2e -- --project=vite` (single project to start)
3. Run all: `npm run test:e2e`
4. Debug: `npm run test:e2e:ui`
