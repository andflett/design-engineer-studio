import { Router } from "express";
import fs from "fs/promises";
import { safePath } from "../lib/safe-path.js";

export function createComponentRouter(projectRoot: string) {
  const router = Router();

  router.post("/", async (req, res) => {
    try {
      const { filePath, oldClass, newClass, variantContext } = req.body as {
        filePath: string; // relative path to component file
        oldClass: string; // e.g. "rounded-md"
        newClass: string; // e.g. "rounded-lg"
        variantContext?: string; // e.g. "default" or "destructive" — narrows the search
      };

      const fullPath = safePath(projectRoot, filePath);
      let source = await fs.readFile(fullPath, "utf-8");

      source = replaceClassInComponent(source, oldClass, newClass, variantContext);

      await fs.writeFile(fullPath, source, "utf-8");

      res.json({ ok: true, filePath, oldClass, newClass });
    } catch (err: any) {
      console.error("Component write error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

function replaceClassInComponent(
  source: string,
  oldClass: string,
  newClass: string,
  variantContext?: string
): string {
  if (variantContext) {
    const variantIndex = source.indexOf(`${variantContext}:`);
    if (variantIndex === -1) {
      const quotedIndex = source.indexOf(`"${variantContext}":`);
      if (quotedIndex === -1) {
        throw new Error(`Variant context "${variantContext}" not found`);
      }
    }
  }

  const oldClassEscaped = oldClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const classRegex = new RegExp(
    `(["'\`][^"'\`]*?)\\b${oldClassEscaped}\\b([^"'\`]*?["'\`])`,
    "g"
  );

  let replaced = false;

  if (variantContext) {
    const variantPattern = new RegExp(
      `(${variantContext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"\\s]*:[\\s]*)(["'\`])([^"'\`]*?)\\b${oldClassEscaped}\\b([^"'\`]*?)(\\2)`,
      "g"
    );

    if (variantPattern.test(source)) {
      source = source.replace(
        variantPattern,
        `$1$2$3${newClass}$4$5`
      );
      replaced = true;
    }

    if (!replaced) {
      const quotedVariantPattern = new RegExp(
        `(["']${variantContext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']\\s*:\\s*)(["'\`])([^"'\`]*?)\\b${oldClassEscaped}\\b([^"'\`]*?)(\\2)`,
        "g"
      );
      if (quotedVariantPattern.test(source)) {
        source = source.replace(
          quotedVariantPattern,
          `$1$2$3${newClass}$4$5`
        );
        replaced = true;
      }
    }
  }

  if (!replaced) {
    const count = (source.match(classRegex) || []).length;
    if (count === 0) {
      throw new Error(
        `Class "${oldClass}" not found in component file`
      );
    }
    if (count > 1 && !variantContext) {
      // Class appears multiple times — try to target the cva() base string.
      // The base string is the first argument to cva(), before the variants object.
      const cvaResult = replaceInCvaBase(source, oldClass, newClass);
      if (cvaResult !== false) {
        return cvaResult;
      }
      // If not in a cva base, replace only the first occurrence
      source = source.replace(classRegex, `$1${newClass}$2`);
    } else {
      source = source.replace(classRegex, `$1${newClass}$2`);
    }
  }

  return source;
}

/**
 * Replace a class specifically within the cva() base string (first argument).
 * Returns the modified source or false if not found.
 */
function replaceInCvaBase(
  source: string,
  oldClass: string,
  newClass: string,
): string | false {
  // Find cva( and extract the first string argument (the base classes)
  const cvaIndex = source.indexOf("cva(");
  if (cvaIndex === -1) return false;

  // Find the opening quote of the first argument
  const afterCva = source.substring(cvaIndex + 4);
  const quoteMatch = afterCva.match(/^\s*(["'`])/);
  if (!quoteMatch) return false;

  const quote = quoteMatch[1];
  const quoteStart = cvaIndex + 4 + quoteMatch[0].length - 1; // position of opening quote

  // Find the closing quote (handle simple case — no escapes in class strings)
  const afterQuote = source.substring(quoteStart + 1);
  const closeIndex = afterQuote.indexOf(quote);
  if (closeIndex === -1) return false;

  const baseString = source.substring(quoteStart + 1, quoteStart + 1 + closeIndex);

  // Replace the class in the base string
  const oldClassEscaped = oldClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?<=^|\\s)${oldClassEscaped}(?=$|\\s)`, "g");
  if (!regex.test(baseString)) return false;

  const newBaseString = baseString.replace(
    new RegExp(`(?<=^|\\s)${oldClassEscaped}(?=$|\\s)`, "g"),
    newClass,
  );

  return (
    source.substring(0, quoteStart + 1) +
    newBaseString +
    source.substring(quoteStart + 1 + closeIndex)
  );
}
