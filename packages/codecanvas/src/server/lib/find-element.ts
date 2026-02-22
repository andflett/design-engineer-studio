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
