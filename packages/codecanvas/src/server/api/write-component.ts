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
      throw new Error(
        `Class "${oldClass}" found ${count} times. Provide variantContext to narrow.`
      );
    }
    source = source.replace(classRegex, `$1${newClass}$2`);
  }

  return source;
}
