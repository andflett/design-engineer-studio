/**
 * Element finder using data-source coordinates.
 * Single strategy: exact match on line:col from the data-source Babel plugin.
 *
 * The data-source attribute value format is "file:line:col" where:
 * - line is 1-based (from Babel's loc.start.line)
 * - col is 0-based (from Babel's loc.start.column)
 */

import { visit } from "recast";
import { namedTypes as n } from "ast-types";

/**
 * Find a JSX element at the given source location.
 * Walks all JSXOpeningElements and matches on exact line and column.
 */
export function findElementAtSource(
  ast: any,
  line: number,
  col: number
): any | null {
  let found: any = null;

  visit(ast, {
    visitJSXOpeningElement(path) {
      const loc = path.node.loc;
      if (loc && loc.start.line === line && loc.start.column === col) {
        found = path;
        return false; // stop traversal
      }
      this.traverse(path);
    },
  });

  return found;
}

/**
 * Find a component JSX element at exact source coordinates.
 * Used when data-instance-source provides precise line:col for the component usage.
 */
export function findComponentAtSource(
  ast: any,
  componentName: string,
  line: number,
  col: number,
): any | null {
  let found: any = null;

  visit(ast, {
    visitJSXOpeningElement(path) {
      const name = path.node.name;
      if (n.JSXIdentifier.check(name) && name.name === componentName) {
        const loc = path.node.loc;
        if (loc && loc.start.line === line && loc.start.column === col) {
          found = path;
          return false;
        }
      }
      this.traverse(path);
    },
  });

  return found;
}

/**
 * Find a component JSX element by name near a source location.
 * Used for instance overrides: the instanceSource points to an ancestor
 * in the page file, and we search for the nearest <ComponentName> element.
 *
 * Strategy: collect all <ComponentName> elements, pick the one closest
 * to lineHint. If textHint is provided, prefer elements whose children
 * contain that text (for disambiguation when multiple instances exist).
 */
export function findComponentNearSource(
  ast: any,
  componentName: string,
  lineHint: number,
  textHint?: string,
): any | null {
  const candidates: Array<{ path: any; line: number; hasTextMatch: boolean }> = [];

  visit(ast, {
    visitJSXOpeningElement(path) {
      const name = path.node.name;
      if (n.JSXIdentifier.check(name) && name.name === componentName) {
        const loc = path.node.loc;
        const line = loc?.start.line ?? 0;

        // Check if parent JSXElement contains text matching the hint
        let hasTextMatch = false;
        if (textHint && path.parent?.node) {
          const parentNode = path.parent.node;
          if (n.JSXElement.check(parentNode)) {
            const text = extractJSXText(parentNode);
            hasTextMatch = text.includes(textHint.slice(0, 20));
          }
        }

        candidates.push({ path, line, hasTextMatch });
      }
      this.traverse(path);
    },
  });

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].path;

  // If textHint matches any candidates, prefer those over non-matches
  if (textHint) {
    const textMatches = candidates.filter((c) => c.hasTextMatch);
    if (textMatches.length >= 1) {
      textMatches.sort((a, b) => Math.abs(a.line - lineHint) - Math.abs(b.line - lineHint));
      return textMatches[0].path;
    }
  }

  // Pick the candidate closest to the lineHint
  candidates.sort((a, b) => Math.abs(a.line - lineHint) - Math.abs(b.line - lineHint));
  return candidates[0].path;
}

/** Extract text content from a JSXElement's children (shallow). */
function extractJSXText(element: any): string {
  const parts: string[] = [];
  for (const child of element.children || []) {
    if (n.JSXText.check(child)) {
      parts.push(child.value);
    } else if (n.JSXExpressionContainer.check(child)) {
      if (n.StringLiteral.check(child.expression) || n.Literal.check(child.expression)) {
        parts.push(String(child.expression.value));
      }
    } else if (n.JSXElement.check(child)) {
      parts.push(extractJSXText(child));
    }
  }
  return parts.join("").trim();
}
