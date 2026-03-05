/**
 * component-props.spec.ts
 * Component tab → Props sub-tab — variant dimension sections and class editing.
 * Writes to: demos/next-react-tailwind/components/ui/alert.tsx (component definition file)
 */
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALERT_TSX = path.resolve(__dirname, "../../../demos/next-react-tailwind/components/ui/alert.tsx");

test("Component tab Props sub-tab is active by default", async ({ surfacePage }) => {
  await surfacePage.selectElement('[data-slot="alert"]');
  await surfacePage.switchTab("Component");
  await expect(surfacePage.page.locator('[data-testid="component-subtab-props"]')).toHaveClass(/active/);
});

test("Component tab Props sub-tab shows variant dimension sections", async ({ surfacePage }) => {
  await surfacePage.selectElement('[data-slot="alert"]');
  await surfacePage.switchTab("Component");
  await expect(surfacePage.page.locator('[data-testid="component-variant-section-variant"]')).toBeVisible();
  await expect(surfacePage.page.locator('[data-testid="component-variant-section-size"]')).toBeVisible();
});

test("expanding a variant option shows its class tokens", async ({ surfacePage }) => {
  await surfacePage.selectElement('[data-slot="alert"]');
  await surfacePage.switchTab("Component");
  await surfacePage.switchSubTab("component", "props");

  await surfacePage.expandComponentVariantSection("variant");
  await surfacePage.expandVariantOption("warning");

  // The warning variant shows its class tokens (Border, Background, Text labels)
  const page = surfacePage.page;
  await expect(page.locator("text=yellow-500/50").first()).toBeVisible({ timeout: 5_000 });
});
