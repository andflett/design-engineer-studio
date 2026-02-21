/**
 * AST helpers for JSX source manipulation.
 * Cherry-picked from studio/src/server/api/write-element.ts —
 * stripped of EID markers and scoring, kept class manipulation.
 */

import recast from "recast";
import { namedTypes as n, builders as b } from "ast-types";

let _parser: any = null;

/** Lazy-load the babel-ts parser for recast. */
export async function getParser() {
  if (!_parser) {
    _parser = await import("recast/parsers/babel-ts");
  }
  return _parser;
}

/** Parse source code into an AST using recast + babel-ts. */
export function parseSource(source: string, parser?: any) {
  return recast.parse(source, { parser: parser || getParser() });
}

/** Print an AST back to source code, preserving formatting. */
export function printSource(ast: any): string {
  return recast.print(ast).code;
}

/** Get the tag name of a JSXOpeningElement. */
export function getTagName(node: any): string {
  if (n.JSXIdentifier.check(node.name)) return node.name.name;
  if (n.JSXMemberExpression.check(node.name)) {
    return `${getTagName({ name: node.name.object })}.${node.name.property.name}`;
  }
  return "";
}

/** Find a JSX attribute by name on an opening element. */
export function findAttr(openingElement: any, name: string): any | null {
  for (const attr of openingElement.attributes || []) {
    if (n.JSXAttribute.check(attr) && n.JSXIdentifier.check(attr.name) && attr.name.name === name) {
      return attr;
    }
  }
  return null;
}

/** Create a regex that matches a class name at word boundaries within class strings. */
export function classBoundaryRegex(cls: string, flags = ""): RegExp {
  const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<=^|[\\s"'\`])${escaped}(?=$|[\\s"'\`])`, flags);
}

/**
 * Replace a class name in a className attribute.
 * Handles string literals and expression containers.
 */
export function replaceClassInAttr(openingElement: any, oldClass: string, newClass: string): boolean {
  const attr = findAttr(openingElement, "className");
  if (!attr) return false;

  // Case 1: className="string literal"
  if (n.StringLiteral.check(attr.value) || n.Literal.check(attr.value)) {
    const val = attr.value.value as string;
    const regex = classBoundaryRegex(oldClass);
    if (regex.test(val)) {
      attr.value = b.stringLiteral(val.replace(classBoundaryRegex(oldClass, "g"), newClass));
      return true;
    }
    return false;
  }

  // Case 2: className={expression}
  if (n.JSXExpressionContainer.check(attr.value)) {
    return replaceClassInExpression(attr.value.expression, oldClass, newClass);
  }

  return false;
}

/**
 * Recursively search an expression tree for string literals containing the old class.
 * Handles cn("base", "override"), template literals, ternaries, etc.
 */
export function replaceClassInExpression(expr: any, oldClass: string, newClass: string): boolean {
  // String literal
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

  // Template literal
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

  // Function call: cn(...), clsx(...)
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
export function appendClassToAttr(openingElement: any, newClass: string): boolean {
  const attr = findAttr(openingElement, "className");
  if (!attr) return false;

  // Case 1: className="string literal"
  if (n.StringLiteral.check(attr.value) || n.Literal.check(attr.value)) {
    const val = attr.value.value as string;
    attr.value = b.stringLiteral(val + " " + newClass);
    return true;
  }

  // Case 2: className={expression}
  if (n.JSXExpressionContainer.check(attr.value)) {
    return appendClassToExpression(attr.value.expression, newClass);
  }

  return false;
}

/**
 * Append a class to string literals within an expression.
 * For cn("base classes", variant), appends to the first string literal.
 */
export function appendClassToExpression(expr: any, newClass: string): boolean {
  if (n.StringLiteral.check(expr) || n.Literal.check(expr)) {
    if (typeof expr.value === "string") {
      expr.value = expr.value + " " + newClass;
      return true;
    }
    return false;
  }

  if (n.TemplateLiteral.check(expr)) {
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

/** Add a className attribute with the given value to an opening element. */
export function addClassNameAttr(openingElement: any, className: string): void {
  openingElement.attributes.push(
    b.jsxAttribute(
      b.jsxIdentifier("className"),
      b.stringLiteral(className)
    )
  );
}
