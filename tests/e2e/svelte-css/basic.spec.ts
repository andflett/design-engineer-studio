/**
 * basic.spec.ts (svelte-css-app)
 * Scoped CSS + CSS variables via Svelte plugin — token edit + element CSS edit.
 */
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.resolve(__dirname, "../../../demos/svelte-css");
const APP_CSS = path.join(DEMO, "src/app.css");
const PAGE_SVELTE = path.join(DEMO, "src/routes/+page.svelte");

test("editing a radius token writes the updated value to the CSS file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(APP_CSS);

  // Select any element so editor tabs appear, then switch to Tokens
  await surfacePage.selectElement("main");
  await surfacePage.switchTab("Tokens");
  await surfacePage.expandSection("Radii");

  // Ensure Radii section is expanded
  const radiiContent = surfacePage.page.locator("text=radius-md").first();
  const radiiVisible = await radiiContent.isVisible().catch(() => false);
  if (!radiiVisible) {
    await surfacePage.expandSection("Radii");
  }

  // Find the radius-md row and edit its value
  const input = surfacePage.page.locator("text=radius-md").first().locator("..").locator("input");
  await input.click();
  await input.fill("1rem");
  await input.press("Enter");

  // Token saves don't trigger the element save indicator — poll the file
  await expect(async () => {
    const content = await sourceFile.read(APP_CSS);
    expect(content).toContain("--radius-md: 1rem");
  }).toPass({ timeout: 8_000 });
});

test("changing a CSS property on a scoped element writes to the .svelte file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(PAGE_SVELTE);

  // Click the hero title element
  await surfacePage.selectElement(".hero-title");
  await surfacePage.switchTab("Element");
  await surfacePage.expandSection("TYPOGRAPHY");
  await surfacePage.setScaleValue("font-size", "60px");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(PAGE_SVELTE);
  expect(updated).toContain("font-size: 60px");
});
