/**
 * element-tailwind.spec.ts
 * Element tab (plain HTML element, Tailwind mode) → handleWriteElement replaceClass → POST /api/write-element
 * Writes to: demos/next-react-tailwind/app/layout.tsx (element source via Next.js plugin)
 */
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAYOUT_TSX = path.resolve(__dirname, "../../../demos/next-react-tailwind/app/layout.tsx");
const PAGE_TSX = path.resolve(__dirname, "../../../demos/next-react-tailwind/app/(marketing)/page.tsx");

test("Element tab is shown for plain HTML elements (no Component tab)", async ({ surfacePage }) => {
  // Clicking nav hits its <a> child — a plain HTML element with no data-slot
  await surfacePage.selectElement("nav");
  const name = await surfacePage.getElementName();
  expect(name).toMatch(/^<\w+>$/);
  await expect(surfacePage.page.locator('[data-testid="editor-tab-component"]')).not.toBeVisible();
});

test("replacing a Tailwind class on a layout element writes to source file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(LAYOUT_TSX);

  // Clicking nav selects an <a> child with "text-sm" in layout.tsx
  await surfacePage.selectElement("nav");
  await surfacePage.expandSection("Typography");
  await surfacePage.setScaleValue("font-size", "base");
  await surfacePage.waitForSave();

  await expect(async () => {
    const updated = await sourceFile.read(LAYOUT_TSX);
    expect(updated).toContain("text-base");
  }).toPass({ timeout: 8_000 });
});
