/**
 * basic.spec.ts (remix-app)
 * Tailwind v4 via Vite plugin (React Router v7) — token edit + element class edit.
 */
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.resolve(__dirname, "../../../demos/remix-react-tailwind");
const APP_CSS = path.join(DEMO, "app/app.css");
const HOME_TSX = path.join(DEMO, "app/routes/home.tsx");

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
  await input.fill("0.625rem");
  await input.press("Enter");

  // Token saves don't trigger the element save indicator — poll the file
  await expect(async () => {
    const content = await sourceFile.read(APP_CSS);
    expect(content).toContain("0.625rem");
  }).toPass({ timeout: 8_000 });
});

test("replacing a Tailwind class writes to the source file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(HOME_TSX);

  // header > div has h-14 — change height to h-16
  await surfacePage.selectElement("header > div");
  await surfacePage.expandSection("SIZE");
  await surfacePage.setScaleValue("height", "h-16");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(HOME_TSX);
  expect(updated).toContain("h-16");
  expect(updated).not.toContain("h-14");
});
