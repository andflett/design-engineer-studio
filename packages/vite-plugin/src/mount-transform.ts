/**
 * Transform that auto-mounts <Surface /> and <DesigntoolsRegistry /> in the app's main.tsx.
 * Equivalent of packages/next-plugin/src/surface-mount-loader.ts, adapted for Vite's
 * createRoot(...).render(...) entry point pattern.
 */

export function transformMount(code: string): string {
  // Skip if already has Surface import
  if (code.includes("Surface")) {
    return code;
  }

  // Must have createRoot or render call to be a valid entry point
  if (!code.includes("createRoot") && !code.includes("render")) {
    return code;
  }

  const importStatements = [
    `import { Surface } from "@designtools/vite-plugin/surface";`,
    `import { DesigntoolsRegistry } from "./designtools-registry";`,
  ].join("\n");

  let modified = code;

  // Insert imports after the last existing import statement
  const importRegex = /^import\s.+$/gm;
  let lastImportMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(code)) !== null) {
    // Handle multi-line imports (find the closing line)
    let end = match.index + match[0].length;
    if (match[0].includes("{") && !match[0].includes("}")) {
      const closingBrace = code.indexOf("}", end);
      if (closingBrace !== -1) {
        const lineEnd = code.indexOf("\n", closingBrace);
        end = lineEnd !== -1 ? lineEnd : closingBrace + 1;
      }
    }
    lastImportMatch = match;
    lastImportMatch.index = end;
  }

  if (lastImportMatch) {
    const insertPos = lastImportMatch.index;
    // Find the end of the line at insertPos
    const lineEnd = code.indexOf("\n", insertPos);
    const pos = lineEnd !== -1 ? lineEnd + 1 : insertPos;
    modified = code.slice(0, pos) + importStatements + "\n" + code.slice(pos);
  } else {
    modified = importStatements + "\n" + code;
  }

  // Strategy 1: If </StrictMode> found, inject before it
  if (modified.includes("</StrictMode>")) {
    modified = modified.replace(
      "</StrictMode>",
      "<Surface /><DesigntoolsRegistry /></StrictMode>"
    );
    return modified;
  }

  // Strategy 2: If .render(<App />) found, wrap in fragment with Surface
  modified = modified.replace(
    /\.render\(\s*(<[A-Z]\w*\s*\/>)\s*\)/,
    ".render(<>$1<Surface /><DesigntoolsRegistry /></>)"
  );

  return modified;
}
