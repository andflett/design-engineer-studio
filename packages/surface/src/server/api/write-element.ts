/**
 * Write API route for element class changes.
 * Uses data-source coordinates for exact element lookup — no scoring, no EID markers.
 */

import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { safePath } from "../lib/safe-path.js";
import { builders as b } from "ast-types";
import {
  parseSource,
  printSource,
  getParser,
  findAttr,
  replaceClassInAttr,
  appendClassToAttr,
  addClassNameAttr,
} from "../lib/ast-helpers.js";
import { findElementAtSource, findComponentAtSource } from "../lib/find-element.js";
import { computedToTailwindClass } from "../../shared/tailwind-map.js";
import type { ResolvedTailwindTheme } from "../../shared/tailwind-theme.js";
import { parseClasses } from "../../shared/tailwind-parser.js";
import { writeCssProperty, findCssRule, findCssModuleImports, resolveModuleClassNames } from "../lib/write-css-rule.js";

interface WriteElementConfig {
  projectRoot: string;
  stylingType: string;
  cssFiles: string[];
  tailwindTheme: ResolvedTailwindTheme | null;
}

interface StyleChange {
  property: string;
  value: string;
  hint?: {
    tailwindClass?: string;
  };
}

interface WriteElementBody {
  source: {
    file: string;
    line: number;
    col: number;
  };
  changes?: StyleChange[];
  type?: "replaceClass" | "addClass" | "instanceOverride" | "prop" | "resetInstanceClassName" | "cssProperty";
  oldClass?: string;
  newClass?: string;
  componentName?: string;
  propName?: string;
  propValue?: string;
}

/**
 * Maps CSS property names to the tailwind-parser property name
 * so we can find existing classes for the same CSS property.
 */
const CSS_TO_PARSER_PROP: Record<string, string> = {
  "padding-top": "paddingTop", "padding-right": "paddingRight",
  "padding-bottom": "paddingBottom", "padding-left": "paddingLeft",
  "margin-top": "marginTop", "margin-right": "marginRight",
  "margin-bottom": "marginBottom", "margin-left": "marginLeft",
  "gap": "gap", "row-gap": "gapY", "column-gap": "gapX",
  "width": "width", "height": "height",
  "min-width": "minWidth", "min-height": "minHeight",
  "max-width": "maxWidth", "max-height": "maxHeight",
  "font-size": "fontSize", "font-weight": "fontWeight",
  "line-height": "lineHeight", "letter-spacing": "letterSpacing",
  "text-align": "textAlign", "text-transform": "textTransform",
  "display": "display", "position": "position",
  "flex-direction": "flexDirection", "flex-wrap": "flexWrap",
  "align-items": "alignItems", "justify-content": "justifyContent",
  "color": "textColor", "background-color": "backgroundColor",
  "border-color": "borderColor",
  "border-top-left-radius": "borderRadius",
  "border-top-right-radius": "borderRadius",
  "border-bottom-right-radius": "borderRadius",
  "border-bottom-left-radius": "borderRadius",
};

