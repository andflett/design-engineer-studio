import { Router } from "express";
import fs from "fs/promises";
import crypto from "crypto";
import { safePath } from "@designtools/core/server";
import * as recast from "recast";
import { visit, namedTypes as n } from "ast-types";

const b = recast.types.builders;

// Use babel-ts parser for JSX + TypeScript support
let babelTsParser: any;
async function getParser() {
  if (!babelTsParser) {
    babelTsParser = await import("recast/parsers/babel-ts.js");
  }
  return babelTsParser;
}

function parseSource(source: string, parser: any) {
  return recast.parse(source, { parser });
}

function printSource(ast: any): string {
  return recast.print(ast).code;
}

export function createElementRouter(projectRoot: string) {
  const router = Router();

  router.post("/", async (req, res) => {
    try {
      const body = req.body as ElementWriteRequest;
      const fullPath = safePath(projectRoot, body.filePath);
      let source = await fs.readFile(fullPath, "utf-8");
      const parser = await getParser();

      if (body.type === "class") {
        const result = replaceClassInElement(source, parser, {
          eid: body.eid,
          oldClass: body.oldClass,
          newClass: body.newClass,
          tag: body.tag,
          textHint: body.textHint,
          lineHint: body.lineHint,
        });
        source = result.source;
        await fs.writeFile(fullPath, source, "utf-8");
        res.json({ ok: true, eid: result.eid });
      } else if (body.type === "prop") {
        source = replacePropInElement(
          source,
          parser,
          body.componentName,
          body.propName,
          body.propValue,
          body.lineHint,
          body.textHint
        );
        await fs.writeFile(fullPath, source, "utf-8");
        res.json({ ok: true });
      } else if (body.type === "addClass") {
        const result = addClassToElement(source, parser, {
          eid: body.eid,
          newClass: body.newClass,
          tag: body.tag,
          textHint: body.textHint,
          lineHint: body.lineHint,
        });
        source = result.source;
        await fs.writeFile(fullPath, source, "utf-8");
        res.json({ ok: true, eid: result.eid });
      } else if (body.type === "instanceOverride") {
        const result = overrideClassOnInstance(source, parser, {
          eid: body.eid,
          componentName: body.componentName,
          oldClass: body.oldClass,
          newClass: body.newClass,
          textHint: body.textHint,
          lineHint: body.lineHint,
        });
        source = result.source;
        await fs.writeFile(fullPath, source, "utf-8");
        res.json({ ok: true, eid: result.eid });
      } else if (body.type === "markElement") {
        const result = markElementInSource(source, parser, {
          componentName: body.componentName,
          tag: body.tag,
          textHint: body.textHint,
          lineHint: body.lineHint,
        });
        if (result.modified) {
          await fs.writeFile(fullPath, result.source, "utf-8");
        }
        res.json({ ok: true, eid: result.eid });
      } else if (body.type === "removeMarker") {
        source = removeMarker(source, body.eid);
        await fs.writeFile(fullPath, source, "utf-8");
        res.json({ ok: true });
      }
    } catch (err: any) {
      console.error("Element write error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

/** Remove all data-studio-eid attributes from source files at startup. */
export async function cleanupStaleMarkers(projectRoot: string) {
  const ignore = new Set(["node_modules", ".next", "dist", ".git"]);
  const exts = new Set([".tsx", ".jsx", ".html"]);

  async function walk(dir: string) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignore.has(entry.name)) continue;
      const full = dir + "/" + entry.name;
      if (entry.isDirectory()) {
        await walk(full);
      } else if (exts.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
        const content = await fs.readFile(full, "utf-8");
        if (content.includes("data-studio-eid=")) {
          const cleaned = content.replace(/ data-studio-eid="[^"]*"/g, "");
          await fs.writeFile(full, cleaned, "utf-8");
        }
      }
    }
  }

  await walk(projectRoot);
}

type ElementWriteRequest =
  | {
      type: "class";
      filePath: string;
      eid?: string;
      oldClass: string;
      newClass: string;
      tag?: string;
      textHint?: string;
      lineHint?: number;
    }
  | {
      type: "prop";
      filePath: string;
      componentName: string;
      propName: string;
      propValue: string;
      lineHint?: number;
      textHint?: string;
    }
  | {
      type: "addClass";
      filePath: string;
      eid?: string;
      newClass: string;
      tag?: string;
      textHint?: string;
      lineHint?: number;
    }
  | {
      type: "instanceOverride";
      filePath: string;
      eid?: string;
      componentName: string;
      oldClass: string;
      newClass: string;
      textHint?: string;
      lineHint?: number;
    }
  | {
      type: "removeMarker";
      filePath: string;
      eid: string;
    }
  | {
      type: "markElement";
      filePath: string;
      componentName?: string;
      tag?: string;
      textHint?: string;
      lineHint?: number;
    };

// --- Marker helpers ---

function generateEid(): string {
  return "s" + crypto.randomBytes(4).toString("hex");
}

function removeMarker(source: string, eid: string): string {
  return source.replace(
    new RegExp(` data-studio-eid="${eid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "g"),
    ""
  );
}

// --- AST helpers ---

/** Get the tag name from a JSXOpeningElement (handles member expressions like Foo.Bar) */
function getTagName(node: any): string {
  if (n.JSXIdentifier.check(node.name)) {
    return node.name.name;
  }
  if (n.JSXMemberExpression.check(node.name)) {
    return getTagName({ name: node.name.object }) + "." + node.name.property.name;
  }
  return "";
}

/** Find a JSXAttribute by name on an opening element node */
function findAttr(openingElement: any, attrName: string): any | null {
  for (const attr of openingElement.attributes) {
    if (
      n.JSXAttribute.check(attr) &&
      n.JSXIdentifier.check(attr.name) &&
      attr.name.name === attrName
    ) {
      return attr;
    }
  }
  return null;
}


/**
 * Find a JSXOpeningElement at or near a given line number.
 * Returns the NodePath to the JSXOpeningElement, or null.
 */
function findElementAtLine(ast: any, lineHint: number): any | null {
  let best: any = null;
  let bestDist = Infinity;

  visit(ast, {
    visitJSXOpeningElement(path) {
      const loc = path.node.loc;
      if (loc) {
        const dist = Math.abs(loc.start.line - lineHint);
        if (dist < bestDist) {
          bestDist = dist;
          best = path;
        }
      }
      this.traverse(path);
    },
  });

  return bestDist <= 3 ? best : null;
}

/**
 * Find a JSXOpeningElement by its data-studio-eid attribute value.
 * Returns the NodePath, or null.
 */
function findElementByEid(ast: any, eid: string): any | null {
  let found: any = null;

  visit(ast, {
    visitJSXOpeningElement(path) {
      const attr = findAttr(path.node, "data-studio-eid");
      if (attr) {
        const val = n.StringLiteral.check(attr.value) || n.Literal.check(attr.value)
          ? attr.value.value
          : null;
        if (val === eid) {
          found = path;
          return false; // stop traversal
        }
      }
      this.traverse(path);
    },
  });

  return found;
}

/**
 * Fallback: find the best-matching JSXOpeningElement by scoring tag, className, text content.
 * Used when lineHint and eid are both unavailable.
 */
function findElementByScoring(
  ast: any,
  opts: {
    tag?: string;
    textHint?: string;
    componentName?: string;
  }
): any | null {
  // Precompute PascalCase component name
  let pascalComponent: string | null = null;
  if (opts.componentName) {
    pascalComponent = opts.componentName.includes("-")
      ? opts.componentName.replace(/(^|-)([a-z])/g, (_m: string, _sep: string, c: string) => c.toUpperCase())
      : opts.componentName;
  }

  let bestPath: any = null;
  let bestScore = -Infinity;

  visit(ast, {
    visitJSXOpeningElement(path) {
      let score = 0;
      const tagName = getTagName(path.node);

      // Tag/component name match
      if (pascalComponent && tagName === pascalComponent) {
        score += 10;
      } else if (opts.tag && tagName.toLowerCase() === opts.tag.toLowerCase()) {
        score += 3;
      }

      // Text content match — check JSXText children of parent JSXElement
      if (opts.textHint && opts.textHint.length >= 2) {
        const parent = path.parent;
        if (n.JSXElement.check(parent.node)) {
          for (const child of parent.node.children) {
            if (n.JSXText.check(child) && child.value.includes(opts.textHint)) {
              score += 15;
              break;
            }
          }
        }
      }

      if (score > 0 && score > bestScore) {
        bestScore = score;
        bestPath = path;
      }

      this.traverse(path);
    },
  });

  return bestPath;
}

/**
 * Find the target element using the best available strategy:
 * 1. eid marker (most reliable for subsequent writes)
 * 2. lineHint from data-source plugin (most reliable for first write)
 * 3. Scoring fallback (when plugin is not installed)
 */
function findElement(
  ast: any,
  opts: {
    eid?: string;
    lineHint?: number;
    tag?: string;
    textHint?: string;
    componentName?: string;
  }
): any | null {
  // Strategy 1: Existing eid marker
  if (opts.eid) {
    const found = findElementByEid(ast, opts.eid);
    if (found) return found;
  }

  // Strategy 2: lineHint from data-source
  if (opts.lineHint !== undefined) {
    const found = findElementAtLine(ast, opts.lineHint);
    if (found) return found;
  }

  // Strategy 3: Scoring fallback
  return findElementByScoring(ast, opts);
}

/** Add a data-studio-eid attribute to an opening element */
function addEidAttribute(openingElement: any, eid: string): void {
  openingElement.attributes.push(
    b.jsxAttribute(
      b.jsxIdentifier("data-studio-eid"),
      b.stringLiteral(eid)
    )
  );
}

/**
 * Replace a class in a className attribute value.
 * Handles both StringLiteral and JSXExpressionContainer.
 */
function replaceClassInAttr(
  openingElement: any,
  oldClass: string,
  newClass: string
): boolean {
  const attr = findAttr(openingElement, "className");
  if (!attr) return false;

  // Case 1: className="string literal"
  if (n.StringLiteral.check(attr.value) || n.Literal.check(attr.value)) {
    const val = attr.value.value as string;
    const regex = classBoundaryRegex(oldClass, "g");
    if (regex.test(val)) {
      attr.value = b.stringLiteral(val.replace(classBoundaryRegex(oldClass, "g"), newClass));
      return true;
    }
    return false;
  }

  // Case 2: className={expression} — find string literals inside the expression
  if (n.JSXExpressionContainer.check(attr.value)) {
    return replaceClassInExpression(attr.value.expression, oldClass, newClass);
  }

  return false;
}

/**
 * Recursively search an expression tree for string literals containing the old class.
 * Handles cn("base", "override"), template literals, ternaries, etc.
 */
function replaceClassInExpression(expr: any, oldClass: string, newClass: string): boolean {
  // String literal: "text-2xl font-bold"
  if (n.StringLiteral.check(expr) || n.Literal.check(expr)) {
    if (typeof expr.value === "string") {
      const regex = classBoundaryRegex(oldClass);
      if (regex.test(expr.value)) {
        expr.value = expr.value.replace(classBoundaryRegex(oldClass, "g"), newClass);
        return true;
      }
    }
    return false;
  }

  // Template literal: `text-2xl ${foo}`
  if (n.TemplateLiteral.check(expr)) {
    for (const quasi of expr.quasis) {
      const regex = classBoundaryRegex(oldClass);
      if (regex.test(quasi.value.raw)) {
        quasi.value = {
          raw: quasi.value.raw.replace(classBoundaryRegex(oldClass, "g"), newClass),
          cooked: (quasi.value.cooked || quasi.value.raw).replace(classBoundaryRegex(oldClass, "g"), newClass),
        };
        return true;
      }
    }
    return false;
  }

  // Function call: cn("base", "override"), clsx(...)
  if (n.CallExpression.check(expr)) {
    for (const arg of expr.arguments) {
      if (replaceClassInExpression(arg, oldClass, newClass)) return true;
    }
    return false;
  }

  // Conditional: condition ? "a" : "b"
  if (n.ConditionalExpression.check(expr)) {
    if (replaceClassInExpression(expr.consequent, oldClass, newClass)) return true;
    if (replaceClassInExpression(expr.alternate, oldClass, newClass)) return true;
    return false;
  }

  // Logical: foo && "class" or foo || "class"
  if (n.LogicalExpression.check(expr)) {
    if (replaceClassInExpression(expr.left, oldClass, newClass)) return true;
    if (replaceClassInExpression(expr.right, oldClass, newClass)) return true;
    return false;
  }

  // Array: ["a", "b"]
  if (n.ArrayExpression.check(expr)) {
    for (const el of expr.elements) {
      if (el && replaceClassInExpression(el, oldClass, newClass)) return true;
    }
    return false;
  }

  return false;
}

/**
 * Append a class to a className attribute.
 * Handles StringLiteral and tries to append to expressions.
 */
function appendClassToAttr(openingElement: any, newClass: string): boolean {
  const attr = findAttr(openingElement, "className");
  if (!attr) return false;

  // Case 1: className="string literal"
  if (n.StringLiteral.check(attr.value) || n.Literal.check(attr.value)) {
    const val = attr.value.value as string;
    attr.value = b.stringLiteral(val + " " + newClass);
    return true;
  }

  // Case 2: className={expression} — try to append to the last string literal argument
  if (n.JSXExpressionContainer.check(attr.value)) {
    return appendClassToExpression(attr.value.expression, newClass);
  }

  return false;
}

/**
 * Append a class to string literals within an expression.
 * For cn("base classes", variant), appends to the first string literal.
 */
function appendClassToExpression(expr: any, newClass: string): boolean {
  if (n.StringLiteral.check(expr) || n.Literal.check(expr)) {
    if (typeof expr.value === "string") {
      expr.value = expr.value + " " + newClass;
      return true;
    }
    return false;
  }

  if (n.TemplateLiteral.check(expr)) {
    // Append to the last quasi
    const last = expr.quasis[expr.quasis.length - 1];
    if (last) {
      last.value = {
        raw: last.value.raw + " " + newClass,
        cooked: (last.value.cooked || last.value.raw) + " " + newClass,
      };
      return true;
    }
    return false;
  }

  // Function call: cn(...) — append to the first string argument
  if (n.CallExpression.check(expr)) {
    for (const arg of expr.arguments) {
      if ((n.StringLiteral.check(arg) || n.Literal.check(arg)) && typeof arg.value === "string") {
        arg.value = arg.value + " " + newClass;
        return true;
      }
    }
    return false;
  }

  return false;
}

/** Add a className attribute with the given value to an opening element */
function addClassNameAttr(openingElement: any, className: string): void {
  openingElement.attributes.push(
    b.jsxAttribute(
      b.jsxIdentifier("className"),
      b.stringLiteral(className)
    )
  );
}

// --- Class boundary helpers ---

function classBoundaryRegex(cls: string, flags = ""): RegExp {
  const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<=^|[\\s"'\`])${escaped}(?=$|[\\s"'\`])`, flags);
}

// --- Core operations ---

function markElementInSource(
  source: string,
  parser: any,
  opts: { componentName?: string; tag?: string; textHint?: string; lineHint?: number }
): { source: string; eid: string; modified: boolean } {
  const ast = parseSource(source, parser);

  const elementPath = findElement(ast, {
    tag: opts.tag,
    textHint: opts.textHint,
    componentName: opts.componentName,
    lineHint: opts.lineHint,
  });

  if (!elementPath) {
    const eid = generateEid();
    return { source, eid, modified: false };
  }

  // Check if already has a marker
  const existingMarker = findAttr(elementPath.node, "data-studio-eid");
  if (existingMarker) {
    const val = (n.StringLiteral.check(existingMarker.value) || n.Literal.check(existingMarker.value))
      ? existingMarker.value.value
      : null;
    if (val) return { source, eid: val as string, modified: false };
  }

  const eid = generateEid();
  addEidAttribute(elementPath.node, eid);
  return { source: printSource(ast), eid, modified: true };
}

function replaceClassInElement(
  source: string,
  parser: any,
  opts: {
    eid?: string;
    oldClass: string;
    newClass: string;
    tag?: string;
    textHint?: string;
    lineHint?: number;
  }
): { source: string; eid: string } {
  const ast = parseSource(source, parser);

  const elementPath = findElement(ast, opts);
  if (!elementPath) {
    throw new Error(`Could not find element with class "${opts.oldClass}" in source`);
  }

  const replaced = replaceClassInAttr(elementPath.node, opts.oldClass, opts.newClass);
  if (!replaced) {
    throw new Error(`Class "${opts.oldClass}" not found on the identified element`);
  }

  // Ensure eid marker
  let eid = opts.eid || "";
  if (!eid) {
    const existingMarker = findAttr(elementPath.node, "data-studio-eid");
    if (existingMarker) {
      eid = (existingMarker.value as any).value;
    } else {
      eid = generateEid();
      addEidAttribute(elementPath.node, eid);
    }
  }

  return { source: printSource(ast), eid };
}

function addClassToElement(
  source: string,
  parser: any,
  opts: {
    eid?: string;
    newClass: string;
    tag?: string;
    textHint?: string;
    lineHint?: number;
  }
): { source: string; eid: string } {
  const ast = parseSource(source, parser);

  const elementPath = findElement(ast, opts);
  if (!elementPath) {
    throw new Error("Could not find target element in source");
  }

  const classAttr = findAttr(elementPath.node, "className");
  if (classAttr) {
    const appended = appendClassToAttr(elementPath.node, opts.newClass);
    if (!appended) {
      throw new Error("Could not append class to className attribute");
    }
  } else {
    // No className — add one
    addClassNameAttr(elementPath.node, opts.newClass);
  }

  // Ensure eid marker
  let eid = opts.eid || "";
  if (!eid) {
    const existingMarker = findAttr(elementPath.node, "data-studio-eid");
    if (existingMarker) {
      eid = (existingMarker.value as any).value;
    } else {
      eid = generateEid();
      addEidAttribute(elementPath.node, eid);
    }
  }

  return { source: printSource(ast), eid };
}

function overrideClassOnInstance(
  source: string,
  parser: any,
  opts: {
    eid?: string;
    componentName: string;
    oldClass: string;
    newClass: string;
    textHint?: string;
    lineHint?: number;
  }
): { source: string; eid: string } {
  const ast = parseSource(source, parser);

  const elementPath = findElement(ast, {
    eid: opts.eid,
    lineHint: opts.lineHint,
    componentName: opts.componentName,
    textHint: opts.textHint,
  });

  if (!elementPath) {
    throw new Error(`Component <${opts.componentName}> not found`);
  }

  const classAttr = findAttr(elementPath.node, "className");

  if (classAttr) {
    // Try to replace oldClass with newClass
    const replaced = replaceClassInAttr(elementPath.node, opts.oldClass, opts.newClass);
    if (!replaced) {
      // oldClass not present — append newClass
      appendClassToAttr(elementPath.node, opts.newClass);
    }
  } else {
    // No className — add one
    addClassNameAttr(elementPath.node, opts.newClass);
  }

  // Ensure eid marker
  let eid = opts.eid || "";
  if (!eid) {
    const existingMarker = findAttr(elementPath.node, "data-studio-eid");
    if (existingMarker) {
      eid = (existingMarker.value as any).value;
    } else {
      eid = generateEid();
      addEidAttribute(elementPath.node, eid);
    }
  }

  return { source: printSource(ast), eid };
}

function replacePropInElement(
  source: string,
  parser: any,
  componentName: string,
  propName: string,
  propValue: string,
  lineHint?: number,
  textHint?: string
): string {
  const ast = parseSource(source, parser);

  const elementPath = findElement(ast, {
    lineHint,
    textHint,
    componentName,
  });

  if (!elementPath) {
    throw new Error(`Component <${componentName}> not found`);
  }

  const existingProp = findAttr(elementPath.node, propName);
  if (existingProp) {
    existingProp.value = b.stringLiteral(propValue);
  } else {
    elementPath.node.attributes.push(
      b.jsxAttribute(
        b.jsxIdentifier(propName),
        b.stringLiteral(propValue)
      )
    );
  }

  return printSource(ast);
}
