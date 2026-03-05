/**
 * Integration tests for the write-element API router.
 * Uses supertest against a real Express app with a fixture project.
 * Each test restores fixture files after modification.
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(__dirname, "fixtures", "project-a");

// Snapshot of fixture files for restoration
const originals: Map<string, string> = new Map();

// Dynamic import of the router (ESM)
let createWriteElementRouter: any;

beforeAll(async () => {
  // Read originals for all fixture files
  const files = await fs.readdir(FIXTURE_DIR);
  for (const f of files) {
    const full = path.join(FIXTURE_DIR, f);
    const stat = await fs.stat(full);
    if (stat.isFile()) {
      originals.set(full, await fs.readFile(full, "utf-8"));
    }
  }

  // Import the router
  const mod = await import("../packages/surface/src/server/api/write-element.js");
  createWriteElementRouter = mod.createWriteElementRouter;
});

afterEach(async () => {
  // Restore all fixture files
  for (const [filePath, content] of originals) {
    await fs.writeFile(filePath, content, "utf-8");
  }
});

function createApp(opts?: { stylingType?: string; cssFiles?: string[] }) {
  const app = express();
  app.use(express.json());
  const router = createWriteElementRouter({
    projectRoot: FIXTURE_DIR,
    stylingType: opts?.stylingType || "tailwind-v4",
    cssFiles: opts?.cssFiles || [],
  });
  app.use("/api/write-element", router);
  return app;
}

describe("POST /api/write-element — replaceClass", () => {
  it("replaces a class in a JSX file", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/write-element")
      .send({
        type: "replaceClass",
        source: { file: "page.tsx", line: 3, col: 4 },
        oldClass: "p-4",
        newClass: "p-8",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const updated = await fs.readFile(path.join(FIXTURE_DIR, "page.tsx"), "utf-8");
    expect(updated).toContain("p-8");
    expect(updated).not.toContain("p-4");
    expect(updated).toContain("flex"); // other classes preserved
  });

  it("returns 404 for element not found", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/write-element")
      .send({
        type: "replaceClass",
        source: { file: "page.tsx", line: 99, col: 0 },
        oldClass: "p-4",
        newClass: "p-8",
      });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/write-element — addClass", () => {
  it("adds a class to an existing className", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/write-element")
      .send({
        type: "addClass",
        source: { file: "page.tsx", line: 3, col: 4 },
        newClass: "gap-2",
      });

    expect(res.status).toBe(200);
    const updated = await fs.readFile(path.join(FIXTURE_DIR, "page.tsx"), "utf-8");
    expect(updated).toContain("gap-2");
    expect(updated).toContain("p-4"); // existing classes preserved
  });
});

describe("POST /api/write-element — changes (Tailwind auto-map)", () => {
  it("applies CSS value → Tailwind class changes", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/write-element")
      .send({
        source: { file: "page.tsx", line: 3, col: 4 },
        changes: [
          { property: "padding-top", value: "32px" },
        ],
      });

    expect(res.status).toBe(200);
    const updated = await fs.readFile(path.join(FIXTURE_DIR, "page.tsx"), "utf-8");
    // Without a resolved theme, padding-top 32px falls back to arbitrary value
    expect(updated).toContain("pt-[32px]");
  });

  it("uses hint.tailwindClass when provided", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/write-element")
      .send({
        source: { file: "page.tsx", line: 4, col: 6 },
        changes: [
          { property: "font-size", value: "20px", hint: { tailwindClass: "text-xl" } },
        ],
      });

    expect(res.status).toBe(200);
    const updated = await fs.readFile(path.join(FIXTURE_DIR, "page.tsx"), "utf-8");
    // text-lg should be replaced with text-xl
    expect(updated).toContain("text-xl");
    expect(updated).not.toContain("text-lg");
  });
});

describe("POST /api/write-element — cssProperty", () => {
  it("writes CSS property to module CSS file", async () => {
    const app = createApp({ stylingType: "css-modules" });
    const res = await request(app)
      .post("/api/write-element")
      .send({
        type: "cssProperty",
        source: { file: "component.tsx", line: 5, col: 4 },
        changes: [{ property: "padding", value: "24px" }],
      });

    expect(res.status).toBe(200);
    const css = await fs.readFile(path.join(FIXTURE_DIR, "component.module.css"), "utf-8");
    expect(css).toContain("padding: 24px;");
  });

  it("writes CSS property to project stylesheet", async () => {
    const app = createApp({
      stylingType: "plain-css",
      cssFiles: ["styles.css"],
    });
    const res = await request(app)
      .post("/api/write-element")
      .send({
        type: "cssProperty",
        source: { file: "plain.tsx", line: 3, col: 4 },
        changes: [{ property: "color", value: "green" }],
      });

    expect(res.status).toBe(200);
    const css = await fs.readFile(path.join(FIXTURE_DIR, "styles.css"), "utf-8");
    expect(css).toContain("color: green;");
  });

  it("falls back to inline style when no CSS file matches", async () => {
    const app = createApp({ stylingType: "plain-css", cssFiles: [] });
    const res = await request(app)
      .post("/api/write-element")
      .send({
        type: "cssProperty",
        source: { file: "page.tsx", line: 3, col: 4 },
        changes: [{ property: "background-color", value: "red" }],
      });

    expect(res.status).toBe(200);
    const jsx = await fs.readFile(path.join(FIXTURE_DIR, "page.tsx"), "utf-8");
    expect(jsx).toContain("backgroundColor");
    expect(jsx).toContain('"red"');
  });

  it("returns 400 for missing changes", async () => {
    const app = createApp({ stylingType: "plain-css" });
    const res = await request(app)
      .post("/api/write-element")
      .send({
        type: "cssProperty",
        source: { file: "page.tsx", line: 3, col: 4 },
      });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/write-element — scoped styles (.astro)", () => {
  it("writes CSS property to scoped <style> block in .astro file", async () => {
    const app = createApp({ stylingType: "plain-css", cssFiles: [] });
    const res = await request(app)
      .post("/api/write-element")
      .send({
        type: "cssProperty",
        source: { file: "scoped.astro", line: 4, col: 1 },
        changes: [{ property: "padding", value: "2rem" }],
      });

    expect(res.status).toBe(200);
    const content = await fs.readFile(path.join(FIXTURE_DIR, "scoped.astro"), "utf-8");
    expect(content).toContain("padding: 2rem;");
    // Frontmatter and template preserved
    expect(content).toContain('const title = "Hello";');
    expect(content).toContain('<div class="card">');
    // Other rules untouched
    expect(content).toContain("font-size: 2rem;");
  });

  it("prefers project stylesheet over scoped style when both match", async () => {
    // Add a .card rule to styles.css so it matches first
    const stylesPath = path.join(FIXTURE_DIR, "styles.css");
    const originalCss = await fs.readFile(stylesPath, "utf-8");
    await fs.writeFile(stylesPath, originalCss + "\n.card {\n  padding: 1rem;\n}\n", "utf-8");

    const app = createApp({ stylingType: "plain-css", cssFiles: ["styles.css"] });
    const res = await request(app)
      .post("/api/write-element")
      .send({
        type: "cssProperty",
        source: { file: "scoped.astro", line: 4, col: 1 },
        changes: [{ property: "padding", value: "3rem" }],
      });

    expect(res.status).toBe(200);
    // Should have written to styles.css (step 2), not the scoped block (step 2.5)
    const css = await fs.readFile(stylesPath, "utf-8");
    expect(css).toContain("padding: 3rem;");
    // Scoped block should be untouched
    const astro = await fs.readFile(path.join(FIXTURE_DIR, "scoped.astro"), "utf-8");
    expect(astro).toContain("padding: 1rem;");
  });
});

describe("POST /api/write-element — descendant selectors (.astro)", () => {
  it("writes CSS property via descendant selector for classless element", async () => {
    const app = createApp({ stylingType: "plain-css", cssFiles: [] });
    const res = await request(app)
      .post("/api/write-element")
      .send({
        type: "cssProperty",
        source: { file: "descendant.astro", line: 5, col: 1 },
        changes: [{ property: "color", value: "red" }],
      });

    expect(res.status).toBe(200);
    const content = await fs.readFile(path.join(FIXTURE_DIR, "descendant.astro"), "utf-8");
    // Should write to ".card h3" rule, not ".card"
    expect(content).toContain("color: red;");
    // ".card h3" block should be modified, .card block should be untouched
    expect(content).toContain(".card h3");
    expect(content).toContain("padding: 1rem;"); // .card rule preserved
  });

  it("prefers project stylesheet descendant selector over scoped style", async () => {
    // Add a .card h3 rule to styles.css
    const stylesPath = path.join(FIXTURE_DIR, "styles.css");
    const originalCss = await fs.readFile(stylesPath, "utf-8");
    await fs.writeFile(stylesPath, originalCss + "\n.card h3 {\n  color: navy;\n}\n", "utf-8");

    const app = createApp({ stylingType: "plain-css", cssFiles: ["styles.css"] });
    const res = await request(app)
      .post("/api/write-element")
      .send({
        type: "cssProperty",
        source: { file: "descendant.astro", line: 5, col: 1 },
        changes: [{ property: "color", value: "green" }],
      });

    expect(res.status).toBe(200);
    const css = await fs.readFile(stylesPath, "utf-8");
    expect(css).toContain("color: green;");
    // Scoped block should be untouched
    const astro = await fs.readFile(path.join(FIXTURE_DIR, "descendant.astro"), "utf-8");
    expect(astro).toContain("color: navy;");
  });
});

describe("POST /api/write-element — scoped styles (.svelte)", () => {
  it("writes CSS property to scoped <style> block in .svelte file", async () => {
    const app = createApp({ stylingType: "plain-css", cssFiles: [] });
    const res = await request(app)
      .post("/api/write-element")
      .send({
        type: "cssProperty",
        source: { file: "scoped.svelte", line: 5, col: 1 },
        changes: [{ property: "padding", value: "2rem" }],
      });

    expect(res.status).toBe(200);
    const content = await fs.readFile(path.join(FIXTURE_DIR, "scoped.svelte"), "utf-8");
    expect(content).toContain("padding: 2rem;");
    expect(content).toContain('let title = "Hello";');
    expect(content).toContain('<div class="card">');
    expect(content).toContain("font-size: 2rem;");
  });
});

describe("POST /api/write-element — replaceClass/addClass (.svelte)", () => {
  it("replaces a class in a .svelte file", async () => {
    const app = createApp({ stylingType: "tailwind-v4" });
    const res = await request(app)
      .post("/api/write-element")
      .send({
        type: "replaceClass",
        source: { file: "scoped.svelte", line: 5, col: 1 },
        oldClass: "card",
        newClass: "card-lg",
      });

    expect(res.status).toBe(200);
    const content = await fs.readFile(path.join(FIXTURE_DIR, "scoped.svelte"), "utf-8");
    expect(content).toContain('class="card-lg"');
    expect(content).not.toMatch(/class="card"/);
  });

  it("adds a class to a .svelte file", async () => {
    const app = createApp({ stylingType: "tailwind-v4" });
    const res = await request(app)
      .post("/api/write-element")
      .send({
        type: "addClass",
        source: { file: "scoped.svelte", line: 5, col: 1 },
        newClass: "mt-4",
      });

    expect(res.status).toBe(200);
    const content = await fs.readFile(path.join(FIXTURE_DIR, "scoped.svelte"), "utf-8");
    expect(content).toContain("mt-4");
    expect(content).toContain("card"); // original class preserved
  });
});

describe("POST /api/write-element — validation", () => {
  it("returns 400 for missing source", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/write-element")
      .send({ type: "replaceClass", oldClass: "p-4", newClass: "p-8" });

    expect(res.status).toBe(400);
  });

  it("returns 500 for path traversal attempts", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/write-element")
      .send({
        type: "replaceClass",
        source: { file: "../../etc/passwd", line: 1, col: 0 },
        oldClass: "a",
        newClass: "b",
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/outside/);
  });
});
