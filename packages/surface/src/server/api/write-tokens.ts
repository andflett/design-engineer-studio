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
        selector: string; // ":root", ".dark", or "@theme"
      };

      const fullPath = safePath(projectRoot, filePath);
      let css = await fs.readFile(fullPath, "utf-8");

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

/** Extract a top-level selector block from CSS, returning its open/close positions. */
function findBlock(
  css: string,
  selectorPattern: RegExp
): { openBrace: number; blockEnd: number } | null {
  const blockStart = css.search(selectorPattern);
  if (blockStart === -1) return null;

  const openBrace = css.indexOf("{", blockStart);
  let depth = 1;
  let pos = openBrace + 1;
  while (depth > 0 && pos < css.length) {
    if (css[pos] === "{") depth++;
    if (css[pos] === "}") depth--;
    pos++;
  }
  return { openBrace, blockEnd: pos };
}

/** Check whether a CSS block (inner text between braces) contains a given custom property. */
function blockContainsToken(block: string, token: string): boolean {
  const tokenEscaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Use a non-word-char lookbehind so "--primary" doesn't match inside "--color-primary"
  return new RegExp(`(?<![\\w-])${tokenEscaped}\\s*:`).test(block);
}

/** Replace (or append) a token value inside a CSS block in the source string. */
function writeTokenIntoBlock(
  css: string,
  openBrace: number,
  blockEnd: number,
  token: string,
  newValue: string
): string {
  let block = css.slice(openBrace + 1, blockEnd - 1);

  const tokenEscaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenRegex = new RegExp(`(${tokenEscaped}\\s*:\\s*)([^;]+)(;)`, "g");

  if (!tokenRegex.test(block)) {
    // Token not in block yet — append it (e.g. adding a dark-mode override)
    const indent = block.match(/\n(\s+)--/)?.[1] ?? "  ";
    block = block.trimEnd() + `\n${indent}${token}: ${newValue};\n`;
  } else {
    block = block.replace(tokenRegex, `$1${newValue}$3`);
  }

  return css.slice(0, openBrace + 1) + block + css.slice(blockEnd - 1);
}

function replaceTokenInBlock(
  css: string,
  selector: string,
  token: string,
  newValue: string
): string {
  const selectorEscaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hinted = findBlock(css, new RegExp(`${selectorEscaped}[^{]*\\{`));

  // If the hinted selector block exists and contains the token, write there.
  if (hinted) {
    const block = css.slice(hinted.openBrace + 1, hinted.blockEnd - 1);
    if (blockContainsToken(block, token)) {
      return writeTokenIntoBlock(css, hinted.openBrace, hinted.blockEnd, token, newValue);
    }
  }

  // The token is not in the hinted block (e.g. tailwind-v4 project where semantic
  // tokens live in :root instead of @theme). Search common selectors for a block
  // that actually contains this token.
  const fallbackSelectors = [":root", ".dark", "@theme"];
  for (const fb of fallbackSelectors) {
    if (fb === selector) continue;
    const fbEscaped = fb.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const found = findBlock(css, new RegExp(`${fbEscaped}[^{]*\\{`));
    if (!found) continue;
    const block = css.slice(found.openBrace + 1, found.blockEnd - 1);
    if (blockContainsToken(block, token)) {
      return writeTokenIntoBlock(css, found.openBrace, found.blockEnd, token, newValue);
    }
  }

  // Token not found anywhere — append to the hinted selector block (or throw if
  // the selector itself doesn't exist).
  if (!hinted) {
    throw new Error(`Selector "${selector}" not found in CSS file`);
  }
  return writeTokenIntoBlock(css, hinted.openBrace, hinted.blockEnd, token, newValue);
}
