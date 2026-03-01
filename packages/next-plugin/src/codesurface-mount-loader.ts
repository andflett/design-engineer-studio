/**
 * Webpack loader that auto-mounts <CodeSurface /> in the root layout.
 * Only runs in development. Injects the import and component into the JSX.
 *
 * Strategy: Simple string injection — find the {children} pattern in the layout
 * and add <CodeSurface /> alongside it.
 */

interface LoaderContext {
  resourcePath: string;
  callback(err: Error | null, content?: string): void;
  async(): (err: Error | null, content?: string) => void;
}

export default function codesurfaceMountLoader(this: LoaderContext, source: string): void {
  const callback = this.async();

  // Only inject into root layout (not nested layouts)
  // Root layout is detected by the presence of <html> tag
  if (!source.includes("<html")) {
    callback(null, source);
    return;
  }

  // Skip if already has CodeSurface import
  if (source.includes("CodeSurface")) {
    callback(null, source);
    return;
  }

  // Add imports at the top (after "use client" or first import)
  // The registry is rendered as a component to prevent tree-shaking.
  const importStatements = [
    `import { CodeSurface } from "@designtools/next-plugin/codesurface";`,
    `import { DesigntoolsRegistry } from "./designtools-registry";`,
  ].join("\n") + "\n";

  let modified = source;

  // Find a good insertion point for the imports
  const firstImportIndex = source.indexOf("import ");
  if (firstImportIndex !== -1) {
    modified = source.slice(0, firstImportIndex) + importStatements + source.slice(firstImportIndex);
  } else {
    modified = importStatements + source;
  }

  // Add <CodeSurface /> and <DesigntoolsRegistry /> just before {children}
  modified = modified.replace(
    /(\{children\})/,
    `<CodeSurface /><DesigntoolsRegistry />\n          $1`
  );

  callback(null, modified);
}
