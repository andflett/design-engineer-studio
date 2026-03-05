/**
 * token-color.spec.ts
 * Token tab → token editing → POST /api/tokens
 * Writes to: demos/next-react-tailwind/app/globals.css
 */
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLOBALS_CSS = path.resolve(
  __dirname,
  "../../../demos/next-react-tailwind/app/globals.css"
);

test("Token tab shows section headers without an element selected", async ({ surfacePage }) => {
  // Token sections (Colors, Shadows, Radii, etc.) are rendered in the default state
  await expect(
    surfacePage.page.locator(".studio-section-hdr").first()
  ).toBeVisible({ timeout: 10_000 });
});

test("editing a radius token writes the updated value to the CSS file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(GLOBALS_CSS);

  // Select any element to ensure editor is active, then switch to Tokens tab
  await surfacePage.selectElement("main.mx-auto");
  await surfacePage.switchTab("Tokens");

  // Expand Radii section
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
    const content = await sourceFile.read(GLOBALS_CSS);
    expect(content).toContain("0.375rem");
  }).toPass({ timeout: 8_000 });
});
