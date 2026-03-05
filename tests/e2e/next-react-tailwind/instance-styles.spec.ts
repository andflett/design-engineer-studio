/**
 * instance-styles.spec.ts
 * Instance tab → Styles sub-tab → handleInstanceOverride → POST /api/write-element type:instanceOverride
 * Writes to: demos/next-react-tailwind/app/(marketing)/page.tsx (usage site)
 */
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE_TSX = path.resolve(__dirname, "../../../demos/next-react-tailwind/app/(marketing)/page.tsx");

const BADGE_SELECTOR = '[data-slot="badge"]:has-text("Active")';

test("Instance tab Styles sub-tab shows the property panel", async ({ surfacePage }) => {
  await surfacePage.selectElement(BADGE_SELECTOR);
  await surfacePage.switchSubTab("instance", "styles");
  await expect(surfacePage.page.locator(".studio-section-hdr").first()).toBeVisible();
});

test("adding a class override writes instanceOverride to the usage site file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(PAGE_TSX);

  await surfacePage.selectElement(BADGE_SELECTOR);
  await surfacePage.switchSubTab("instance", "styles");

  // Add a font-size override on this Badge instance (Badge doesn't have font-size in base)
  await surfacePage.expandSection("Typography");
  await surfacePage.setScaleValue("font-size", "text-lg");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(PAGE_TSX);
  expect(updated).toContain("text-lg");
});
