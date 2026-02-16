import { Router } from "express";
import fs from "fs/promises";
import path from "path";

export function createElementRouter(projectRoot: string) {
  const router = Router();

  router.post("/", async (req, res) => {
    try {
      const body = req.body as ElementWriteRequest;
      const fullPath = path.join(projectRoot, body.filePath);
      let source = await fs.readFile(fullPath, "utf-8");

      if (body.type === "class") {
        source = replaceClassInElement(
          source,
          body.classIdentifier,
          body.oldClass,
          body.newClass,
          body.lineHint
        );
      } else if (body.type === "prop") {
        source = replacePropInElement(
          source,
          body.componentName,
          body.propName,
          body.propValue,
          body.lineHint,
          body.textHint
        );
      } else if (body.type === "addClass") {
        source = addClassToElement(
          source,
          body.classIdentifier,
          body.newClass,
          body.lineHint
        );
      }

      await fs.writeFile(fullPath, source, "utf-8");
      res.json({ ok: true });
    } catch (err: any) {
      console.error("Element write error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

type ElementWriteRequest =
  | {
      type: "class";
      filePath: string;
      classIdentifier: string; // unique substring of the className to find the element
      oldClass: string;
      newClass: string;
      lineHint?: number;
    }
  | {
      type: "prop";
      filePath: string;
      componentName: string;
      propName: string;
      propValue: string;
      lineHint?: number;
      textHint?: string; // text content to disambiguate which instance
    }
  | {
      type: "addClass";
      filePath: string;
      classIdentifier: string;
      newClass: string;
      lineHint?: number;
    };

function replaceClassInElement(
  source: string,
  classIdentifier: string,
  oldClass: string,
  newClass: string,
  lineHint?: number
): string {
  const lines = source.split("\n");

  // If we have a line hint, search near that line first
  const searchStart = lineHint ? Math.max(0, lineHint - 5) : 0;
  const searchEnd = lineHint ? Math.min(lines.length, lineHint + 5) : lines.length;

  // Find the line containing the class identifier
  let targetLineIdx = -1;
  for (let i = searchStart; i < searchEnd; i++) {
    if (lines[i].includes(classIdentifier)) {
      targetLineIdx = i;
      break;
    }
  }

  // Fallback: search entire file
  if (targetLineIdx === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(classIdentifier)) {
        targetLineIdx = i;
        break;
      }
    }
  }

  if (targetLineIdx === -1) {
    throw new Error(
      `Could not find element with class identifier "${classIdentifier}"`
    );
  }

  // Replace the old class with the new class on that line (and nearby lines for multi-line classNames)
  const oldEscaped = oldClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${oldEscaped}\\b`, "g");

  // Check this line and a few lines around it
  for (let i = Math.max(0, targetLineIdx - 2); i <= Math.min(lines.length - 1, targetLineIdx + 2); i++) {
    if (regex.test(lines[i])) {
      lines[i] = lines[i].replace(regex, newClass);
      return lines.join("\n");
    }
  }

  throw new Error(`Class "${oldClass}" not found near the identified element`);
}

function replacePropInElement(
  source: string,
  componentName: string,
  propName: string,
  propValue: string,
  lineHint?: number,
  textHint?: string
): string {
  const lines = source.split("\n");

  // Find ALL instances of this component
  const candidateLines: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`<${componentName}`)) {
      candidateLines.push(i);
    }
  }

  if (candidateLines.length === 0) {
    throw new Error(`Component <${componentName}> not found`);
  }

  // Pick the best match using textHint for disambiguation
  let componentLineIdx = candidateLines[0];
  if (textHint && candidateLines.length > 1) {
    for (const lineIdx of candidateLines) {
      // Look at this line and nearby lines for the text content
      const nearby = lines.slice(lineIdx, Math.min(lineIdx + 3, lines.length)).join(" ");
      if (nearby.includes(textHint)) {
        componentLineIdx = lineIdx;
        break;
      }
    }
  }
  if (lineHint && candidateLines.length > 1) {
    // Prefer the candidate closest to the line hint
    let closest = candidateLines[0];
    for (const c of candidateLines) {
      if (Math.abs(c - lineHint) < Math.abs(closest - lineHint)) closest = c;
    }
    componentLineIdx = closest;
  }

  // Find the closing > of this component (might span multiple lines)
  let tagEnd = componentLineIdx;
  let depth = 0;
  for (let i = componentLineIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "<") depth++;
      if (ch === ">") {
        depth--;
        if (depth <= 0) {
          tagEnd = i;
          break;
        }
      }
    }
    if (depth <= 0) break;
  }

  // Look for existing prop in the tag range
  const propRegex = new RegExp(`${propName}=["']([^"']*)["']`);
  for (let i = componentLineIdx; i <= tagEnd; i++) {
    if (propRegex.test(lines[i])) {
      lines[i] = lines[i].replace(propRegex, `${propName}="${propValue}"`);
      return lines.join("\n");
    }
  }

  // Prop doesn't exist yet — add it after the component name
  const componentTag = lines[componentLineIdx];
  const insertPos = componentTag.indexOf(`<${componentName}`) + `<${componentName}`.length;
  lines[componentLineIdx] =
    componentTag.slice(0, insertPos) +
    ` ${propName}="${propValue}"` +
    componentTag.slice(insertPos);

  return lines.join("\n");
}

function addClassToElement(
  source: string,
  classIdentifier: string,
  newClass: string,
  lineHint?: number
): string {
  const lines = source.split("\n");
  const searchStart = lineHint ? Math.max(0, lineHint - 5) : 0;
  const searchEnd = lineHint ? Math.min(lines.length, lineHint + 5) : lines.length;

  let targetLineIdx = -1;
  for (let i = searchStart; i < searchEnd; i++) {
    if (lines[i].includes(classIdentifier)) {
      targetLineIdx = i;
      break;
    }
  }

  if (targetLineIdx === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(classIdentifier)) {
        targetLineIdx = i;
        break;
      }
    }
  }

  if (targetLineIdx === -1) {
    throw new Error(`Could not find element with class identifier "${classIdentifier}"`);
  }

  // Find the className string on or near this line and append the new class
  const classNameRegex = /className="([^"]*)"/;
  for (let i = Math.max(0, targetLineIdx - 2); i <= Math.min(lines.length - 1, targetLineIdx + 2); i++) {
    const match = lines[i].match(classNameRegex);
    if (match) {
      const existingClasses = match[1];
      lines[i] = lines[i].replace(
        `className="${existingClasses}"`,
        `className="${existingClasses} ${newClass}"`
      );
      return lines.join("\n");
    }
  }

  throw new Error(`Could not find className near the identified element`);
}
