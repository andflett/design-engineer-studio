/**
 * basic.spec.ts (astro-app)
 * Plain CSS + CSS variables via Astro plugin — token edit + element CSS edit.
 */
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.resolve(__dirname, "../../../demos/astro-css");
const GLOBAL_CSS = path.join(DEMO, "src/styles/global.css");

test("editing a radius token writes the updated value to the CSS file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(GLOBAL_CSS);

  // Select any element so editor tabs appear, then switch to Tokens
  await surfacePage.selectElement("main");
  await surfacePage.switchTab("Tokens");
  await surfacePage.expandSection("Radii");

  // Ensure Radii section is expanded
  const radiiContent = surfacePage.page.locator("text=radius").first();
  const radiiVisible = await radiiContent.isVisible().catch(() => false);
  if (!radiiVisible) {
    await surfacePage.expandSection("Radii");
  }

  // Find the radius row and edit its value
  const input = surfacePage.page.locator("text=radius").first().locator("..").locator("input");
  await input.click();
  await input.fill("12px");
  await input.press("Enter");

  // Token saves don't trigger the element save indicator — poll the file
  await expect(async () => {
    const content = await sourceFile.read(GLOBAL_CSS);
    expect(content).toContain("12px");
  }).toPass({ timeout: 8_000 });
});

test("changing a CSS property on an element writes to the stylesheet", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(GLOBAL_CSS);

  // Edit the .hero h1's font-size
  const PAGE_ASTRO = path.join(DEMO, "src/pages/index.astro");
  await sourceFile.track(PAGE_ASTRO);

  await surfacePage.selectElement(".hero h1");
  await surfacePage.switchTab("Element");
  await surfacePage.expandSection("Typography");
  await surfacePage.setScaleValue("font-size", "3rem");
  await surfacePage.waitForSave();

  // The write could go to either the .astro scoped style or global.css
  const pageContent = await sourceFile.read(PAGE_ASTRO);
  const cssContent = await sourceFile.read(GLOBAL_CSS);
  const hasChange = pageContent.includes("3rem") || cssContent.includes("font-size: 3rem");
  expect(hasChange).toBe(true);
});
