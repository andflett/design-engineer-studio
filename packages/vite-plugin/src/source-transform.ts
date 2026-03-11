/**
 * Babel visitor that adds data-source="file:line:col" attributes to JSX elements.
 * Ported from packages/next-plugin/src/loader.ts for use as a Vite transform.
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);

/** Returns true if nodePath is inside a .map()/.flatMap()/.filter() callback. */
function isInMapCallback(nodePath: any, t: any): boolean {
  let cur = nodePath.parentPath;
  while (cur) {
    // Stop at named function boundaries (don't cross into enclosing render functions)
    if (
      t.isFunctionDeclaration(cur.node) ||
      t.isFunctionExpression(cur.node) ||
      t.isClassMethod(cur.node) ||
      t.isObjectMethod(cur.node)
    ) break;
    if (
      t.isCallExpression(cur.node) &&
      t.isMemberExpression(cur.node.callee) &&
      t.isIdentifier(cur.node.callee.property) &&
      ["map", "flatMap", "filter"].includes(cur.node.callee.property.name)
    ) return true;
    cur = cur.parentPath;
  }
  return false;
}

/** Returns true if the JSXElement has at least one expression child (dynamic content). */
function hasDynamicChildren(nodePath: any, t: any): boolean {
  const children: any[] = nodePath.parent?.children ?? [];
  return children.some(
    (child) => t.isJSXExpressionContainer(child) && !t.isJSXEmptyExpression(child.expression)
  );
}

export function transformSource(code: string, id: string, relativePath: string): string {
  // Quick check: skip files with no JSX
  if (!code.includes("<")) {
    return code;
  }

  const babel = require("@babel/core");
  const isTsx = id.endsWith(".tsx");

  const result = babel.transformSync(code, {
    filename: id,
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
              if (
                t.isJSXMemberExpression(name) &&
                t.isJSXIdentifier(name.property) &&
                name.property.name === "Fragment"
              )
                return;

              const loc = nodePath.node.loc;
              if (!loc) return;

              const value = `${relativePath}:${loc.start.line}:${loc.start.column}`;

              // Detect component elements (uppercase first letter or member expression like Foo.Bar)
              const isComponent =
                (t.isJSXIdentifier(name) &&
                  name.name[0] === name.name[0].toUpperCase() &&
                  name.name[0] !== name.name[0].toLowerCase()) ||
                t.isJSXMemberExpression(name);

              if (isComponent) {
                const attrName = "data-instance-source";
                if (
                  attrs.some(
                    (a: any) =>
                      t.isJSXAttribute(a) &&
                      t.isJSXIdentifier(a.name) &&
                      a.name.name === attrName
                  )
                )
                  return;
                attrs.push(
                  t.jsxAttribute(t.jsxIdentifier(attrName), t.stringLiteral(value))
                );
              } else {
                if (
                  attrs.some(
                    (a: any) =>
                      t.isJSXAttribute(a) &&
                      t.isJSXIdentifier(a.name) &&
                      a.name.name === "data-source"
                  )
                )
                  return;
                attrs.push(
                  t.jsxAttribute(t.jsxIdentifier("data-source"), t.stringLiteral(value))
                );

                // Annotate loop elements — inside .map()/.flatMap()/.filter() callback
                if (isInMapCallback(nodePath, t)) {
                  attrs.push(t.jsxAttribute(t.jsxIdentifier("data-loop"), null));
                }

                // Annotate dynamic content — has at least one {expression} child
                if (hasDynamicChildren(nodePath, t)) {
                  attrs.push(t.jsxAttribute(t.jsxIdentifier("data-dynamic"), null));
                }
              }
            },
          },
        };
      },
    ],
    parserOpts: {
      plugins: ["jsx", ...(isTsx ? (["typescript"] as const) : [])],
    },
    retainLines: true,
    configFile: false,
    babelrc: false,
  });

  return result?.code || code;
}
