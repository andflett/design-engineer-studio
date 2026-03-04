import { describe, it, expect } from "vitest";
import { transformSvelteSource, createSvelteSourcePlugin } from "./svelte-source-transform.js";

describe("transformSvelteSource", () => {
  it("adds data-source to native HTML elements", async () => {
    const code = `<div class="hero"><p>Hello</p></div>`;
    const result = await transformSvelteSource(code, "src/routes/+page.svelte");
    expect(result).toContain('data-source="src/routes/+page.svelte:1:');
    expect(result).toContain("<p ");
    expect(result).toContain("data-source=");
  });

  it("adds data-instance-source to component elements", async () => {
    const code = `<script>import Card from './Card.svelte';</script>\n<Card title="Hello" />`;
    const result = await transformSvelteSource(code, "src/routes/+page.svelte");
    expect(result).toContain("data-instance-source=");
    expect(result).toContain("src/routes/+page.svelte:2:");
  });

  it("handles mix of elements and components", async () => {
    const code = `<script>import Card from './Card.svelte';</script>\n<section>\n  <Card title="Test" />\n  <p>Text</p>\n</section>`;
    const result = await transformSvelteSource(code, "src/routes/+page.svelte");
    expect(result).not.toBeNull();
    expect(result).toContain("<section data-source=");
    expect(result).toContain("<p data-source=");
    expect(result).toContain("<Card data-instance-source=");
  });

  it("skips slot elements", async () => {
    const code = `<div><slot /></div>`;
    const result = await transformSvelteSource(code, "src/lib/Layout.svelte");
    expect(result).not.toContain("<slot data-source");
    expect(result).toContain("<div data-source=");
  });

  it("preserves script blocks", async () => {
    const code = `<script>\n  let count = 0;\n</script>\n<button>{count}</button>`;
    const result = await transformSvelteSource(code, "src/routes/+page.svelte");
    expect(result).toContain("let count = 0;");
    expect(result).toContain("<button data-source=");
  });

  it("preserves style blocks", async () => {
    const code = `<style>\n  .hero { color: red; }\n</style>\n<div class="hero">Content</div>`;
    const result = await transformSvelteSource(code, "src/routes/+page.svelte");
    expect(result).toContain(".hero { color: red; }");
    expect(result).toContain("<div data-source=");
  });

  it("skips elements that already have data-source", async () => {
    const code = `<div data-source="manual:1:0">Content</div>`;
    const result = await transformSvelteSource(code, "src/routes/+page.svelte");
    expect(result).toBeNull();
  });

  it("returns null for script-only files", async () => {
    const code = `<script>\n  export const title = "Hello";\n</script>`;
    const result = await transformSvelteSource(code, "src/routes/+page.svelte");
    expect(result).toBeNull();
  });

  it("handles self-closing elements", async () => {
    const code = `<img src="/photo.jpg" />\n<br />\n<hr />`;
    const result = await transformSvelteSource(code, "src/routes/+page.svelte");
    expect(result).toContain("<img data-source=");
    expect(result).toContain("<br data-source=");
    expect(result).toContain("<hr data-source=");
  });

  it("handles {#if} blocks", async () => {
    const code = `{#if true}\n  <div>Visible</div>\n{/if}`;
    const result = await transformSvelteSource(code, "src/routes/+page.svelte");
    expect(result).toContain("<div data-source=");
  });

  it("handles {#each} blocks", async () => {
    const code = `{#each [1,2] as item}\n  <li>{item}</li>\n{/each}`;
    const result = await transformSvelteSource(code, "src/routes/+page.svelte");
    expect(result).toContain("<li data-source=");
  });

  it("preserves existing attributes on elements", async () => {
    const code = `<div class="hero" id="main">Content</div>`;
    const result = await transformSvelteSource(code, "src/routes/+page.svelte");
    expect(result).toContain('class="hero"');
    expect(result).toContain('id="main"');
    expect(result).toContain("data-source=");
  });

  it("handles nested elements correctly", async () => {
    const code = `<div>\n  <span>Inner</span>\n</div>`;
    const result = await transformSvelteSource(code, "src/routes/+page.svelte");
    expect(result).not.toBeNull();
    const matches = result!.match(/data-source=/g);
    expect(matches).toHaveLength(2);
  });

  it("uses relative path in attribute values", async () => {
    const code = `<div>Test</div>`;
    const result = await transformSvelteSource(code, "src/lib/components/Card.svelte");
    expect(result).toContain("src/lib/components/Card.svelte:");
  });

  it("skips svelte:head elements", async () => {
    const code = `<svelte:head><title>Page</title></svelte:head>\n<div>Content</div>`;
    const result = await transformSvelteSource(code, "src/routes/+page.svelte");
    expect(result).not.toContain("svelte:head data-source");
    expect(result).toContain("<div data-source=");
  });
});

describe("createSvelteSourcePlugin", () => {
  function getPlugin() {
    const plugin = createSvelteSourcePlugin();
    (plugin as any).configResolved({ root: "/project" });
    return plugin;
  }

  it("has enforce: pre and uses load hook", () => {
    const plugin = createSvelteSourcePlugin();
    expect(plugin.enforce).toBe("pre");
    expect(plugin.load).toBeDefined();
    expect(plugin.transform).toBeUndefined();
  });

  it("skips non-.svelte files", async () => {
    const plugin = getPlugin();
    const load = (plugin as any).load.bind(plugin);
    expect(await load("/project/src/App.tsx")).toBeUndefined();
    expect(await load("/project/src/style.css")).toBeUndefined();
  });

  it("skips node_modules", async () => {
    const plugin = getPlugin();
    const load = (plugin as any).load.bind(plugin);
    expect(await load("/project/node_modules/pkg/Component.svelte")).toBeUndefined();
  });

  it("skips query-parameterized IDs", async () => {
    const plugin = getPlugin();
    const load = (plugin as any).load.bind(plugin);
    expect(await load("/project/src/Page.svelte?type=style")).toBeUndefined();
  });

  it("has the correct plugin name", () => {
    const plugin = createSvelteSourcePlugin();
    expect(plugin.name).toBe("designtools-svelte-source");
  });
});
