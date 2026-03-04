import { describe, it, expect } from "vitest";
import { extractScopedStyles, writeScopedStyleProperty } from "./scoped-style.js";

describe("extractScopedStyles", () => {
  it("extracts a single scoped style block", () => {
    const source = `---
const title = "Hello";
---
<h1>{title}</h1>
<style>
  .heading { color: red; }
</style>`;

    const blocks = extractScopedStyles(source);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].isGlobal).toBe(false);
    expect(blocks[0].css).toContain(".heading { color: red; }");
  });

  it("extracts multiple style blocks", () => {
    const source = `<div>content</div>
<style>
  .local { color: blue; }
</style>
<style is:global>
  body { margin: 0; }
</style>`;

    const blocks = extractScopedStyles(source);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].isGlobal).toBe(false);
    expect(blocks[0].css).toContain(".local");
    expect(blocks[1].isGlobal).toBe(true);
    expect(blocks[1].css).toContain("body");
  });

  it("detects Svelte global attribute", () => {
    const source = `<style global>
  .app { font-family: sans-serif; }
</style>`;

    const blocks = extractScopedStyles(source);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].isGlobal).toBe(true);
  });

  it("returns empty array when no style blocks", () => {
    const source = `<h1>Hello</h1>`;
    expect(extractScopedStyles(source)).toHaveLength(0);
  });

  it("tracks correct offsets for CSS content", () => {
    const source = `<div>hi</div>\n<style>\n.foo { color: red; }\n</style>`;
    const blocks = extractScopedStyles(source);
    expect(blocks).toHaveLength(1);
    // The CSS content should match what's between the style tags
    const extracted = source.slice(blocks[0].startOffset, blocks[0].endOffset);
    expect(extracted).toBe(blocks[0].css);
  });
});

describe("writeScopedStyleProperty", () => {
  const astroSource = `---
const title = "Hello";
---
<h1 class="heading">{title}</h1>
<style>
  .heading {
    color: red;
    font-size: 2rem;
  }
  .subtitle {
    color: gray;
  }
</style>`;

  it("updates an existing property in a scoped rule", () => {
    const result = writeScopedStyleProperty(astroSource, ".heading", "color", "blue");
    expect(result).not.toBeNull();
    expect(result).toContain("color: blue;");
    expect(result).not.toContain("color: red;");
    // Frontmatter and template should be preserved
    expect(result).toContain('const title = "Hello";');
    expect(result).toContain('<h1 class="heading">');
  });

  it("adds a new property to an existing rule", () => {
    const result = writeScopedStyleProperty(astroSource, ".heading", "margin-top", "1rem");
    expect(result).not.toBeNull();
    expect(result).toContain("margin-top: 1rem;");
    // Existing properties preserved
    expect(result).toContain("color: red;");
    expect(result).toContain("font-size: 2rem;");
  });

  it("returns null when selector not found", () => {
    const result = writeScopedStyleProperty(astroSource, ".nonexistent", "color", "blue");
    expect(result).toBeNull();
  });

  it("skips global style blocks", () => {
    const source = `<div class="app">content</div>
<style is:global>
  .app { color: red; }
</style>`;

    const result = writeScopedStyleProperty(source, ".app", "color", "blue");
    expect(result).toBeNull();
  });

  it("writes to scoped block when both global and scoped exist", () => {
    const source = `<div class="card">content</div>
<style is:global>
  body { margin: 0; }
</style>
<style>
  .card {
    padding: 1rem;
  }
</style>`;

    const result = writeScopedStyleProperty(source, ".card", "padding", "2rem");
    expect(result).not.toBeNull();
    expect(result).toContain("padding: 2rem;");
    // Global block untouched
    expect(result).toContain("body { margin: 0; }");
  });

  it("handles shorthand/longhand cleanup", () => {
    const source = `<div class="box">content</div>
<style>
  .box {
    padding-top: 8px;
    padding-right: 8px;
    padding-bottom: 8px;
    padding-left: 8px;
  }
</style>`;

    const result = writeScopedStyleProperty(source, ".box", "padding", "16px");
    expect(result).not.toBeNull();
    expect(result).toContain("padding: 16px;");
    // Longhands should be cleaned up
    expect(result).not.toContain("padding-top");
  });

  it("preserves content outside the style block", () => {
    const source = `---
import Component from "./Component.astro";
const items = [1, 2, 3];
---
<div class="wrapper">
  <Component />
  {items.map(i => <span>{i}</span>)}
</div>
<style>
  .wrapper {
    display: flex;
  }
</style>`;

    const result = writeScopedStyleProperty(source, ".wrapper", "gap", "1rem");
    expect(result).not.toBeNull();
    // Frontmatter preserved exactly
    expect(result).toContain('import Component from "./Component.astro";');
    expect(result).toContain("const items = [1, 2, 3];");
    // Template preserved exactly
    expect(result).toContain("<Component />");
    expect(result).toContain("{items.map(i => <span>{i}</span>)}");
  });
});
