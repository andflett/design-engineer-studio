/**
 * GET /api/classify-element?file=<path>&line=<n>&col=<n>
 *
 * Analyzes the JSX element at source coordinates and returns editability
 * classification: iterator context, prop editability, content type, data origin.
 */

import { Router } from "express";
import fs from "fs/promises";
import { statSync } from "fs";
import { namedTypes as n } from "ast-types";
import recast from "recast";
import { safePath } from "../lib/safe-path.js";
import { getParser, parseSource } from "../lib/ast-helpers.js";
import { findElementAtSource } from "../lib/find-element.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Where the iterated data originates — detectable at static analysis time. */
export type DataOrigin = "local" | "external";

export type ElementClassification = {
  /** True if element is rendered in a .map()/.flatMap()/.filter() loop. */
  inLoop: boolean;
  /** True if the element's text/child content contains non-literal expressions. */
  hasDynamicContent: boolean;
  /**
   * Where loop data comes from (only present when inLoop is true).
   * "local"    — iterated array is a literal defined in this file.
   * "external" — data comes from a hook, props, import, or state.
   */
  dataOrigin?: DataOrigin;
  /** Truncated source expression of the iterator call, e.g. "items.map(…)" */
  iteratorExpression?: string;
  /** First dynamic child expression snippet, e.g. "item.name" */
  contentExpression?: string;
  // Legacy instance shape retained for backwards-compat
  instance: {
    isAuthored: boolean;
    dataSource?: {
      type: "map" | "flatMap" | "filter" | "each" | "for";
      expression: string;
    };
    props: Array<{
      name: string;
      isEditable: boolean;
      expressionSource?: string;
    }>;
    contentType: "static" | "dynamic" | "mixed" | "empty";
    contentExpression?: string;
  };
};

// ---------------------------------------------------------------------------
// In-memory cache: key = "file:line:col", value = { mtime, result }
// ---------------------------------------------------------------------------

interface CacheEntry {
  mtime: number;
  result: ElementClassification;
}

const cache = new Map<string, CacheEntry>();

// ---------------------------------------------------------------------------
// Prop names to skip during classification
// ---------------------------------------------------------------------------

const SKIP_PROPS = new Set(["data-source", "data-instance-source", "data-slot", "className", "style"]);

// ---------------------------------------------------------------------------
// Iterator method names we care about
// ---------------------------------------------------------------------------

const ITERATOR_METHODS = new Set(["map", "flatMap", "filter"]);

type IteratorType = "map" | "flatMap" | "filter" | "each" | "for";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate a string to maxLen, appending "…" if needed. */
function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + "…";
}

/**
 * Walk ancestor paths upward from `startPath`, looking for a .map() / .flatMap() / .filter()
 * call where the JSX element lives inside the callback. Returns the iterator info or null.
 */
function detectIteratorAncestor(
  startPath: any
): { type: IteratorType; expression: string; objectNode: any } | null {
  let current = startPath;

  while (current && current.parent) {
    current = current.parent;
    const node = current.node;

    if (
      n.CallExpression.check(node) &&
      n.MemberExpression.check(node.callee) &&
      n.Identifier.check(node.callee.property)
    ) {
      const methodName = node.callee.property.name;
      if (ITERATOR_METHODS.has(methodName)) {
        const printed = truncate(recast.print(node).code, 60);
        // objectNode is the thing being iterated: `items` in `items.map(...)`
        return { type: methodName as IteratorType, expression: printed, objectNode: node.callee.object };
      }
    }
  }

  return null;
}

/**
 * Given the object node before .map() (e.g. `items`, `data.results`),
 * walk the AST scope upward to find its declaration and determine data origin.
 *
 * "local"    — the identifier resolves to a VariableDeclarator whose init is
 *              an ArrayExpression containing only literal/object-literal elements.
 * "external" — everything else: hook calls, useState, props, imports, expressions.
 */
