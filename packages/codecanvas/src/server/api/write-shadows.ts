import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import {
  updateDesignTokenShadow,
  buildDesignTokensJson,
  writeDesignTokensFile,
} from "../lib/presets/w3c-design-tokens.js";

/** Resolve and validate a file path is within the project root. */
function safePath(projectRoot: string, filePath: string): string {
  const resolved = path.resolve(projectRoot, filePath);
  if (!resolved.startsWith(projectRoot)) {
    throw new Error(`Path "${filePath}" escapes project root`);
  }
  return resolved;
}

export function createShadowsRouter(projectRoot: string) {
  const router = Router();

  // Write a shadow value to a CSS custom property
  router.post("/", async (req, res) => {
    try {
      const { filePath, variableName, value, selector } = req.body as {
        filePath: string;
        variableName: string;   // e.g. "--shadow-md" or "--bs-box-shadow-sm"
        value: string;          // e.g. "0 4px 6px -1px rgb(0 0 0 / 0.1)"
        selector: string;       // ":root", "@theme", or "scss"
      };

      const fullPath = safePath(projectRoot, filePath);

      if (selector === "scss") {
        // Write to a Sass file
        let scss = await fs.readFile(fullPath, "utf-8");
        scss = writeShadowToScss(scss, variableName, value);
        await fs.writeFile(fullPath, scss, "utf-8");
      } else if (selector === "@theme") {
        let css = await fs.readFile(fullPath, "utf-8");
        css = writeShadowToTheme(css, variableName, value);
        await fs.writeFile(fullPath, css, "utf-8");
      } else {
        let css = await fs.readFile(fullPath, "utf-8");
        css = writeShadowToSelector(css, selector, variableName, value);
        await fs.writeFile(fullPath, css, "utf-8");
      }

      res.json({ ok: true, filePath, variableName, value });
    } catch (err: any) {
      console.error("Shadow write error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Create a new shadow variable (for presets that don't exist yet)
  router.post("/create", async (req, res) => {
    try {
      const { filePath, variableName, value, selector } = req.body as {
        filePath: string;
        variableName: string;
        value: string;
        selector: string;       // ":root", "@theme", or "scss"
      };

      const fullPath = safePath(projectRoot, filePath);

      if (selector === "scss") {
        let scss: string;
        try {
          scss = await fs.readFile(fullPath, "utf-8");
        } catch {
          scss = "";
        }
        scss = addShadowToScss(scss, variableName, value);
        await fs.writeFile(fullPath, scss, "utf-8");
      } else if (selector === "@theme") {
        let css = await fs.readFile(fullPath, "utf-8");
        css = addShadowToTheme(css, variableName, value);
        await fs.writeFile(fullPath, css, "utf-8");
      } else {
        let css = await fs.readFile(fullPath, "utf-8");
        css = addShadowToSelector(css, selector, variableName, value);
        await fs.writeFile(fullPath, css, "utf-8");
      }

      res.json({ ok: true, filePath, variableName, value });
    } catch (err: any) {
      console.error("Shadow create error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Write a shadow to a W3C Design Token file
  router.post("/design-token", async (req, res) => {
    try {
      const { filePath, tokenPath, value } = req.body as {
        filePath: string;   // e.g. "tokens/shadows.tokens.json"
        tokenPath: string;  // e.g. "shadow-md" or "elevation.shadow-md"
        value: string;      // CSS box-shadow string
      };

      const fullPath = safePath(projectRoot, filePath);
      await updateDesignTokenShadow(fullPath, tokenPath, value);

      res.json({ ok: true, filePath, tokenPath, value });
    } catch (err: any) {
      console.error("Design token write error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Export all shadows as a W3C Design Tokens file
  router.post("/export-tokens", async (req, res) => {
    try {
      const { filePath, shadows } = req.body as {
        filePath: string;
        shadows: Array<{ name: string; value: string; description?: string }>;
      };

      const fullPath = safePath(projectRoot, filePath);
      const tokens = buildDesignTokensJson(shadows);

      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await writeDesignTokensFile(fullPath, tokens);

      res.json({ ok: true, filePath, tokenCount: shadows.length });
    } catch (err: any) {
      console.error("Token export error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

// --- CSS selector-based writes ---

function writeShadowToSelector(
  css: string,
  selector: string,
  variableName: string,
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

  const varEscaped = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenRegex = new RegExp(`(${varEscaped}\\s*:\\s*)([^;]+)(;)`, "g");
  const original = block;
  block = block.replace(tokenRegex, `$1${newValue}$3`);

  if (block === original) {
    throw new Error(`Variable "${variableName}" not found in "${selector}" block`);
  }
  return css.slice(0, openBrace + 1) + block + css.slice(blockEnd - 1);
}

function writeShadowToTheme(
  css: string,
  variableName: string,
  newValue: string
): string {
  const themeMatch = css.match(/@theme\s*(?:inline\s*)?\{/);
  if (!themeMatch) {
    throw new Error("No @theme block found in CSS file");
  }

  const blockStart = themeMatch.index!;
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

  const varEscaped = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenRegex = new RegExp(`(${varEscaped}\\s*:\\s*)([^;]+)(;)`, "g");
  const original = block;
  block = block.replace(tokenRegex, `$1${newValue}$3`);

  if (block === original) {
    // Variable doesn't exist in @theme -- add it
    block = block.trimEnd() + `\n  ${variableName}: ${newValue};\n`;
  }

  return css.slice(0, openBrace + 1) + block + css.slice(blockEnd - 1);
}

function addShadowToSelector(
  css: string,
  selector: string,
  variableName: string,
  value: string
): string {
  const selectorEscaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockStart = css.search(new RegExp(`${selectorEscaped}\\s*\\{`));

  if (blockStart === -1) {
    // Selector block doesn't exist -- create it
    return css + `\n${selector} {\n  ${variableName}: ${value};\n}\n`;
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

  const block = css.slice(openBrace + 1, blockEnd - 1);
  const newBlock = block.trimEnd() + `\n  ${variableName}: ${value};\n`;

  return css.slice(0, openBrace + 1) + newBlock + css.slice(blockEnd - 1);
}

function addShadowToTheme(
  css: string,
  variableName: string,
  value: string
): string {
  const themeMatch = css.match(/@theme\s*(?:inline\s*)?\{/);
  if (!themeMatch) {
    // Create @theme block
    return css + `\n@theme {\n  ${variableName}: ${value};\n}\n`;
  }

  return writeShadowToTheme(css, variableName, value);
}

// --- Sass/SCSS writes ---

function writeShadowToScss(
  scss: string,
  variableName: string,
  newValue: string
): string {
  const varEscaped = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `(${varEscaped}\\s*:\\s*)(.+?)(\\s*(?:!default)?\\s*;)`,
    "g"
  );
  const result = scss.replace(regex, `$1${newValue}$3`);

  if (result === scss) {
    throw new Error(`Sass variable "${variableName}" not found in SCSS file`);
  }

  return result;
}

function addShadowToScss(
  scss: string,
  variableName: string,
  value: string
): string {
  const line = `${variableName}: ${value};\n`;
  return scss.endsWith("\n") ? scss + line : scss + "\n" + line;
}
