import { test as base, expect, type Page, type FrameLocator } from "@playwright/test";
import fs from "fs/promises";

// ── SurfacePage ────────────────────────────────────────────────────────────────

export class SurfacePage {
  readonly page: Page;
  readonly frame: FrameLocator;

  constructor(page: Page) {
    this.page = page;
    this.frame = page.frameLocator("iframe");
  }

  /** Wait for Surface to signal iframe is ready (selection mode button becomes active). */
  async waitForIframeReady() {
    await this.page.waitForSelector('[data-testid="selection-mode-btn"][data-active="true"]', {
      timeout: 15_000,
    });
  }

  /** Click an element in the iframe and wait for the editor panel to show. */
  async selectElement(iframeSelector: string): Promise<void> {
    // frameLocator handles the CSS transform scale coordinate space correctly
    await this.frame.locator(iframeSelector).click({ force: true });
    await this.page.waitForSelector('[data-testid="editor-element-name"]', {
      timeout: 10_000,
    });
  }

  /** Read the element name shown in the editor panel header. */
  async getElementName(): Promise<string> {
    return this.page.locator('[data-testid="editor-element-name"]').textContent() ?? "";
  }

  /** Get text content of a property row value by CSS property name (kebab-case). */
  async getPropertyValue(cssProp: string): Promise<string> {
    return this.page
      .locator(`[data-testid="prop-row-${cssProp}"] [data-testid="prop-value"]`)
      .textContent() ?? "";
  }

  /** Switch to a named tab in the editor panel. */
  async switchTab(tab: "Tokens" | "Component" | "Instance" | "Element"): Promise<void> {
    await this.page
      .locator('[data-testid="editor-tabs"]')
      .getByRole("button", { name: tab })
      .click();
  }

  /** Use a scale input in arbitrary mode to set a value for a given CSS property. */
  async setScaleValue(cssProp: string, value: string): Promise<void> {
    const toggleBtn = this.page.locator(`[data-testid="scale-toggle-${cssProp}"]`);
    // Switch to arbitrary mode if not already
    const input = this.page.locator(`[data-testid="scale-arbitrary-input-${cssProp}"]`);
    const inputVisible = await input.isVisible().catch(() => false);
    if (!inputVisible) {
      await toggleBtn.click();
    }
    await input.clear();
    await input.fill(value);
    await input.press("Enter");
  }

  /** Change a scale dropdown selection for a given CSS property. */
  async setScaleDropdown(cssProp: string, value: string): Promise<void> {
    const trigger = this.page.locator(`[data-testid="scale-dropdown-${cssProp}"]`);
    await trigger.click();
    // Radix Select renders items in a portal — find by text
    await this.page.locator('[role="option"]').getByText(value, { exact: true }).click();
  }

  /** Switch to a Props or Styles sub-tab within the Component or Instance tab. */
  async switchSubTab(scope: "component" | "instance", tab: "props" | "styles"): Promise<void> {
    await this.page.locator(`[data-testid="${scope}-subtab-${tab}"]`).click();
  }

  /** Change an instance prop dimension via its StudioSelect dropdown. */
  async selectInstanceProp(dimName: string, value: string): Promise<void> {
    await this.page.locator(`[data-testid="instance-prop-${dimName}"]`).click();
    // StudioSelect uses Radix Popover with data-combobox-item buttons
    await this.page.locator('[data-combobox-item]').getByText(value, { exact: true }).click();
  }

  /** Expand a ComponentVariantSection by its dimension name. Clicks once — toggles open if collapsed. */
  async expandComponentVariantSection(dimName: string): Promise<void> {
    const header = this.page.locator(`[data-testid="component-variant-section-${dimName}"]`);
    await header.waitFor();
    // Check collapsed state: ChevronRightIcon is present when collapsed
    const isCollapsed = await header.locator('svg').first().isVisible();
    if (isCollapsed) await header.click();
  }

  /** Expand a specific option row inside an already-expanded variant section. */
  async expandVariantOption(optionLabel: string): Promise<void> {
    await this.page
      .locator(".studio-tree-node")
      .filter({ hasText: new RegExp(`^${optionLabel}`) })
      .locator(".studio-section-hdr")
      .click();
  }

  /** Expand a collapsed property section by its label (e.g. "BORDER", "SPACING"). */
  async expandSection(label: string): Promise<void> {
    await this.page.locator(".studio-section-hdr", { hasText: label }).click();
  }

  /** Wait for the "Saved" indicator, then an extra 600ms for HMR to settle. */
  async waitForSave(): Promise<void> {
    await this.page.waitForSelector('[data-testid="save-indicator"]', { timeout: 8_000 });
    await this.page.waitForTimeout(600);
  }
}

// ── SourceFileHelper ───────────────────────────────────────────────────────────

export class SourceFileHelper {
  private snapshots = new Map<string, string>();

  /** Register a file for restoration and return its current content. */
  async track(absolutePath: string): Promise<string> {
    const content = await fs.readFile(absolutePath, "utf-8");
    if (!this.snapshots.has(absolutePath)) {
      this.snapshots.set(absolutePath, content);
    }
    return content;
  }

  /** Read the current (possibly modified) content of a tracked file. */
  async read(absolutePath: string): Promise<string> {
    return fs.readFile(absolutePath, "utf-8");
  }

  /** Restore all tracked files to their original content. Runs in fixture teardown. */
  async restoreAll(): Promise<void> {
    for (const [filePath, content] of this.snapshots) {
      await fs.writeFile(filePath, content, "utf-8");
    }
    this.snapshots.clear();
  }
}

// ── Combined test export ───────────────────────────────────────────────────────

interface Fixtures {
  surfacePage: SurfacePage;
  sourceFile: SourceFileHelper;
}

export const test = base.extend<Fixtures>({
  surfacePage: async ({ page, baseURL }, use) => {
    await page.goto(baseURL ?? "http://localhost:4500");
    const sp = new SurfacePage(page);
    await sp.waitForIframeReady();
    await use(sp);
  },
  sourceFile: async ({}, use) => {
    const helper = new SourceFileHelper();
    await use(helper);
    // Runs even if test throws — restores all tracked files
    await helper.restoreAll();
  },
});

export { expect };
