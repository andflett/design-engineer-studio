/**
 * basic.spec.ts (tailwind-v3-app)
 * Tailwind v3 via Vite plugin — token edit + element class edit.
 */
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.resolve(__dirname, "../../../demos/vite-react-tailwind-v3");
const INDEX_CSS = path.join(DEMO, "src/index.css");
const APP_TSX = path.join(DEMO, "src/App.tsx");

test("editing a radius token writes the updated value to the CSS file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(INDEX_CSS);

  // Select any element so editor tabs appear, then switch to Tokens
  await surfacePage.selectElement("header");
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
  await input.fill("0.75rem");
  await input.press("Enter");

  // Token saves don't trigger the element save indicator — poll the file
  await expect(async () => {
    const content = await sourceFile.read(INDEX_CSS);
    expect(content).toContain("--radius-md: 0.75rem");
  }).toPass({ timeout: 8_000 });
});

test("replacing a Tailwind class writes to the source file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(APP_TSX);

  // h1 has text-3xl — change font-size to text-4xl
  await surfacePage.selectElement("h1");
  await surfacePage.expandSection("Typography");
  await surfacePage.setScaleValue("font-size", "text-4xl");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(APP_TSX);
  expect(updated).toContain("text-4xl");
  expect(updated).not.toContain("text-3xl");
});