function detectDataOrigin(objectNode: any, elementPath: any): DataOrigin {
  // Only handle simple identifiers for now (e.g. `items`, not `data.results`)
  if (!n.Identifier.check(objectNode)) return "external";

  const identName: string = objectNode.name;

  // Walk up the AST to find a VariableDeclarator for this identifier
  let current = elementPath;
  while (current && current.parent) {
    current = current.parent;
    const node = current.node;

    // Look for variable declarations in the current scope's body
    const body: any[] =
      (n.BlockStatement.check(node) && node.body) ||
      (n.Program.check(node) && node.body) ||
      [];

    for (const stmt of body) {
      if (!n.VariableDeclaration.check(stmt)) continue;
      for (const decl of stmt.declarations) {
        if (!n.VariableDeclarator.check(decl)) continue;
        if (!n.Identifier.check(decl.id) || decl.id.name !== identName) continue;

        // Found the declaration. Check if the init is a local array literal.
        if (!decl.init) return "external";
        if (isLocalArrayLiteral(decl.init)) return "local";
        return "external";
      }
    }
  }

  // Not found in local scope — could be a prop (function parameter) or import
  return "external";
}

/**
 * Returns true if the node is an ArrayExpression where every element is a
 * literal value or plain object expression (no function calls, identifiers, etc.).
 * This is the "hardcoded data array" case.
 */
function isLocalArrayLiteral(node: any): boolean {
  if (!n.ArrayExpression.check(node)) return false;
  for (const el of node.elements) {
    if (!el) continue; // sparse array hole
    if (
      n.StringLiteral.check(el) ||
      n.NumericLiteral.check(el) ||
      n.BooleanLiteral.check(el) ||
      n.Literal.check(el)
    ) continue;
    if (n.ObjectExpression.check(el)) {
      // Object with literal values only
      const allLiteral = el.properties.every((prop: any) => {
        if (!n.Property.check(prop) && !n.ObjectProperty.check(prop)) return false;
        const val = prop.value;
        return (
          n.StringLiteral.check(val) ||
          n.NumericLiteral.check(val) ||
          n.BooleanLiteral.check(val) ||
          n.Literal.check(val) ||
          n.TemplateLiteral.check(val)
        );
      });
      if (allLiteral) continue;
    }
    return false;
  }
  return true;
}

/**
 * Classify props on a JSXOpeningElement. Skips internal/framework attrs.
 */
function classifyProps(
  openingElement: any
): Array<{ name: string; isEditable: boolean; expressionSource?: string }> {
  const result: Array<{ name: string; isEditable: boolean; expressionSource?: string }> = [];

  for (const attr of openingElement.attributes || []) {
    if (!n.JSXAttribute.check(attr)) continue;
    if (!n.JSXIdentifier.check(attr.name)) continue;

    const name: string = attr.name.name;
    if (SKIP_PROPS.has(name)) continue;

    if (attr.value === null || attr.value === undefined) {
      result.push({ name, isEditable: true });
      continue;
    }

    if (n.StringLiteral.check(attr.value) || n.Literal.check(attr.value)) {
      result.push({ name, isEditable: true });
      continue;
    }

    if (n.JSXExpressionContainer.check(attr.value)) {
      const expr = attr.value.expression;
      if (
        n.NumericLiteral.check(expr) ||
        n.BooleanLiteral.check(expr) ||
        n.StringLiteral.check(expr) ||
        n.Literal.check(expr)
      ) {
        result.push({ name, isEditable: true });
        continue;
      }
      const snippet = truncate(recast.print(expr).code, 40);
      result.push({ name, isEditable: false, expressionSource: snippet });
      continue;
    }

    const snippet = truncate(recast.print(attr.value).code, 40);
    result.push({ name, isEditable: false, expressionSource: snippet });
  }

  return result;
}

/**
 * Classify the content (children) of the JSX element.
 */
