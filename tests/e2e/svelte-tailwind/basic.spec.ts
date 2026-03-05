/**
 * basic.spec.ts (svelte-tailwind)
 * SvelteKit + Tailwind v4 — token edit + Tailwind class edit.
 */
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.resolve(__dirname, "../../../demos/svelte-tailwind");
const APP_CSS = path.join(DEMO, "src/app.css");
const LAYOUT_SVELTE = path.join(DEMO, "src/routes/+layout.svelte");

test("editing a radius token writes the updated value to the CSS file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(APP_CSS);

  // Select any element so editor tabs appear, then switch to Tokens
  await surfacePage.selectElement("nav a");
  await surfacePage.switchTab("Tokens");

  // Ensure Radii section is expanded
  const radiiContent = surfacePage.page.locator("text=radius-sm").first();
  const radiiVisible = await radiiContent.isVisible().catch(() => false);
  if (!radiiVisible) {
    await surfacePage.expandSection("Radii");
  }

  // Find the radius-sm textbox and change its value
  const input = surfacePage.page.locator("text=radius-sm").first().locator("..").locator("input");
  await input.click();
  await input.fill("0.375rem");
  await input.press("Enter");

  // Token saves don't trigger the element save indicator — poll the file
  await expect(async () => {
    const content = await sourceFile.read(APP_CSS);
    expect(content).toContain("0.375rem");
  }).toPass({ timeout: 8_000 });
});

test("replacing a Tailwind class writes to the .svelte source file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(LAYOUT_SVELTE);

  // Select the nav's <a> which has "text-lg font-semibold text-indigo-600"
  await surfacePage.selectElement("nav a");
  await surfacePage.expandSection("Typography");
  await surfacePage.setScaleValue("font-size", "text-xl");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(LAYOUT_SVELTE);
  expect(updated).toContain("text-xl");
});
