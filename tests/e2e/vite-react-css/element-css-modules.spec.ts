/**
 * element-css-modules.spec.ts
 * CSS Modules write path — edits a CSS property on a CSS-module-styled element
 * and verifies the change is written to the .module.css file.
 */
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_CSS = path.resolve(__dirname, "../../../demos/vite-react-css/src/StatusCard.module.css");

test("changing font-size on a CSS Module element writes to the .module.css file", async ({
  surfacePage, sourceFile,
}) => {
  await sourceFile.track(MODULE_CSS);

  // Select the StatusCard's <h3> title (clicking the card center lands on the title)
  await surfacePage.selectElement('[data-testid="module-card"] h3');
  await surfacePage.switchTab("Element");
  await surfacePage.expandSection("TYPOGRAPHY");
  await surfacePage.setScaleValue("font-size", "2rem");
  await surfacePage.waitForSave();

  const updated = await sourceFile.read(MODULE_CSS);
  expect(updated).toMatch(/\.title\s*\{[^}]*font-size:\s*2rem/s);
});
