/**
 * CSS rule editing utilities — find and modify CSS rules by selector.
 * Uses the same regex/string-slice pattern as replaceTokenInBlock() in write-tokens.ts.
 */

export interface CssRuleLocation {
  /** Start of the selector text */
  blockStart: number;
  /** Position of the closing brace */
  blockEnd: number;
  /** Position of the opening brace */
  openBrace: number;
}

/**
 * Find a CSS rule by selector (e.g. ".card-header").
 * Handles nested braces correctly via depth counting.
 */
export function findCssRule(css: string, selector: string): CssRuleLocation | null {
  // Escape the selector for regex, then search for it followed by `{`
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{`));
  if (!match || match.index == null) return null;

  const blockStart = match.index;
  const openBrace = css.indexOf("{", blockStart);
  let depth = 1;
  let pos = openBrace + 1;
  while (depth > 0 && pos < css.length) {
    if (css[pos] === "{") depth++;
    if (css[pos] === "}") depth--;
    pos++;
  }

  return { blockStart, blockEnd: pos, openBrace };
}

/**
 * Write a CSS property/value into an existing rule.
 * If the property already exists, replace its value. Otherwise append it.
 * Returns the modified CSS string, or null if the selector was not found.
 */
export function writeCssProperty(
  css: string,
  selector: string,
  property: string,
  value: string,
): string | null {
  const loc = findCssRule(css, selector);
  if (!loc) return null;

  let block = css.slice(loc.openBrace + 1, loc.blockEnd - 1);

  const propEscaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const propRegex = new RegExp(`(${propEscaped}\\s*:\\s*)([^;]+)(;)`);

  if (propRegex.test(block)) {
    // Replace existing value
    block = block.replace(propRegex, `$1${value}$3`);
  } else {
    // Append new property — infer indentation from existing declarations
    const indent = block.match(/\n(\s+)\S/)?.[1] ?? "  ";
    block = block.trimEnd() + `\n${indent}${property}: ${value};\n`;
  }

  return css.slice(0, loc.openBrace + 1) + block + css.slice(loc.blockEnd - 1);
}

/**
 * Find CSS module imports in a JS/TS source string.
 * Matches: `import styles from "./foo.module.css"` (default import)
 * Returns binding name and module path.
 */
export function findCssModuleImports(
  source: string,
): { binding: string; modulePath: string }[] {
  const results: { binding: string; modulePath: string }[] = [];
  const regex = /import\s+(\w+)\s+from\s+["']([^"']+\.module\.(?:css|scss|less))["']/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(source)) !== null) {
    results.push({ binding: m[1], modulePath: m[2] });
  }
  return results;
}

/**
 * Resolve className expression to CSS class names at a given JSX element.
 * Handles `styles.foo`, `styles["foo"]`, and template literals containing these.
 * Returns the raw class names (without the module prefix).
 */
export function resolveModuleClassNames(
  jsxSource: string,
  elementLine: number,
  elementCol: number,
  bindings: Map<string, string>,
): string[] {
  // Find the JSX element at the given line/col and extract className value
  const lines = jsxSource.split("\n");
  if (elementLine < 1 || elementLine > lines.length) return [];

  // Scan forward from the element position to find className
  const startOffset = lines.slice(0, elementLine - 1).reduce((acc, l) => acc + l.length + 1, 0) + elementCol;
  const rest = jsxSource.slice(startOffset);

  // Look for className attribute within the opening tag
  const tagEnd = rest.indexOf(">");
  if (tagEnd === -1) return [];
  const tagContent = rest.slice(0, tagEnd);

  const classNames: string[] = [];

  for (const [binding] of bindings) {
    // Match styles.foo
    const dotRegex = new RegExp(`${binding}\\.(\\w+)`, "g");
    let dm: RegExpExecArray | null;
    while ((dm = dotRegex.exec(tagContent)) !== null) {
      classNames.push(dm[1]);
    }

    // Match styles["foo"]
    const bracketRegex = new RegExp(`${binding}\\["([^"]+)"\\]`, "g");
    let bm: RegExpExecArray | null;
    while ((bm = bracketRegex.exec(tagContent)) !== null) {
      classNames.push(bm[1]);
    }
  }

  return classNames;
}
