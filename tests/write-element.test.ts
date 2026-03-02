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
    // padding-top 32px = pt-8, should be appended since p-4 is "padding" not "paddingTop"
    expect(updated).toContain("pt-8");
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
