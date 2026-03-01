import { Router } from "express";
import fs from "fs/promises";
import { safePath } from "../lib/safe-path.js";
import { rescanTokens } from "../lib/scanner.js";

export function createTokensRouter(projectRoot: string) {
  const router = Router();

  router.post("/", async (req, res) => {
    try {
      const { filePath, token, value, selector } = req.body as {
        filePath: string; // relative path to CSS file
        token: string; // e.g. "--primary"
        value: string; // e.g. "oklch(55% 0.15 250)"
        selector: string; // ":root" or ".dark"
      };

      const fullPath = safePath(projectRoot, filePath);
      let css = await fs.readFile(fullPath, "utf-8");

      // Find the correct selector block and replace the token value
      css = replaceTokenInBlock(css, selector, token, value);

      await fs.writeFile(fullPath, css, "utf-8");

      // Targeted rescan: only re-scan tokens
      const tokens = await rescanTokens(projectRoot);

      res.json({ ok: true, filePath, token, value, tokens });
    } catch (err: any) {
      console.error("Token write error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

function replaceTokenInBlock(
  css: string,
  selector: string,
  token: string,
  newValue: string
): string {
  const selectorEscaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockStart = css.search(new RegExp(`${selectorEscaped}\\s*\\{`));
  if (blockStart === -1) {
    throw new Error(`Selector "${selector}" not found in CSS file`);
  }

  const openBrace = css.indexOf("{", blockStart);
  let depth = 1;
  let pos = openBrace + 1;
  while (depth > 0 && pos < css.length) {
    if (css[pos] === "{") depth++;
    if (css[pos] === "}") depth--;
    pos++;
  }
  const blockEnd = pos;

  let block = css.slice(openBrace + 1, blockEnd - 1);

  const tokenEscaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenRegex = new RegExp(
    `(${tokenEscaped}\\s*:\\s*)([^;]+)(;)`,
    "g"
  );

  if (!tokenRegex.test(block)) {
    // Token doesn't exist in this block (e.g. dark mode override not yet defined).
    // Append it to the block so dark mode can override the light value.
    const indent = block.match(/\n(\s+)--/)?.[1] ?? "  ";
    block = block.trimEnd() + `\n${indent}${token}: ${newValue};\n`;
    return css.slice(0, openBrace + 1) + block + css.slice(blockEnd - 1);
  }

  block = block.replace(tokenRegex, `$1${newValue}$3`);

  return css.slice(0, openBrace + 1) + block + css.slice(blockEnd - 1);
}
