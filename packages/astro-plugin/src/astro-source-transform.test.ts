import { describe, it, expect } from "vitest";
import { transformAstroSource, createAstroSourcePlugin } from "./astro-source-transform.js";

describe("transformAstroSource", () => {
  it("adds data-source to native HTML elements", async () => {
    const code = `<div class="hero"><p>Hello</p></div>`;
    const result = await transformAstroSource(code, "src/pages/index.astro");
    expect(result).toContain('data-source="src/pages/index.astro:1:1"');
    expect(result).toContain("<p ");
    expect(result).toContain("data-source=");
  });

  it("adds data-instance-source to component elements", async () => {
    const code = `<Card title="Hello" />`;
    const result = await transformAstroSource(code, "src/pages/index.astro");
    expect(result).toContain(
      'data-instance-source="src/pages/index.astro:1:2"'
    );
    expect(result).not.toContain("data-source=");
  });

  it("handles mix of elements and components", async () => {
    const code = `<section>\n  <Card title="Test" />\n  <p>Text</p>\n</section>`;
    const result = await transformAstroSource(code, "src/pages/index.astro");
    expect(result).not.toBeNull();
    // section and p get data-source
    expect(result).toContain("<section data-source=");
    expect(result).toContain("<p data-source=");
    // Card gets data-instance-source
    expect(result).toContain("<Card data-instance-source=");
  });

  it("skips style tags", async () => {
    const code = `<style>\n  .hero { color: red; }\n</style>\n<div>Content</div>`;
    const result = await transformAstroSource(code, "src/pages/index.astro");
    expect(result).not.toContain("<style data-source");
    expect(result).toContain("<div data-source=");
  });

  it("skips script tags", async () => {
    const code = `<script>\n  console.log("hi");\n</script>\n<div>Content</div>`;
    const result = await transformAstroSource(code, "src/pages/index.astro");
    expect(result).not.toContain("<script data-source");
    expect(result).toContain("<div data-source=");
  });

  it("skips slot elements", async () => {
    const code = `<div><slot /></div>`;
    const result = await transformAstroSource(code, "src/layouts/Layout.astro");
    expect(result).not.toContain("<slot data-source");
    expect(result).toContain("<div data-source=");
  });

  it("skips elements that already have data-source", async () => {
    const code = `<div data-source="manual:1:0">Content</div>`;
    const result = await transformAstroSource(code, "src/pages/index.astro");
    // Should not add a second data-source
    expect(result).toBeNull();
  });

  it("skips components that already have data-instance-source", async () => {
    const code = `<Card data-instance-source="manual:1:0" />`;
    const result = await transformAstroSource(code, "src/pages/index.astro");
    expect(result).toBeNull();
  });

  it("returns null for frontmatter-only files", async () => {
    const code = `---\nconst title = "Hello";\n---`;
    const result = await transformAstroSource(code, "src/pages/index.astro");
    expect(result).toBeNull();
  });

  it("handles self-closing elements", async () => {
    const code = `<img src="/photo.jpg" />\n<br />\n<hr />`;
    const result = await transformAstroSource(code, "src/pages/index.astro");
    expect(result).toContain("<img data-source=");
    expect(result).toContain("<br data-source=");
    expect(result).toContain("<hr data-source=");
  });

  it("preserves frontmatter before template", async () => {
    const code = `---\nconst name = "World";\n---\n<h1>Hello {name}</h1>`;
    const result = await transformAstroSource(code, "src/pages/index.astro");
    expect(result).toContain("---\nconst name");
    expect(result).toContain("<h1 data-source=");
  });

  it("preserves existing attributes on elements", async () => {
    const code = `<div class="hero" id="main">Content</div>`;
    const result = await transformAstroSource(code, "src/pages/index.astro");
    expect(result).toContain('class="hero"');
    expect(result).toContain('id="main"');
    expect(result).toContain("data-source=");
  });

  it("handles nested elements correctly", async () => {
    const code = `<div>\n  <span>Inner</span>\n</div>`;
    const result = await transformAstroSource(code, "src/pages/index.astro");
    expect(result).not.toBeNull();
    // Both div and span should have data-source
    const matches = result!.match(/data-source=/g);
    expect(matches).toHaveLength(2);
  });

  it("handles component with client directive", async () => {
    const code = `<Counter client:load />`;
    const result = await transformAstroSource(code, "src/pages/index.astro");
    expect(result).toContain("data-instance-source=");
  });

  it("uses relative path in attribute values", async () => {
    const code = `<div>Test</div>`;
    const result = await transformAstroSource(
      code,
      "src/components/Card.astro"
    );
    expect(result).toContain("src/components/Card.astro:");
  });
});

describe("createAstroSourcePlugin", () => {
  function getPlugin() {
    const plugin = createAstroSourcePlugin();
    // Simulate configResolved
    (plugin as any).configResolved({ root: "/project" });
    return plugin;
  }

  it("has enforce: pre and uses load hook", () => {
    const plugin = createAstroSourcePlugin();
    expect(plugin.enforce).toBe("pre");
    expect(plugin.load).toBeDefined();
    expect(plugin.transform).toBeUndefined();
  });

  it("skips non-.astro files", async () => {
    const plugin = getPlugin();
    const load = (plugin as any).load.bind(plugin);
    expect(await load("/project/src/App.tsx")).toBeUndefined();
    expect(await load("/project/src/style.css")).toBeUndefined();
  });

  it("skips node_modules", async () => {
    const plugin = getPlugin();
    const load = (plugin as any).load.bind(plugin);
    expect(await load("/project/node_modules/pkg/Component.astro")).toBeUndefined();
  });

  it("skips query-parameterized IDs (Astro virtual modules)", async () => {
    const plugin = getPlugin();
    const load = (plugin as any).load.bind(plugin);
    expect(await load("/project/src/Page.astro?astro&type=style&index=0")).toBeUndefined();
    expect(await load("/project/src/Page.astro?astro")).toBeUndefined();
  });

  it("has the correct plugin name", () => {
    const plugin = createAstroSourcePlugin();
    expect(plugin.name).toBe("designtools-astro-source");
  });
});
