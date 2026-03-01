import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { rescanGradients, rescanBorders } from "../lib/scanner.js";

function safePath(projectRoot: string, filePath: string): string {
  const resolved = path.resolve(projectRoot, filePath);
  if (!resolved.startsWith(projectRoot)) {
    throw new Error(`Path "${filePath}" escapes project root`);
  }
  return resolved;
}

export function createGradientsRouter(projectRoot: string) {
  const router = Router();

  // Create or update a gradient CSS variable
  router.post("/", async (req, res) => {
    try {
      const { filePath, variableName, value, selector } = req.body as {
        filePath: string;
        variableName: string;
        value: string;
        selector: string; // ":root" or "@theme"
      };

      const fullPath = safePath(projectRoot, filePath);
      let css = await fs.readFile(fullPath, "utf-8");

      if (selector === "@theme") {
        css = writeToTheme(css, variableName, value);
      } else {
        css = writeToSelector(css, selector, variableName, value);
      }

      await fs.writeFile(fullPath, css, "utf-8");
      const [gradients, borders] = await Promise.all([
        rescanGradients(projectRoot),
        rescanBorders(projectRoot),
      ]);
      res.json({ ok: true, filePath, variableName, value, gradients, borders });
    } catch (err: any) {
      console.error("Gradient write error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Create a new gradient variable
  router.post("/create", async (req, res) => {
    try {
      const { filePath, variableName, value, selector } = req.body as {
        filePath: string;
        variableName: string;
        value: string;
        selector: string;
      };

      const fullPath = safePath(projectRoot, filePath);
      let css = await fs.readFile(fullPath, "utf-8");

      if (selector === "@theme") {
        css = addToTheme(css, variableName, value);
      } else {
        css = addToSelector(css, selector, variableName, value);
      }

      await fs.writeFile(fullPath, css, "utf-8");
      const [gradients, borders] = await Promise.all([
        rescanGradients(projectRoot),
        rescanBorders(projectRoot),
      ]);
      res.json({ ok: true, filePath, variableName, value, gradients, borders });
    } catch (err: any) {
      console.error("Gradient create error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Delete a gradient variable
  router.post("/delete", async (req, res) => {
    try {
      const { filePath, variableName, selector } = req.body as {
        filePath: string;
        variableName: string;
        selector: string;
      };

      const fullPath = safePath(projectRoot, filePath);
      let css = await fs.readFile(fullPath, "utf-8");

      css = deleteFromBlock(css, selector, variableName);

      await fs.writeFile(fullPath, css, "utf-8");
      const [gradients, borders] = await Promise.all([
        rescanGradients(projectRoot),
        rescanBorders(projectRoot),
      ]);
      res.json({ ok: true, filePath, variableName, gradients, borders });
    } catch (err: any) {
      console.error("Gradient delete error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

function writeToSelector(
  css: string,
  selector: string,
  variableName: string,
  newValue: string
): string {
  const selectorEscaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockStart = css.search(new RegExp(`${selectorEscaped}\\s*\\{`));
  if (blockStart === -1) {
    // Doesn't exist yet — create with variable
    return css + `\n${selector} {\n  ${variableName}: ${newValue};\n}\n`;
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
    // Variable doesn't exist — add it
    block = block.trimEnd() + `\n  ${variableName}: ${newValue};\n`;
  }

  return css.slice(0, openBrace + 1) + block + css.slice(blockEnd - 1);
}

function writeToTheme(
  css: string,
  variableName: string,
  newValue: string
): string {
  const themeMatch = css.match(/@theme\s*(?:inline\s*)?\{/);
  if (!themeMatch) {
    return css + `\n@theme {\n  ${variableName}: ${newValue};\n}\n`;
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
    block = block.trimEnd() + `\n  ${variableName}: ${newValue};\n`;
  }

  return css.slice(0, openBrace + 1) + block + css.slice(blockEnd - 1);
}

function addToTheme(
  css: string,
  variableName: string,
  value: string
): string {
  return writeToTheme(css, variableName, value);
}

function addToSelector(
  css: string,
  selector: string,
  variableName: string,
  value: string
): string {
  return writeToSelector(css, selector, variableName, value);
}

function deleteFromBlock(
  css: string,
  selector: string,
  variableName: string
): string {
  let blockRegex: RegExp;
  if (selector === "@theme") {
    blockRegex = /@theme\s*(?:inline\s*)?\{/;
  } else {
    const selectorEscaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    blockRegex = new RegExp(`${selectorEscaped}\\s*\\{`);
  }

  const match = css.match(blockRegex);
  if (!match) return css;

  const blockStart = match.index!;
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
  // Remove the entire line containing the variable
  block = block.replace(new RegExp(`\\n?\\s*${varEscaped}\\s*:[^;]+;`, "g"), "");

  return css.slice(0, openBrace + 1) + block + css.slice(blockEnd - 1);
}
