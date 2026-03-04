/**
 * Vite plugin that annotates .svelte template elements with data-source attributes.
 * Uses a `load` hook (not `transform`) so it reads raw .svelte source from disk
 * BEFORE Svelte's own Vite plugin compiles the file into JavaScript.
 *
 * Uses svelte/compiler's parse() with modern AST to find element positions,
 * then splices attributes without reformatting (preserves exact user formatting).
 */

import type { Plugin } from "vite";
import fs from "fs/promises";
import path from "path";

/** Element types that should not receive data-source annotations. */
const SKIP_TYPES = new Set([
  "SlotElement",
  "SvelteHead",
  "SvelteWindow",
  "SvelteDocument",
  "SvelteBody",
  "SvelteBoundary",
  "SvelteFragment",
]);

/** Element types that represent components (get data-instance-source). */
const COMPONENT_TYPES = new Set(["Component", "SvelteComponent", "SvelteSelf"]);

/** Element types that represent regular HTML elements (get data-source). */
const ELEMENT_TYPES = new Set(["RegularElement", "SvelteElement"]);

/**
 * Convert a character offset to 1-based line and column.
 */
function offsetToLineCol(
  source: string,
  offset: number
): { line: number; col: number } {
  let line = 1;
  let lastNewline = -1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      lastNewline = i;
    }
  }
  return { line, col: offset - lastNewline };
}

/** Check if a node already has a specific attribute. */
function hasAttribute(node: any, name: string): boolean {
  return (
    node.attributes?.some(
      (a: any) => a.type === "Attribute" && a.name === name
    ) ?? false
  );
}

/**
 * Find the offset right after the tag name where we should insert the attribute.
 * In Svelte's AST, node.start is the offset of the `<` character.
 */
function findInsertOffset(
  source: string,
  start: number,
  name: string
): number {
  if (source[start] === "<") {
    return start + 1 + name.length;
  }
  return start + name.length;
}

/**
 * Recursively walk nodes in the Svelte modern AST.
 * Handles elements, blocks (if/each/await/key/snippet), and fragments.
 */
function walkNodes(nodes: any[], callback: (node: any) => void): void {
  for (const node of nodes) {
    callback(node);

    // ElementLike nodes have children in .fragment.nodes
    if (node.fragment?.nodes) {
      walkNodes(node.fragment.nodes, callback);
    }

    // Block node traversal
    if (node.consequent?.nodes) walkNodes(node.consequent.nodes, callback); // IfBlock
    if (node.alternate?.nodes) walkNodes(node.alternate.nodes, callback); // IfBlock else
    if (node.body?.nodes) walkNodes(node.body.nodes, callback); // EachBlock, SnippetBlock
    if (node.fallback?.nodes) walkNodes(node.fallback.nodes, callback); // EachBlock fallback
    if (node.pending?.nodes) walkNodes(node.pending.nodes, callback); // AwaitBlock
    if (node.then?.nodes) walkNodes(node.then.nodes, callback); // AwaitBlock
    if (node.catch?.nodes) walkNodes(node.catch.nodes, callback); // AwaitBlock
  }
}

/**
 * Core transform: parses .svelte source and injects data-source / data-instance-source
 * attributes via string splicing at AST-reported offsets.
 * Returns the modified source, or null if no changes were made.
 */
export async function transformSvelteSource(
  code: string,
  relativePath: string
): Promise<string | null> {
  const { parse } = await import("svelte/compiler");
  const ast = parse(code, { modern: true });

  const insertions: { offset: number; attr: string }[] = [];

  walkNodes(ast.fragment.nodes, (node: any) => {
    if (ELEMENT_TYPES.has(node.type)) {
      if (SKIP_TYPES.has(node.type)) return;
      if (hasAttribute(node, "data-source")) return;

      const { line, col } = offsetToLineCol(code, node.start);
      const value = `${relativePath}:${line}:${col}`;
      const insertOffset = findInsertOffset(code, node.start, node.name);
      insertions.push({
        offset: insertOffset,
        attr: ` data-source="${value}"`,
      });
    } else if (COMPONENT_TYPES.has(node.type)) {
      if (hasAttribute(node, "data-instance-source")) return;

      const { line, col } = offsetToLineCol(code, node.start);
      const value = `${relativePath}:${line}:${col}`;
      const insertOffset = findInsertOffset(code, node.start, node.name);
      insertions.push({
        offset: insertOffset,
        attr: ` data-instance-source="${value}"`,
      });
    }
  });

  if (insertions.length === 0) return null;

  // Sort descending by offset so insertions don't shift subsequent offsets
  insertions.sort((a, b) => b.offset - a.offset);

  let modified = code;
  for (const { offset, attr } of insertions) {
    modified = modified.slice(0, offset) + attr + modified.slice(offset);
  }

  return modified;
}

export function createSvelteSourcePlugin(): Plugin {
  let root: string;

  return {
    name: "designtools-svelte-source",
    enforce: "pre",

    configResolved(config) {
      root = config.root;
    },

    // Use load() to read raw .svelte source from disk BEFORE
    // @sveltejs/vite-plugin-svelte compiles it into JavaScript.
    async load(id: string) {
      if (!id.endsWith(".svelte")) return;
      if (id.includes("?")) return; // skip virtual modules
      if (id.includes("node_modules")) return;

      const code = await fs.readFile(id, "utf-8");
      const relativePath = path.relative(root, id);
      const modified = await transformSvelteSource(code, relativePath);

      if (modified === null) return;
      return { code: modified };
    },
  };
}
