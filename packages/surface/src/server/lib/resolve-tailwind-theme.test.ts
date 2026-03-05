import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { resolveTailwindV4Theme } from "./resolve-tailwind-theme.js";

// These tests exercise the @theme block fallback parser (no @tailwindcss/node needed).
// The __unstable__loadDesignSystem API path is tested implicitly when @tailwindcss/node
// is available in the project — it's tried first and falls back to the parser.

describe("resolveTailwindV4Theme", () => {
  let tmpDir: string;

  async function writeCss(filename: string, content: string) {
    const filePath = path.join(tmpDir, filename);
    await fs.writeFile(filePath, content, "utf-8");
    return filename;
  }

  // Create a temp dir for each test
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "resolve-theme-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns null when no @theme blocks exist", async () => {
    await writeCss("globals.css", `:root { --color-primary: blue; }`);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).toBeNull();
  });

  it("returns null when @theme has only color variables (no scale variables)", async () => {
    await writeCss("globals.css", `
      @theme {
        --color-primary: oklch(0.6 0.2 250);
        --color-secondary: oklch(0.7 0.1 200);
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).toBeNull();
  });

  it("parses spacing variables from @theme", async () => {
    await writeCss("globals.css", `
      @theme {
        --spacing-sm: 4px;
        --spacing-md: 8px;
        --spacing-lg: 16px;
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).not.toBeNull();
    expect(result!.spacing).toEqual([
      { key: "sm", value: "4px" },
      { key: "md", value: "8px" },
      { key: "lg", value: "16px" },
    ]);
  });

  it("parses font-size variables from @theme", async () => {
    await writeCss("globals.css", `
      @theme {
        --font-size-tiny: 0.625rem;
        --font-size-body: 1rem;
        --font-size-heading: 2rem;
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).not.toBeNull();
    expect(result!.fontSize).toEqual([
      { key: "tiny", value: "0.625rem" },
      { key: "body", value: "1rem" },
      { key: "heading", value: "2rem" },
    ]);
  });

  it("parses font-weight variables", async () => {
    await writeCss("globals.css", `
      @theme {
        --font-weight-normal: 400;
        --font-weight-bold: 700;
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).not.toBeNull();
    expect(result!.fontWeight).toEqual([
      { key: "normal", value: "400" },
      { key: "bold", value: "700" },
    ]);
  });

  it("parses leading (line-height) variables", async () => {
    await writeCss("globals.css", `
      @theme {
        --leading-tight: 1.2;
        --leading-normal: 1.5;
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).not.toBeNull();
    expect(result!.lineHeight).toEqual([
      { key: "tight", value: "1.2" },
      { key: "normal", value: "1.5" },
    ]);
  });

  it("parses tracking (letter-spacing) variables", async () => {
    await writeCss("globals.css", `
      @theme {
        --tracking-tight: -0.02em;
        --tracking-normal: 0em;
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).not.toBeNull();
    expect(result!.letterSpacing).toEqual([
      { key: "tight", value: "-0.02em" },
      { key: "normal", value: "0em" },
    ]);
  });

  it("parses radius variables", async () => {
    await writeCss("globals.css", `
      @theme {
        --radius-sm: 0.25rem;
        --radius-lg: 1rem;
        --radius-full: 9999px;
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).not.toBeNull();
    expect(result!.borderRadius).toEqual([
      { key: "sm", value: "0.25rem" },
      { key: "lg", value: "1rem" },
      { key: "full", value: "9999px" },
    ]);
  });

  it("parses border-width variables", async () => {
    await writeCss("globals.css", `
      @theme {
        --border-thin: 1px;
        --border-thick: 4px;
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).not.toBeNull();
    expect(result!.borderWidth).toEqual([
      { key: "thin", value: "1px" },
      { key: "thick", value: "4px" },
    ]);
  });

  it("parses opacity variables", async () => {
    await writeCss("globals.css", `
      @theme {
        --opacity-dim: 0.3;
        --opacity-full: 1;
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).not.toBeNull();
    expect(result!.opacity).toEqual([
      { key: "dim", value: "0.3" },
      { key: "full", value: "1" },
    ]);
  });

  it("handles @theme inline blocks", async () => {
    await writeCss("globals.css", `
      @theme inline {
        --spacing-xs: 2px;
        --spacing-sm: 4px;
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).not.toBeNull();
    expect(result!.spacing).toEqual([
      { key: "xs", value: "2px" },
      { key: "sm", value: "4px" },
    ]);
  });

  it("merges @theme blocks from multiple CSS files", async () => {
    await writeCss("base.css", `
      @theme {
        --spacing-sm: 4px;
      }
    `);
    await writeCss("custom.css", `
      @theme {
        --spacing-lg: 16px;
        --font-size-body: 1rem;
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["base.css", "custom.css"]);
    expect(result).not.toBeNull();
    expect(result!.spacing).toEqual([
      { key: "sm", value: "4px" },
      { key: "lg", value: "16px" },
    ]);
    expect(result!.fontSize).toEqual([
      { key: "body", value: "1rem" },
    ]);
  });

  it("handles multiple @theme blocks in a single file", async () => {
    await writeCss("globals.css", `
      @theme {
        --spacing-sm: 4px;
      }

      @theme {
        --spacing-lg: 16px;
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).not.toBeNull();
    expect(result!.spacing).toEqual([
      { key: "sm", value: "4px" },
      { key: "lg", value: "16px" },
    ]);
  });

  it("only populates scales that have entries — empty scales remain empty", async () => {
    await writeCss("globals.css", `
      @theme {
        --spacing-sm: 4px;
        --font-size-body: 1rem;
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).not.toBeNull();
    expect(result!.spacing.length).toBe(1);
    expect(result!.fontSize.length).toBe(1);
    expect(result!.fontWeight).toEqual([]);
    expect(result!.lineHeight).toEqual([]);
    expect(result!.letterSpacing).toEqual([]);
    expect(result!.borderRadius).toEqual([]);
    expect(result!.borderWidth).toEqual([]);
    expect(result!.opacity).toEqual([]);
  });

  it("skips missing CSS files gracefully", async () => {
    await writeCss("exists.css", `
      @theme {
        --spacing-sm: 4px;
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["exists.css", "missing.css"]);
    expect(result).not.toBeNull();
    expect(result!.spacing).toEqual([{ key: "sm", value: "4px" }]);
  });

  it("returns null for empty CSS files list", async () => {
    const result = await resolveTailwindV4Theme(tmpDir, []);
    expect(result).toBeNull();
  });

  it("handles CSS with mixed @theme and :root blocks", async () => {
    await writeCss("globals.css", `
      :root {
        --color-primary: blue;
        --spacing-base: 8px;
      }

      @theme {
        --spacing-sm: 4px;
        --spacing-md: 8px;
      }

      .dark {
        --color-primary: lightblue;
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).not.toBeNull();
    // Only @theme variables are extracted, not :root ones
    expect(result!.spacing).toEqual([
      { key: "sm", value: "4px" },
      { key: "md", value: "8px" },
    ]);
  });

  it("parses --text-* variables as fontSize (v4 convention)", async () => {
    await writeCss("globals.css", `
      @theme {
        --text-sm: 0.875rem;
        --text-base: 1rem;
        --text-lg: 1.125rem;
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).not.toBeNull();
    expect(result!.fontSize).toEqual([
      { key: "sm", value: "0.875rem" },
      { key: "base", value: "1rem" },
      { key: "lg", value: "1.125rem" },
    ]);
  });

  it("filters out --text-*--line-height companion entries", async () => {
    await writeCss("globals.css", `
      @theme {
        --text-sm: 0.875rem;
        --text-sm--line-height: 1.25rem;
        --text-base: 1rem;
        --text-base--line-height: 1.5rem;
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).not.toBeNull();
    // Only the main text entries, not the --line-height companions
    expect(result!.fontSize).toEqual([
      { key: "sm", value: "0.875rem" },
      { key: "base", value: "1rem" },
    ]);
  });

  it("filters out --text-shadow-* entries", async () => {
    await writeCss("globals.css", `
      @theme {
        --text-sm: 0.875rem;
        --text-base: 1rem;
        --text-shadow-sm: 0 1px 2px rgba(0,0,0,0.1);
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).not.toBeNull();
    expect(result!.fontSize).toEqual([
      { key: "sm", value: "0.875rem" },
      { key: "base", value: "1rem" },
    ]);
  });

  it("generates spacing from --spacing base unit", async () => {
    await writeCss("globals.css", `
      @theme {
        --spacing: 0.25rem;
        --font-size-body: 1rem;
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).not.toBeNull();
    // Should generate spacing scale from the 0.25rem base
    expect(result!.spacing.length).toBeGreaterThan(10);
    // Check specific entries: "4" → 0.25 * 4 = 1rem
    const four = result!.spacing.find((e) => e.key === "4");
    expect(four).toBeDefined();
    expect(four!.value).toBe("1rem");
    // "px" → 1px
    const px = result!.spacing.find((e) => e.key === "px");
    expect(px).toBeDefined();
    expect(px!.value).toBe("1px");
    // "0" → 0rem
    const zero = result!.spacing.find((e) => e.key === "0");
    expect(zero).toBeDefined();
    expect(zero!.value).toBe("0rem");
  });

  it("parses shadow variables from @theme", async () => {
    await writeCss("globals.css", `
      @theme {
        --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
        --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
        --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).not.toBeNull();
    expect(result!.boxShadow).toEqual([
      { key: "sm", value: "0 1px 2px rgba(0,0,0,0.05)" },
      { key: "md", value: "0 4px 6px rgba(0,0,0,0.1)" },
      { key: "lg", value: "0 10px 15px rgba(0,0,0,0.1)" },
    ]);
  });

  it("prefers explicit spacing entries over base unit generation", async () => {
    await writeCss("globals.css", `
      @theme {
        --spacing: 0.25rem;
        --spacing-sm: 4px;
        --spacing-lg: 16px;
      }
    `);
    const result = await resolveTailwindV4Theme(tmpDir, ["globals.css"]);
    expect(result).not.toBeNull();
    // Explicit entries should be used, not generated ones
    expect(result!.spacing).toEqual([
      { key: "sm", value: "4px" },
      { key: "lg", value: "16px" },
    ]);
  });
});
