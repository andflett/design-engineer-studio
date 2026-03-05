/**
 * token-add-delete.spec.ts
 * Verify add/delete for Colors, Radii, Borders, and Shadows sections.
 * Uses the css-app demo (Vite + CSS Custom Properties).
 * Writes to: demos/vite-react-css/src/styles.css
 */
import { test, expect } from "../shared/fixtures.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STYLES_CSS = path.resolve(__dirname, "../../../demos/vite-react-css/src/styles.css");

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

test.describe("Token creation and deletion", () => {
  // TokenEditor is shown by default when no element is selected.

  test("add a new color token via UI, verify in CSS, delete via API", async ({
    surfacePage,
    sourceFile,
  }) => {
    await sourceFile.track(STYLES_CSS);
    const page = surfacePage.page;

    await expandSection(page, "Colors");

    // Click "Add color" button
    const addBtn = page.locator("button", { hasText: "Add color" });
    await addBtn.waitFor({ timeout: 5_000 });
    await addBtn.click();

    // Fill in the name
    const nameInput = page.locator(".studio-input-sm").first();
    await nameInput.clear();
    await nameInput.fill("test-brand");

    // Click Save
    await page.locator("button", { hasText: "Save" }).first().click();

    // Wait for the token to appear in the CSS file
    await waitForTokenInFile(STYLES_CSS, "--test-brand:");

    // Delete via the server API directly (the token row may be in a collapsed subsection)
    const deleteRes = await page.evaluate(async () => {
      const res = await fetch("/api/tokens/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: "src/styles.css",
          token: "--test-brand",
          selector: ":root",
        }),
      });
      return res.json();
    });
    expect(deleteRes.ok).toBe(true);

    // Verify the token is removed from the CSS file
    await waitForTokenRemoved(STYLES_CSS, "--test-brand:");
  });

  test("add a new radius token, verify it in CSS, then delete it", async ({
    surfacePage,
    sourceFile,
  }) => {
    await sourceFile.track(STYLES_CSS);
    const page = surfacePage.page;

    await expandSection(page, "Radii");

    const addBtn = page.locator("button", { hasText: "Add radius" });
    await addBtn.waitFor({ timeout: 5_000 });
    await addBtn.click();

    const nameInput = page.locator(".studio-input-sm").first();
    await nameInput.clear();
    await nameInput.fill("radius-test");

    await page.locator("button", { hasText: "Save" }).first().click();

    await waitForTokenInFile(STYLES_CSS, "--radius-test:");

    await page.waitForTimeout(1500);

    // Find and delete
    const scaleRow = page.locator(".group\\/scale", { hasText: "radius-test" });
    await scaleRow.hover();
    await scaleRow.locator('button[title="Delete"]').click();

    await waitForTokenRemoved(STYLES_CSS, "--radius-test:");
  });

  test("add a new border width token, verify it in CSS, then delete it", async ({
    surfacePage,
    sourceFile,
  }) => {
    await sourceFile.track(STYLES_CSS);
    const page = surfacePage.page;

    await expandSection(page, "Borders");

    const addBtn = page.locator("button", { hasText: "Add border width" });
    await addBtn.waitFor({ timeout: 5_000 });
    await addBtn.click();

    const nameInput = page.locator(".studio-input-sm").first();
    await nameInput.clear();
    await nameInput.fill("border-width-test");

    await page.locator("button", { hasText: "Save" }).first().click();

    await waitForTokenInFile(STYLES_CSS, "--border-width-test:");

    await page.waitForTimeout(1500);

    const scaleRow = page.locator(".group\\/scale", { hasText: "border-width-test" });
    await scaleRow.hover();
    await scaleRow.locator('button[title="Delete"]').click();

    await waitForTokenRemoved(STYLES_CSS, "--border-width-test:");
  });

  test("add a new shadow token, verify it in CSS, then delete it", async ({
    surfacePage,
    sourceFile,
  }) => {
    await sourceFile.track(STYLES_CSS);
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

    await waitForTokenInFile(STYLES_CSS, "--shadow-test:");

    await page.waitForTimeout(1500);

    // Find and delete
    const shadowRow = page.locator(".group\\/shadow", { hasText: "shadow-test" });
    await shadowRow.hover();
    await shadowRow.locator('button[title="Delete shadow"]').click();

    await waitForTokenRemoved(STYLES_CSS, "--shadow-test:");
  });
});
