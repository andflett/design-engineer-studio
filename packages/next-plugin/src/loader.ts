/**
 * Webpack loader that adds data-source="file:line:col" attributes to JSX elements.
 * Uses Babel's parser for correct JSX identification (avoids matching TypeScript generics).
 * SWC stays enabled as the primary compiler — Babel is only used here for the source annotation pass.
 */

import path from "path";

interface LoaderContext {
  resourcePath: string;
  rootContext: string;
  getOptions(): { cwd?: string };
  callback(err: Error | null, content?: string, sourceMap?: any): void;
  async(): (err: Error | null, content?: string, sourceMap?: any) => void;
}

export default function designtoolsLoader(this: LoaderContext, source: string): void {
  const callback = this.async();
  const opts = this.getOptions();
  const cwd = opts.cwd || this.rootContext || process.cwd();
  const relativePath = path.relative(cwd, this.resourcePath);

  // Skip node_modules
  if (relativePath.includes("node_modules")) {
    callback(null, source);
    return;
  }

  // Quick check: skip files with no JSX
  if (!source.includes("<")) {
    callback(null, source);
    return;
  }

  try {
    // @babel/core is available at runtime via Next.js — don't bundle it
    const babel = require("@babel/core");

    const isTsx = this.resourcePath.endsWith(".tsx");

    const result = babel.transformSync(source, {
      filename: this.resourcePath,
      // No presets — we only want to parse and run our visitor, not compile
      presets: [],
      plugins: [
        function designtoolsSourcePlugin() {
          return {
            visitor: {
              JSXOpeningElement(nodePath: any) {
                const t = babel.types;
                const attrs = nodePath.node.attributes;
                const name = nodePath.node.name;

                // Skip fragments
                if (t.isJSXIdentifier(name) && name.name === "Fragment") return;
                if (t.isJSXMemberExpression(name) &&
                    t.isJSXIdentifier(name.property) &&
                    name.property.name === "Fragment") return;

                const loc = nodePath.node.loc;
                if (!loc) return;

                const value = `${relativePath}:${loc.start.line}:${loc.start.column}`;

                // Detect component elements (uppercase first letter or member expression like Foo.Bar)
                const isComponent =
                  (t.isJSXIdentifier(name) && name.name[0] === name.name[0].toUpperCase() && name.name[0] !== name.name[0].toLowerCase()) ||
                  t.isJSXMemberExpression(name);

                if (isComponent) {
                  // Component elements get data-instance-source — this attribute
                  // propagates through {...props} spread to the rendered DOM element,
                  // carrying the exact page-level coordinates of each component usage.
                  // The component's own data-source (on its root native element) won't
                  // collide because it uses a different attribute name.
                  const attrName = "data-instance-source";
                  if (attrs.some((a: any) =>
                    t.isJSXAttribute(a) &&
                    t.isJSXIdentifier(a.name) &&
                    a.name.name === attrName
                  )) return;
                  attrs.push(
                    t.jsxAttribute(
                      t.jsxIdentifier(attrName),
                      t.stringLiteral(value)
                    )
                  );
                } else {
                  // Native elements get data-source as before
                  if (attrs.some((a: any) =>
                    t.isJSXAttribute(a) &&
                    t.isJSXIdentifier(a.name) &&
                    a.name.name === "data-source"
                  )) return;
                  attrs.push(
                    t.jsxAttribute(
                      t.jsxIdentifier("data-source"),
                      t.stringLiteral(value)
                    )
                  );
                }
              },
            },
          };
        },
      ],
      // Tell Babel's parser to handle JSX and TypeScript syntax
      parserOpts: {
        plugins: ["jsx", ...(isTsx ? ["typescript" as const] : [])],
      },
      // Preserve original formatting as much as possible
      retainLines: true,
      // Don't look for user's .babelrc or babel.config — isolation
      configFile: false,
      babelrc: false,
    });

    callback(null, result?.code || source);
  } catch (err: any) {
    // If Babel fails, pass through the original source
    // This ensures the app still works even if our plugin has issues
    console.warn(`[designtools] Source annotation skipped for ${relativePath}: ${err.message}`);
    callback(null, source);
  }
}
