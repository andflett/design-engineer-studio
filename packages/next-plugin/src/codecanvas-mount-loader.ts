/**
 * Webpack loader that auto-mounts <CodeCanvas /> in the root layout.
 * Only runs in development. Injects the import and component into the JSX.
 *
 * Strategy: Simple string injection — find the {children} pattern in the layout
 * and add <CodeCanvas /> alongside it.
 */

interface LoaderContext {
  resourcePath: string;
  callback(err: Error | null, content?: string): void;
  async(): (err: Error | null, content?: string) => void;
}

export default function codecanvasMountLoader(this: LoaderContext, source: string): void {
  const callback = this.async();

  // Only inject into root layout (not nested layouts)
  // Root layout is detected by the presence of <html> tag
  if (!source.includes("<html")) {
    callback(null, source);
    return;
  }

  // Skip if already has CodeCanvas import
  if (source.includes("CodeCanvas")) {
    callback(null, source);
    return;
  }

  // Add import at the top (after "use client" or first import)
  // CodeCanvas is a "use client" component — importing it from an RSC is fine in Next.js
  const importStatement = `import { CodeCanvas } from "@designtools/next-plugin/codecanvas";\n`;
  let modified = source;

  // Find a good insertion point for the import
  const firstImportIndex = source.indexOf("import ");
  if (firstImportIndex !== -1) {
    modified = source.slice(0, firstImportIndex) + importStatement + source.slice(firstImportIndex);
  } else {
    modified = importStatement + source;
  }

  // Add <CodeCanvas /> just before {children}
  modified = modified.replace(
    /(\{children\})/,
    `<CodeCanvas />\n          $1`
  );

  callback(null, modified);
}
