/**
 * token-add-delete.spec.ts
 * Verify add/delete for Colors, Radii, Borders, and Shadows sections.
 * Uses the vite-react-tailwind demo (Tailwind v4 + @theme inline block).
 * Writes to: demos/vite-react-tailwind/src/app.css
 */
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_CSS = path.resolve(__dirname, "../../../demos/vite-react-tailwind/src/app.css");

/** Wait for a token to appear in the CSS file (polls up to 5s). */
async function waitForTokenInFile(filePath: string, token: string, timeout = 5_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const content = await fs.readFile(filePath, "utf-8");
    if (content.includes(token)) return content;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Token "${token}" not found in file after ${timeout}ms`);
}

/** Wait for a token to be removed from the CSS file (polls up to 5s). */
async function waitForTokenRemoved(filePath: string, token: string, timeout = 5_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const content = await fs.readFile(filePath, "utf-8");
    if (!content.includes(token)) return content;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Token "${token}" still in file after ${timeout}ms`);
}

// Helper: expand a section in the Tokens tab by its title text
async function expandSection(page: import("@playwright/test").Page, title: string) {
  const section = page.locator(".studio-section-hdr", { hasText: title });
  await section.click();
  await page.waitForTimeout(300);
}

test.describe("Token creation and deletion (Tailwind v4 @theme)", () => {
  test("add a new color token via UI, verify in CSS, delete via API", async ({
    surfacePage,
    sourceFile,
  }) => {
    await sourceFile.track(APP_CSS);
    const page = surfacePage.page;

    await expandSection(page, "Colors");

    // Click "Add color" button
    const addBtn = page.locator("button", { hasText: "Add color" });
    await addBtn.waitFor({ timeout: 5_000 });
    await addBtn.click();

    // Fill in the name
    const nameInput = page.locator(".studio-input-sm").first();
    await nameInput.clear();
    await nameInput.fill("color-test-brand");

    // Click Save
    await page.locator("button", { hasText: "Save" }).first().click();

    // Wait for the token to appear in the CSS file
    await waitForTokenInFile(APP_CSS, "--color-test-brand:");

    // Delete via the server API directly (uses @theme selector for Tailwind v4)
    const deleteRes = await page.evaluate(async () => {
      const res = await fetch("/api/tokens/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: "src/app.css",
          token: "--color-test-brand",
          selector: "@theme",
        }),
      });
      return res.json();
    });
    expect(deleteRes.ok).toBe(true);

    // Verify the token is removed from the CSS file
    await waitForTokenRemoved(APP_CSS, "--color-test-brand:");
  });

  test("add a new radius token, verify it in CSS, then delete it", async ({
    surfacePage,
    sourceFile,
  }) => {
    await sourceFile.track(APP_CSS);
    const page = surfacePage.page;

    await expandSection(page, "Radii");

    const addBtn = page.locator("button", { hasText: "Add radius" });
    await addBtn.waitFor({ timeout: 5_000 });
    await addBtn.click();

    const nameInput = page.locator(".studio-input-sm").first();
    await nameInput.clear();
    await nameInput.fill("radius-test");

    await page.locator("button", { hasText: "Save" }).first().click();

    await waitForTokenInFile(APP_CSS, "--radius-test:");

    await page.waitForTimeout(1500);

    // Find and delete
    const scaleRow = page.locator(".group\\/scale", { hasText: "radius-test" });
    await scaleRow.hover();
    await scaleRow.locator('button[title="Delete"]').click();

    await waitForTokenRemoved(APP_CSS, "--radius-test:");
  });

  test("add a new border width token, verify it in CSS, then delete it", async ({
    surfacePage,
    sourceFile,
  }) => {
    await sourceFile.track(APP_CSS);
    const page = surfacePage.page;

    await expandSection(page, "Borders");

    const addBtn = page.locator("button", { hasText: "Add border width" });
    await addBtn.waitFor({ timeout: 5_000 });
    await addBtn.click();

    const nameInput = page.locator(".studio-input-sm").first();
    await nameInput.clear();
    await nameInput.fill("border-width-test");

    await page.locator("button", { hasText: "Save" }).first().click();

    await waitForTokenInFile(APP_CSS, "--border-width-test:");

    await page.waitForTimeout(1500);

    const scaleRow = page.locator(".group\\/scale", { hasText: "border-width-test" });
    await scaleRow.hover();
    await scaleRow.locator('button[title="Delete"]').click();

    await waitForTokenRemoved(APP_CSS, "--border-width-test:");
  });

  test("add a new shadow token, verify it in CSS, then delete it", async ({
    surfacePage,
    sourceFile,
  }) => {
    await sourceFile.track(APP_CSS);
    const page = surfacePage.page;

    await expandSection(page, "Shadows");

    const addBtn = page.locator("button", { hasText: "Add shadow" });
    await addBtn.waitFor({ timeout: 5_000 });
    await addBtn.click();

    const nameInput = page.locator('.studio-input-sm[placeholder="shadow-name"]');
    await nameInput.clear();
    await nameInput.fill("shadow-test");

    // Click Save (uses the default preset shadow value)
    await page.locator("button", { hasText: "Save" }).first().click();

    await waitForTokenInFile(APP_CSS, "--shadow-test:");

    await page.waitForTimeout(1500);

    // Find and delete
    const shadowRow = page.locator(".group\\/shadow", { hasText: "shadow-test" });
    await shadowRow.hover();
    await shadowRow.locator('button[title="Delete shadow"]').click();

    await waitForTokenRemoved(APP_CSS, "--shadow-test:");
  });
});
