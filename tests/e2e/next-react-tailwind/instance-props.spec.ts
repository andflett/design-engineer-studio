/**
 * instance-props.spec.ts
 * Instance tab → Props sub-tab → handleInstancePropChange → POST /api/write-element type:prop
 * Writes to: demos/next-react-tailwind/app/(marketing)/page.tsx (usage site)
 */
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE_TSX = path.resolve(__dirname, "../../../demos/next-react-tailwind/app/(marketing)/page.tsx");

// Target the Badge inside the table (line 55: variant="secondary" size="sm")
// Use :has-text to disambiguate from the Badge in PageHeader
const BADGE_SELECTOR = '[data-slot="badge"]:has-text("Active")';

test("Instance tab Props sub-tab shows variant dropdowns for CVA components", async ({
  surfacePage,
}) => {
  await surfacePage.selectElement(BADGE_SELECTOR);
  await surfacePage.switchSubTab("instance", "props");
  await expect(surfacePage.page.locator('[data-testid="instance-prop-variant"]')).toBeVisible();
  await expect(surfacePage.page.locator('[data-testid="instance-prop-size"]')).toBeVisible();
});

test("changing a variant prop writes to the usage site file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(PAGE_TSX);

  await surfacePage.selectElement(BADGE_SELECTOR);
  await surfacePage.switchSubTab("instance", "props");

  // Current variant is "secondary" — change to "destructive"
  await surfacePage.selectInstanceProp("variant", "destructive");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(PAGE_TSX);
  expect(updated).toContain('variant="destructive"');
});

test("changing a size prop writes to the usage site file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(PAGE_TSX);

  await surfacePage.selectElement(BADGE_SELECTOR);
  await surfacePage.switchSubTab("instance", "props");

  // Current size is "sm" — change to "lg"
  await surfacePage.selectInstanceProp("size", "lg");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(PAGE_TSX);
  expect(updated).toContain('size="lg"');
});