function classifyContent(openingElementPath: any): {
  contentType: "static" | "dynamic" | "mixed" | "empty";
  contentExpression?: string;
} {
  const jsxElement = openingElementPath.parent?.node;
  if (!jsxElement || !n.JSXElement.check(jsxElement)) {
    return { contentType: "empty" };
  }

  const children: any[] = jsxElement.children || [];
  const meaningfulChildren = children.filter((child) => {
    if (n.JSXText.check(child)) return child.value.trim().length > 0;
    return true;
  });

  if (meaningfulChildren.length === 0) return { contentType: "empty" };

  let hasStatic = false;
  let hasDynamic = false;
  let firstDynamicSnippet: string | undefined;

  for (const child of meaningfulChildren) {
    if (n.JSXText.check(child)) {
      hasStatic = true;
    } else if (n.JSXExpressionContainer.check(child)) {
      const expr = child.expression;
      if (
        n.StringLiteral.check(expr) ||
        n.NumericLiteral.check(expr) ||
        n.BooleanLiteral.check(expr) ||
        n.Literal.check(expr)
      ) {
        hasStatic = true;
      } else {
        hasDynamic = true;
        if (!firstDynamicSnippet) {
          firstDynamicSnippet = truncate(recast.print(expr).code, 40);
        }
      }
    } else {
      hasStatic = true;
    }
  }

  if (hasDynamic && hasStatic) return { contentType: "mixed", contentExpression: firstDynamicSnippet };
  if (hasDynamic) return { contentType: "dynamic", contentExpression: firstDynamicSnippet };
  return { contentType: "static" };
}

// ---------------------------------------------------------------------------
// Stub for non-JSX files
// ---------------------------------------------------------------------------

const STUB_RESULT: ElementClassification = {
  inLoop: false,
  hasDynamicContent: false,
  instance: {
    isAuthored: true,
    props: [],
    contentType: "empty",
  },
};

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createClassifyElementRouter(projectRoot: string): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    const fileParam = req.query.file as string | undefined;
    const lineParam = req.query.line as string | undefined;
    const colParam = req.query.col as string | undefined;

    if (!fileParam || !lineParam || !colParam) {
      res.status(400).json({ error: "Missing required query params: file, line, col" });
      return;
    }

    const line = parseInt(lineParam, 10);
    const col = parseInt(colParam, 10);
    if (isNaN(line) || isNaN(col)) {
      res.status(400).json({ error: "line and col must be integers" });
      return;
    }

    let absPath: string;
    try {
      absPath = safePath(projectRoot, fileParam);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
      return;
    }

    if (!/\.[jt]sx$/.test(absPath)) {
      res.json(STUB_RESULT);
      return;
    }

    const cacheKey = `${absPath}:${line}:${col}`;
    let mtime = 0;
    try {
      mtime = statSync(absPath).mtimeMs;
    } catch {
      // file may not exist
    }

    const cached = cache.get(cacheKey);
    if (cached && cached.mtime === mtime) {
      res.json(cached.result);
      return;
    }

    let source: string;
    try {
      source = await fs.readFile(absPath, "utf-8");
    } catch (err: any) {
      res.status(404).json({ error: `Cannot read file: ${err.message}` });
      return;
    }

    let ast: any;
    try {
      const parser = await getParser();
      ast = parseSource(source, parser);
    } catch (err: any) {
      res.status(422).json({ error: `Parse error: ${err.message}` });
      return;
    }

    const elementPath = findElementAtSource(ast, line, col);
    if (!elementPath) {
      res.status(404).json({ error: `No JSX element found at ${fileParam}:${line}:${col}` });
      return;
    }

    // Iterator detection
    const iteratorInfo = detectIteratorAncestor(elementPath);
    const inLoop = iteratorInfo !== null;
    const dataOrigin: DataOrigin | undefined = inLoop
      ? detectDataOrigin(iteratorInfo!.objectNode, elementPath)
      : undefined;

    // Prop classification
    const props = classifyProps(elementPath.node);

    // Content classification
    const { contentType, contentExpression } = classifyContent(elementPath);
    const hasDynamicContent = contentType === "dynamic" || contentType === "mixed";

    const result: ElementClassification = {
      inLoop,
      hasDynamicContent,
      ...(dataOrigin !== undefined ? { dataOrigin } : {}),
      ...(iteratorInfo ? { iteratorExpression: iteratorInfo.expression } : {}),
      ...(contentExpression ? { contentExpression } : {}),
      instance: {
        isAuthored: !inLoop,
        ...(iteratorInfo ? { dataSource: { type: iteratorInfo.type, expression: iteratorInfo.expression } } : {}),
        props,
        contentType,
        ...(contentExpression ? { contentExpression } : {}),
      },
    };

    cache.set(cacheKey, { mtime, result });
    res.json(result);
  });

  return router;
}