export function createWriteElementRouter(config: WriteElementConfig) {
  const router = Router();

  // GET /api/write-element/instance-props — read current string-literal props from JSX source
  router.get("/instance-props", async (req, res) => {
    try {
      const file = req.query.file as string;
      const line = parseInt(req.query.line as string, 10);
      const col = req.query.col ? parseInt(req.query.col as string, 10) : undefined;
      const componentName = req.query.componentName as string;

      if (!file || !line || !componentName) {
        res.status(400).json({ error: "Missing file, line, or componentName" });
        return;
      }

      if (col == null) {
        res.status(400).json({ error: "Missing col — rebuild next-plugin" });
        return;
      }

      const fullPath = safePath(config.projectRoot, file);
      const parser = await getParser();
      const source = await fs.readFile(fullPath, "utf-8");
      const ast = parseSource(source, parser);

      const elementPath = findComponentAtSource(ast, componentName, line, col);
      if (!elementPath) {
        res.status(404).json({
          error: `Component <${componentName}> not found at ${file}:${line}:${col}`,
        });
        return;
      }

      const props: Record<string, string> = {};
      for (const attr of elementPath.node.attributes) {
        if (attr.type === "JSXAttribute" && attr.name?.type === "JSXIdentifier") {
          const name = attr.name.name;
          if (attr.value?.type === "StringLiteral" || attr.value?.type === "Literal") {
            props[name] = String(attr.value.value);
          }
        }
      }

      res.json({ props });
    } catch (err: any) {
      console.error("[instance-props]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const body = req.body as WriteElementBody;

      if (!body.source) {
        res.status(400).json({ error: "Missing source" });
        return;
      }

      // Reject writes to files inside node_modules
      if (body.source.file.includes("node_modules")) {
        res.status(422).json({
          error: "readonly_package",
          message: "Cannot edit — file is inside node_modules",
        });
        return;
      }

      // Handle instanceOverride: modify className on a component usage in the page file
      if (body.type === "instanceOverride") {
        if (!body.componentName || !body.newClass) {
          res.status(400).json({ error: "Missing componentName or newClass" });
          return;
        }

        const fullPath = safePath(config.projectRoot, body.source.file);
        const parser = await getParser();
        const source = await fs.readFile(fullPath, "utf-8");
        const ast = parseSource(source, parser);

        if (body.source.col == null) {
          res.status(400).json({ error: "Missing col — rebuild next-plugin" });
          return;
        }
        const elementPath = findComponentAtSource(ast, body.componentName, body.source.line, body.source.col);

        if (!elementPath) {
          res.status(404).json({
            error: `Component <${body.componentName}> not found at ${body.source.file}:${body.source.line}:${body.source.col}`,
          });
          return;
        }

        const openingElement = elementPath.node;
        const classAttr = findAttr(openingElement, "className");

        if (body.oldClass && classAttr) {
          const replaced = replaceClassInAttr(openingElement, body.oldClass, body.newClass);
          if (!replaced) {
            appendClassToAttr(openingElement, body.newClass);
          }
        } else if (classAttr) {
          appendClassToAttr(openingElement, body.newClass);
        } else {
          addClassNameAttr(openingElement, body.newClass);
        }

        const output = printSource(ast);
        await fs.writeFile(fullPath, output, "utf-8");
        res.json({ ok: true });
        return;
      }

      // Handle resetInstanceClassName: remove className attribute from a component instance
      if (body.type === "resetInstanceClassName") {
        if (!body.componentName) {
          res.status(400).json({ error: "Missing componentName" });
          return;
        }

        const fullPath = safePath(config.projectRoot, body.source.file);
        const parser = await getParser();
        const source = await fs.readFile(fullPath, "utf-8");
        const ast = parseSource(source, parser);

        if (body.source.col == null) {
          res.status(400).json({ error: "Missing col — rebuild next-plugin" });
          return;
        }
        const elementPath = findComponentAtSource(ast, body.componentName, body.source.line, body.source.col);

        if (!elementPath) {
          res.status(404).json({
            error: `Component <${body.componentName}> not found at ${body.source.file}:${body.source.line}:${body.source.col}`,
          });
          return;
        }

        const openingElement = elementPath.node;
        openingElement.attributes = openingElement.attributes.filter((attr: any) => {
          if (attr.type === "JSXAttribute" && attr.name?.type === "JSXIdentifier") {
            return attr.name.name !== "className";
          }
          return true;
        });

        const output = printSource(ast);
        await fs.writeFile(fullPath, output, "utf-8");
        res.json({ ok: true });
        return;
      }

      // Handle prop: set/add a JSX prop (e.g. variant="destructive") on a component instance
      if (body.type === "prop") {
        if (!body.componentName || !body.propName || body.propValue === undefined) {
          res.status(400).json({ error: "Missing componentName, propName, or propValue" });
          return;
        }

        const fullPath = safePath(config.projectRoot, body.source.file);
        const parser = await getParser();
        const source = await fs.readFile(fullPath, "utf-8");
        const ast = parseSource(source, parser);

        if (body.source.col == null) {
          res.status(400).json({ error: "Missing col — rebuild next-plugin" });
          return;
        }
        const elementPath = findComponentAtSource(ast, body.componentName, body.source.line, body.source.col);

        if (!elementPath) {
          res.status(404).json({
            error: `Component <${body.componentName}> not found at ${body.source.file}:${body.source.line}:${body.source.col}`,
          });
          return;
        }

        const openingElement = elementPath.node;
        const existingProp = findAttr(openingElement, body.propName);

        if (existingProp) {
          existingProp.value = b.stringLiteral(body.propValue);
        } else {
          openingElement.attributes.push(
            b.jsxAttribute(
              b.jsxIdentifier(body.propName),
              b.stringLiteral(body.propValue),
            ),
          );
        }

        const output = printSource(ast);
        await fs.writeFile(fullPath, output, "utf-8");
        res.json({ ok: true });
        return;
      }

      // Handle replaceClass / addClass request types
      if (body.type === "replaceClass" || body.type === "addClass") {
        const fullPath = safePath(config.projectRoot, body.source.file);
        const parser = await getParser();
        const source = await fs.readFile(fullPath, "utf-8");
        const ast = parseSource(source, parser);
        const elementPath = findElementAtSource(ast, body.source.line, body.source.col);

        if (!elementPath) {
          res.status(404).json({
            error: `Element not found at ${body.source.file}:${body.source.line}:${body.source.col}`,
          });
          return;
        }

        const openingElement = elementPath.node;
        const classAttr = findAttr(openingElement, "className");

        if (body.type === "replaceClass" && body.oldClass && body.newClass) {
          if (classAttr) {
            replaceClassInAttr(openingElement, body.oldClass, body.newClass);
          }
        } else if (body.type === "addClass" && body.newClass) {
          if (classAttr) {
            appendClassToAttr(openingElement, body.newClass);
          } else {
            addClassNameAttr(openingElement, body.newClass);
          }
        }

        const output = printSource(ast);
        await fs.writeFile(fullPath, output, "utf-8");
        res.json({ ok: true });
        return;
      }

      // Handle cssProperty: write CSS property/value to stylesheet or inline style
      if (body.type === "cssProperty") {
        if (!body.changes || body.changes.length === 0) {
          res.status(400).json({ error: "Missing changes for cssProperty" });
          return;
        }

        const fullPath = safePath(config.projectRoot, body.source.file);
        const source = await fs.readFile(fullPath, "utf-8");

        for (const change of body.changes) {
          const cssProp = change.property;
          const cssValue = change.value;

          // 1. Try CSS module imports — find .module.css and matching class
          const moduleImports = findCssModuleImports(source);
          let written = false;

          if (moduleImports.length > 0) {
            const bindings = new Map(moduleImports.map((m) => [m.binding, m.modulePath]));
            const classNames = resolveModuleClassNames(source, body.source.line, body.source.col, bindings);

            for (const className of classNames) {
              for (const imp of moduleImports) {
                const cssPath = safePath(
                  config.projectRoot,
                  path.join(path.dirname(body.source.file), imp.modulePath),
                );
                try {
                  let css = await fs.readFile(cssPath, "utf-8");
                  const result = writeCssProperty(css, `.${className}`, cssProp, cssValue);
                  if (result) {
                    await fs.writeFile(cssPath, result, "utf-8");
                    written = true;
                    break;
                  }
                } catch { /* file not found — try next */ }
              }
              if (written) break;
            }
          }

          // 2. Try project stylesheets — search cssFiles for matching class rules
          if (!written && config.cssFiles.length > 0) {
            // Extract class names from the element's className attribute
            const parser = await getParser();
            const ast = parseSource(source, parser);
            const elementPath = findElementAtSource(ast, body.source.line, body.source.col);
            if (elementPath) {
              const classAttr = findAttr(elementPath.node, "className");
              const classNameStr = classAttr?.value?.value as string | undefined;
              if (classNameStr) {
                const classes = classNameStr.split(/\s+/).filter(Boolean);
                for (const cls of classes) {
                  for (const cssFile of config.cssFiles) {
                    const cssPath = safePath(config.projectRoot, cssFile);
                    try {
                      let css = await fs.readFile(cssPath, "utf-8");
                      if (findCssRule(css, `.${cls}`)) {
                        const result = writeCssProperty(css, `.${cls}`, cssProp, cssValue);
                        if (result) {
                          await fs.writeFile(cssPath, result, "utf-8");
                          written = true;
                          break;
                        }
                      }
                    } catch { /* file not found — try next */ }
                  }
                  if (written) break;
                }
              }
            }
          }

          // 3. Fallback: write inline style on the JSX element
          if (!written) {
            const parser = await getParser();
            const ast = parseSource(source, parser);
            const elementPath = findElementAtSource(ast, body.source.line, body.source.col);
            if (!elementPath) {
              res.status(404).json({
                error: `Element not found at ${body.source.file}:${body.source.line}:${body.source.col}`,
              });
              return;
            }

            setInlineStyleProperty(elementPath.node, cssProp, cssValue);
            const output = printSource(ast);
            await fs.writeFile(fullPath, output, "utf-8");
          }
        }

        res.json({ ok: true });
        return;
      }

      if (!body.changes || body.changes.length === 0) {
        res.status(400).json({ error: "Missing changes" });
        return;
      }

      // Validate file path
      const fullPath = safePath(config.projectRoot, body.source.file);

      // Read and parse source
      const parser = await getParser();
      const source = await fs.readFile(fullPath, "utf-8");
      const ast = parseSource(source, parser);

      // Find element at exact source location
      const elementPath = findElementAtSource(ast, body.source.line, body.source.col);
      if (!elementPath) {
        res.status(404).json({
          error: `Element not found at ${body.source.file}:${body.source.line}:${body.source.col}`,
        });
        return;
      }

      const openingElement = elementPath.node;

      // Get current className for parsing
      const classAttr = findAttr(openingElement, "className");
      const currentClassName = classAttr
        ? (classAttr.value?.value as string) || ""
        : "";

      // Apply each change
      for (const change of body.changes) {
        // Determine the new Tailwind class
        let newClass: string;

        if (change.hint?.tailwindClass) {
          // Use the hint directly (from token picker)
          newClass = change.hint.tailwindClass;
        } else {
          // Map CSS value to Tailwind class
          const match = computedToTailwindClass(change.property, change.value, config.tailwindTheme);
          if (!match) continue;
          newClass = match.tailwindClass;
        }

        // Find existing class for the same CSS property
        const parserProp = CSS_TO_PARSER_PROP[change.property];
        let existingClass: string | null = null;

        if (parserProp && currentClassName) {
          const parsed = parseClasses(currentClassName);
          const allParsed = [
            ...parsed.color, ...parsed.spacing, ...parsed.shape,
            ...parsed.typography, ...parsed.layout, ...parsed.size,
          ];
          const match = allParsed.find((p) => p.property === parserProp);
          if (match) {
            existingClass = match.fullClass;
          }
        }

        if (existingClass) {
          // Replace existing class
          replaceClassInAttr(openingElement, existingClass, newClass);
        } else if (classAttr) {
          // Append to existing className
          appendClassToAttr(openingElement, newClass);
        } else {
          // Add new className attribute
          addClassNameAttr(openingElement, newClass);
        }
      }

      // Write back
      const output = printSource(ast);
      await fs.writeFile(fullPath, output, "utf-8");

      res.json({ ok: true });
    } catch (err: any) {
      console.error("[write-element]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

/**
 * Convert a CSS property name (e.g. "background-color") to camelCase (e.g. "backgroundColor").
 */
function cssPropToCamel(prop: string): string {
  return prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Add or update a property in the inline `style` JSX attribute.
 * Creates `style={{ prop: "value" }}` if no style attr exists.
 */
function setInlineStyleProperty(openingElement: any, cssProp: string, cssValue: string): void {
  const camelProp = cssPropToCamel(cssProp);
  const styleAttr = findAttr(openingElement, "style");

  if (styleAttr && styleAttr.value?.type === "JSXExpressionContainer") {
    const expr = styleAttr.value.expression;
    if (expr.type === "ObjectExpression") {
      // Find existing property
      const existing = expr.properties.find(
        (p: any) => p.type === "ObjectProperty" && p.key?.type === "Identifier" && p.key.name === camelProp
      );
      if (existing) {
        existing.value = b.stringLiteral(cssValue);
      } else {
        expr.properties.push(
          b.objectProperty(b.identifier(camelProp), b.stringLiteral(cssValue))
        );
      }
      return;
    }
  }

  // No style attribute or not an object expression — create a new one
  if (styleAttr) {
    // Replace with object expression containing the property
    styleAttr.value = b.jsxExpressionContainer(
      b.objectExpression([
        b.objectProperty(b.identifier(camelProp), b.stringLiteral(cssValue)),
      ])
    );
  } else {
    openingElement.attributes.push(
      b.jsxAttribute(
        b.jsxIdentifier("style"),
        b.jsxExpressionContainer(
          b.objectExpression([
            b.objectProperty(b.identifier(camelProp), b.stringLiteral(cssValue)),
          ])
        )
      )
    );
  }
}
