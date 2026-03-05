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
import { writeCssPropertyWithCleanup, findCssRule, findCssModuleImports, resolveModuleClassNames } from "../lib/write-css-rule.js";
import { writeScopedStyleProperty } from "../lib/scoped-style.js";

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
  /** Active responsive breakpoint prefix (e.g. "md:", "lg:") for class writes */
  activeBreakpoint?: string | null;
}

/**
 * Maps Tailwind parser property names to their shorthand parent(s).
 * When the user edits a longhand like padding-left, and the element has p-4,
 * we leave the shorthand in place and add the new longhand class alongside it.
 */
const SHORTHAND_PARENTS: Record<string, string[]> = {
  paddingTop: ["padding", "paddingY"],
  paddingBottom: ["padding", "paddingY"],
  paddingLeft: ["padding", "paddingX"],
  paddingRight: ["padding", "paddingX"],
  marginTop: ["margin", "marginY"],
  marginBottom: ["margin", "marginY"],
  marginLeft: ["margin", "marginX"],
  marginRight: ["margin", "marginX"],
  borderTopWidth: ["borderWidth"],
  borderRightWidth: ["borderWidth"],
  borderBottomWidth: ["borderWidth"],
  borderLeftWidth: ["borderWidth"],
};

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
        const source = await fs.readFile(fullPath, "utf-8");

        // SFC files (.astro, .svelte) use class="..." — handle with string manipulation
        const isSFC = body.source.file.endsWith(".astro") || body.source.file.endsWith(".svelte");
        if (isSFC) {
          const result = sfcReplaceOrAddClass(
            source,
            body.source.line,
            body.type,
            body.oldClass,
            body.newClass,
          );
          if (result) {
            await fs.writeFile(fullPath, result, "utf-8");
            res.json({ ok: true });
          } else {
            res.status(404).json({
              error: `Could not find class attribute near ${body.source.file}:${body.source.line}`,
            });
          }
          return;
        }

        // JSX files — use AST
        const parser = await getParser();
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
                  const result = writeCssPropertyWithCleanup(css, `.${className}`, cssProp, cssValue);
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

          // Extract class names from the element — used by steps 2, 2.5
          // Use regex for .astro/.svelte, AST for JSX
          let classes: string[] = [];
          const isSFC = body.source.file.endsWith(".astro") || body.source.file.endsWith(".svelte");

          if (isSFC) {
            // .astro/.svelte files use class="..." (HTML syntax), extract from source near the element
            const lines = source.split("\n");
            const startIdx = body.source.line - 1;
            const snippet = lines.slice(startIdx, startIdx + 5).join(" ");
            const classMatch = snippet.match(/\bclass\s*=\s*"([^"]*)"/);
            if (classMatch) {
              classes = classMatch[1].split(/\s+/).filter(Boolean);
            }
          } else {
            const parser = await getParser();
            const ast = parseSource(source, parser);
            const elementPath = findElementAtSource(ast, body.source.line, body.source.col);
            if (elementPath) {
              const classAttr = findAttr(elementPath.node, "className");
              const classNameStr = classAttr?.value?.value as string | undefined;
              if (classNameStr) {
                classes = classNameStr.split(/\s+/).filter(Boolean);
              }
            }
          }

          // For classless SFC elements, build descendant selectors (e.g. ".card h3")
          // by finding the tag name and walking up to parent elements with classes
          let tagSelectors: string[] = [];
          if (isSFC && classes.length === 0) {
            const lines = source.split("\n");
            const lineIdx = body.source.line - 1;
            const tagMatch = lines[lineIdx]?.match(/<([\w-]+)[\s>\/]/);
            const tagName = tagMatch?.[1];
            if (tagName) {
              // Walk backward to find nearest parent element with classes
              // Track nesting depth: closing tags on their own line increase depth
              let depth = 0;
              for (let i = lineIdx - 1; i >= 0; i--) {
                const ln = lines[i];
                // Count standalone closing tags (siblings that closed before us)
                const selfContained = (ln.match(/<[\w-]+[^>]*>.*<\/[\w-]+>/g) || []).length;
                const closes = (ln.match(/<\/[\w-]+\s*>/g) || []).length - selfContained;
                const opens = (ln.match(/<([\w-]+)[\s>]/g) || []).length - selfContained;
                depth += closes;
                if (opens > 0 && depth > 0) {
                  depth -= opens;
                  continue;
                }
                if (opens > 0) {
                  const parentClassMatch = ln.match(/class\s*=\s*"([^"]*)"/);
                  if (parentClassMatch) {
                    const parentClasses = parentClassMatch[1].split(/\s+/).filter(Boolean);
                    for (const cls of parentClasses) {
                      tagSelectors.push(`.${cls} ${tagName}`);
                    }
                  }
                  break;
                }
              }
              // Bare tag name as last resort
              tagSelectors.push(tagName);
            }
          }

          // Build the list of selectors to try: class-based first, then tag-based
          const selectorsToTry: string[] = [
            ...classes.map(cls => `.${cls}`),
            ...tagSelectors,
          ];

          // 2. Try project stylesheets — search cssFiles for matching rules
          if (!written && config.cssFiles.length > 0) {
            for (const selector of selectorsToTry) {
              for (const cssFile of config.cssFiles) {
                const cssPath = safePath(config.projectRoot, cssFile);
                try {
                  let css = await fs.readFile(cssPath, "utf-8");
                  if (findCssRule(css, selector)) {
                    const result = writeCssPropertyWithCleanup(css, selector, cssProp, cssValue);
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

          // 2.5. Try scoped <style> blocks in .astro / .svelte single-file components
          if (!written && isSFC) {
            for (const selector of selectorsToTry) {
              const result = writeScopedStyleProperty(source, selector, cssProp, cssValue);
              if (result) {
                await fs.writeFile(fullPath, result, "utf-8");
                written = true;
                break;
              }
            }
          }

          // 3. Fallback: write inline style on the JSX element (not supported for .astro / .svelte files)
          if (!written && !body.source.file.endsWith(".astro") && !body.source.file.endsWith(".svelte")) {
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

      // Active breakpoint prefix (e.g. "md:", "lg:") for class writes
      const activePrefix = body.activeBreakpoint ? `${body.activeBreakpoint}:` : undefined;

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
        // When activeBreakpoint is set, prefer matching the same-prefix class
        const parserProp = CSS_TO_PARSER_PROP[change.property];
        let existingClass: string | null = null;

        if (parserProp && currentClassName) {
          const parsed = parseClasses(currentClassName);
          const allParsed = [
            ...parsed.color, ...parsed.spacing, ...parsed.shape,
            ...parsed.typography, ...parsed.layout, ...parsed.size,
          ];
          // Prefer a match with the same prefix (breakpoint), fall back to any match
          const prefixMatch = activePrefix
            ? allParsed.find((p) => p.property === parserProp && p.prefix === activePrefix)
            : null;
          const anyMatch = allParsed.find((p) => p.property === parserProp);
          const match = prefixMatch || anyMatch;
          if (match) {
            existingClass = match.fullClass;
            // Preserve the breakpoint prefix on the new class
            if (activePrefix && match.prefix === activePrefix) {
              newClass = `${activePrefix}${newClass}`;
            }
          } else {
            // No direct match — check if a shorthand parent covers this property
            const shorthandParents = SHORTHAND_PARENTS[parserProp] || [];
            const hasShorthandParent = shorthandParents.some(
              (parent) => allParsed.some((p) => p.property === parent)
            );
            if (hasShorthandParent) {
              // Leave the shorthand class in place; add the new longhand class alongside
              existingClass = null;
            }
            if (activePrefix) {
              newClass = `${activePrefix}${newClass}`;
            }
          }
        } else if (activePrefix) {
          // No existing class to replace — add with breakpoint prefix
          newClass = `${activePrefix}${newClass}`;
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

/**
 * Replace or add a class in an SFC file (.astro/.svelte) using string manipulation.
 * Finds class="..." near the element's source line and modifies it.
 */
function sfcReplaceOrAddClass(
  source: string,
  line: number,
  type: "replaceClass" | "addClass",
  oldClass?: string,
  newClass?: string,
): string | null {
  if (!newClass) return null;

  const lines = source.split("\n");
  const startIdx = line - 1;

  // Search a window of lines around the element for the class attribute
  const searchStart = Math.max(0, startIdx);
  const searchEnd = Math.min(lines.length, startIdx + 5);
  const snippet = lines.slice(searchStart, searchEnd).join("\n");

  // Calculate byte offset of the snippet within the source
  const snippetOffset = lines.slice(0, searchStart).join("\n").length + (searchStart > 0 ? 1 : 0);

  // Find class="..." in the snippet
  const classMatch = snippet.match(/\bclass\s*=\s*"([^"]*)"/);

  if (!classMatch || classMatch.index == null) {
    if (type === "addClass") {
      // No class attr found — insert class="newClass" after the tag name
      const tagLine = lines[startIdx];
      const tagMatch = tagLine.match(/<(\w[\w-]*)/);
      if (tagMatch && tagMatch.index != null) {
        const insertPos = tagMatch.index + tagMatch[0].length;
        lines[startIdx] =
          tagLine.slice(0, insertPos) +
          ` class="${newClass}"` +
          tagLine.slice(insertPos);
        return lines.join("\n");
      }
    }
    return null;
  }

  const currentClasses = classMatch[1];
  const classAttrStart = snippetOffset + classMatch.index;
  const fullMatch = classMatch[0];

  if (type === "replaceClass" && oldClass) {
    const classTokens = currentClasses.split(/\s+/).filter(Boolean);
    const idx = classTokens.indexOf(oldClass);
    if (idx === -1) return null;
    classTokens[idx] = newClass;
    const replacement = `class="${classTokens.join(" ")}"`;
    return (
      source.slice(0, classAttrStart) +
      replacement +
      source.slice(classAttrStart + fullMatch.length)
    );
  }

  if (type === "addClass") {
    const newClassStr = currentClasses
      ? `${currentClasses} ${newClass}`
      : newClass;
    const replacement = `class="${newClassStr}"`;
    return (
      source.slice(0, classAttrStart) +
      replacement +
      source.slice(classAttrStart + fullMatch.length)
    );
  }

  return null;
}
