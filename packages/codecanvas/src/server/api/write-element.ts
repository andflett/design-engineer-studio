/**
 * Write API route for element class changes.
 * Uses data-source coordinates for exact element lookup — no scoring, no EID markers.
 */

import { Router } from "express";
import fs from "fs/promises";
import { safePath } from "../lib/safe-path.js";
import {
  parseSource,
  printSource,
  getParser,
  findAttr,
  replaceClassInAttr,
  appendClassToAttr,
  addClassNameAttr,
} from "../lib/ast-helpers.js";
import { findElementAtSource, findComponentNearSource } from "../lib/find-element.js";
import { computedToTailwindClass } from "../../shared/tailwind-map.js";
import { parseClasses } from "../../shared/tailwind-parser.js";

interface WriteElementConfig {
  projectRoot: string;
  stylingType: string;
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
  type?: "replaceClass" | "addClass" | "instanceOverride";
  oldClass?: string;
  newClass?: string;
  componentName?: string;
  textHint?: string;
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

  router.post("/", async (req, res) => {
    try {
      const body = req.body as WriteElementBody;

      if (!body.source) {
        res.status(400).json({ error: "Missing source" });
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

        // Find the <ComponentName> element near the source location
        const elementPath = findComponentNearSource(
          ast,
          body.componentName,
          body.source.line,
          body.textHint,
        );

        if (!elementPath) {
          res.status(404).json({
            error: `Component <${body.componentName}> not found near line ${body.source.line} in ${body.source.file}`,
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
          const match = computedToTailwindClass(change.property, change.value);
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
