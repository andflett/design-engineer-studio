/**
 * basic.spec.ts (vite-app)
 * Tailwind v4 via Vite plugin — token edit + element class edit.
 */
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.resolve(__dirname, "../../../demos/vite-react-tailwind");
const APP_CSS = path.join(DEMO, "src/app.css");
const APP_TSX = path.join(DEMO, "src/App.tsx");

test("editing a radius token writes the updated value to the CSS file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(APP_CSS);

  // Select any element so editor tabs appear, then switch to Tokens
  await surfacePage.selectElement("header");
  await surfacePage.switchTab("Tokens");

  // Ensure Radii section is expanded (click header to toggle if content not visible)
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

test("replacing a Tailwind class writes to the source file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(APP_TSX);

  // Select the header's inner div which has h-14
  await surfacePage.selectElement("header > div");
  await surfacePage.expandSection("SIZE");
  await surfacePage.setScaleValue("height", "h-16");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(APP_TSX);
  expect(updated).toContain("h-16");
  expect(updated).not.toContain("h-14");
});
