/**
 * selection.spec.ts — Smoke: iframe click → panel shows element + correct tab auto-selected.
 * No file writes. Validates the core postMessage protocol and tab auto-selection logic.
 */
import { test, expect } from "../shared/fixtures.js";

test("clicking a CVA component shows its name and activates the Instance tab", async ({ surfacePage }) => {
  await surfacePage.selectElement('[data-slot="alert"]');
  const name = await surfacePage.getElementName();
  expect(name.toLowerCase()).toContain("alert");
  await expect(surfacePage.page.locator('[data-testid="editor-tab-instance"]')).toHaveClass(/active/);
});

test("clicking a plain HTML element shows <tag> format", async ({ surfacePage }) => {
  // Use nav in the layout — a plain HTML element with no data-slot
  await surfacePage.selectElement("nav");
  const name = await surfacePage.getElementName();
  expect(name).toMatch(/^<\w+>$/);
});

test("clicking different elements updates the panel", async ({ surfacePage }) => {
  // Select a plain HTML element first (nav click hits <a> child)
  await surfacePage.selectElement("nav");
  const first = await surfacePage.getElementName();
  expect(first).toMatch(/^<\w+>$/);

  // Select a CVA component — should show its component name
  await surfacePage.selectElement('[data-slot="button"]:has-text("Go")');
  const second = await surfacePage.getElementName();
  expect(second).toBe("Button");
});

test("Component tab is only shown for CVA components", async ({ surfacePage }) => {
  await surfacePage.selectElement("nav");
  await expect(surfacePage.page.locator('[data-testid="editor-tab-component"]')).not.toBeVisible();

  await surfacePage.selectElement('[data-slot="alert"]');
  await expect(surfacePage.page.locator('[data-testid="editor-tab-component"]')).toBeVisible();
});
