/**
 * component-styles.spec.ts
 * Component tab → Styles sub-tab → handleWriteElement replaceClass → POST /api/write-element
 * Writes to: demos/next-react-tailwind/components/ui/alert.tsx (component definition file)
 */
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALERT_TSX = path.resolve(__dirname, "../../../demos/next-react-tailwind/components/ui/alert.tsx");

test("Component tab Styles sub-tab shows the property panel", async ({ surfacePage }) => {
  await surfacePage.selectElement('[data-slot="alert"]');
  await surfacePage.switchTab("Component");
  await surfacePage.switchSubTab("component", "styles");
  await expect(surfacePage.page.locator(".studio-section-hdr").first()).toBeVisible();
});

test("editing a style in Component Styles sub-tab writes to the component definition file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(ALERT_TSX);

  await surfacePage.selectElement('[data-slot="alert"]');
  await surfacePage.switchTab("Component");
  await surfacePage.switchSubTab("component", "styles");

  // Alert base class has "rounded-lg" — change border-radius via the Border section
  await surfacePage.expandSection("Border");
  await surfacePage.setScaleValue("border-radius", "rounded-xl");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(ALERT_TSX);
  expect(updated).toContain("rounded-xl");
});
