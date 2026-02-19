import { Router } from "express";
import fs from "fs/promises";
import crypto from "crypto";
import { safePath } from "@designtools/core/server";

export function createElementRouter(projectRoot: string) {
  const router = Router();

  router.post("/", async (req, res) => {
    try {
      const body = req.body as ElementWriteRequest;
      const fullPath = safePath(projectRoot, body.filePath);
      let source = await fs.readFile(fullPath, "utf-8");

      if (body.type === "class") {
        const result = replaceClassInElement(source, {
          eid: body.eid,
          classIdentifier: body.classIdentifier,
          oldClass: body.oldClass,
          newClass: body.newClass,
          tag: body.tag,
          textHint: body.textHint,
          lineHint: body.lineHint,
        });
        source = result.source;
        await fs.writeFile(fullPath, source, "utf-8");
        res.json({ ok: true, eid: result.eid });
      } else if (body.type === "prop") {
        source = replacePropInElement(
          source,
          body.componentName,
          body.propName,
          body.propValue,
          body.lineHint,
          body.textHint
        );
        await fs.writeFile(fullPath, source, "utf-8");
        res.json({ ok: true });
      } else if (body.type === "addClass") {
        const result = addClassToElement(source, {
          eid: body.eid,
          classIdentifier: body.classIdentifier,
          newClass: body.newClass,
          tag: body.tag,
          textHint: body.textHint,
          lineHint: body.lineHint,
        });
        source = result.source;
        await fs.writeFile(fullPath, source, "utf-8");
        res.json({ ok: true, eid: result.eid });
      } else if (body.type === "instanceOverride") {
        const result = overrideClassOnInstance(source, {
          eid: body.eid,
          componentName: body.componentName,
          oldClass: body.oldClass,
          newClass: body.newClass,
          textHint: body.textHint,
          lineHint: body.lineHint,
        });
        source = result.source;
        await fs.writeFile(fullPath, source, "utf-8");
        res.json({ ok: true, eid: result.eid });
      } else if (body.type === "removeMarker") {
        source = removeMarker(source, body.eid);
        await fs.writeFile(fullPath, source, "utf-8");
        res.json({ ok: true });
      }
    } catch (err: any) {
      console.error("Element write error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

/** Remove all data-studio-eid attributes from source files at startup. */
export async function cleanupStaleMarkers(projectRoot: string) {
  const ignore = new Set(["node_modules", ".next", "dist", ".git"]);
  const exts = new Set([".tsx", ".jsx", ".html"]);

  async function walk(dir: string) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignore.has(entry.name)) continue;
      const full = dir + "/" + entry.name;
      if (entry.isDirectory()) {
        await walk(full);
      } else if (exts.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
        const content = await fs.readFile(full, "utf-8");
        if (content.includes("data-studio-eid=")) {
          const cleaned = content.replace(/ data-studio-eid="[^"]*"/g, "");
          await fs.writeFile(full, cleaned, "utf-8");
        }
      }
    }
  }

  await walk(projectRoot);
}

type ElementWriteRequest =
  | {
      type: "class";
      filePath: string;
      eid?: string;
      classIdentifier: string;
      oldClass: string;
      newClass: string;
      tag?: string;
      textHint?: string;
      lineHint?: number;
    }
  | {
      type: "prop";
      filePath: string;
      componentName: string;
      propName: string;
      propValue: string;
      lineHint?: number;
      textHint?: string;
    }
  | {
      type: "addClass";
      filePath: string;
      eid?: string;
      classIdentifier: string;
      newClass: string;
      tag?: string;
      textHint?: string;
      lineHint?: number;
    }
  | {
      type: "instanceOverride";
      filePath: string;
      eid?: string;
      componentName: string;
      oldClass: string;
      newClass: string;
      textHint?: string;
      lineHint?: number;
    }
  | {
      type: "removeMarker";
      filePath: string;
      eid: string;
    };

// --- Marker helpers ---

function generateEid(): string {
  return "s" + crypto.randomBytes(4).toString("hex");
}

function removeMarker(source: string, eid: string): string {
  return source.replace(
    new RegExp(` data-studio-eid="${eid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`, "g"),
    ""
  );
}

/** Find the opening tag for an element near the given line index and insert a marker. */
function insertMarkerNearLine(lines: string[], nearIdx: number, eid: string): void {
  // Scan upward from nearIdx to find the opening `<tag` or self-closing tag
  for (let i = nearIdx; i >= Math.max(0, nearIdx - 10); i--) {
    // Match opening JSX tags like <div, <Button, <section etc.
    const tagMatch = lines[i].match(/<([A-Za-z][A-Za-z0-9.]*)/);
    if (tagMatch) {
      // Insert after the tag name
      const tagPos = lines[i].indexOf(tagMatch[0]) + tagMatch[0].length;
      lines[i] =
        lines[i].slice(0, tagPos) +
        ` data-studio-eid="${eid}"` +
        lines[i].slice(tagPos);
      return;
    }
  }
}

// --- Element finding ---

/**
 * Find the line containing the target element by marker (eid) or by scoring candidates.
 * Returns the line index where oldClass can be found, or -1.
 */
function findElementLine(
  lines: string[],
  opts: {
    eid?: string;
    classIdentifier: string;
    oldClass: string;
    tag?: string;
    textHint?: string;
    lineHint?: number;
  }
): number {
  // Strategy 1: Use existing marker
  if (opts.eid) {
    const markerStr = `data-studio-eid="${opts.eid}"`;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(markerStr)) {
        // Found the marker — now find oldClass nearby
        const oldEscaped = opts.oldClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${oldEscaped}\\b`);
        for (let j = Math.max(0, i - 5); j <= Math.min(lines.length - 1, i + 10); j++) {
          if (regex.test(lines[j])) return j;
        }
        return i; // Return marker line even if oldClass not found nearby
      }
    }
  }

  // Strategy 2: Find by oldClass + scoring
  const oldEscaped = opts.oldClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const oldClassRegex = new RegExp(`\\b${oldEscaped}\\b`);

  const candidates: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (oldClassRegex.test(lines[i])) {
      candidates.push(i);
    }
  }

  if (candidates.length === 0) return -1;
  if (candidates.length === 1) return candidates[0];

  // Score each candidate
  const identifierClasses = opts.classIdentifier.split(/\s+/).filter(Boolean);

  let bestIdx = -1;
  let bestScore = -Infinity;

  for (const cIdx of candidates) {
    let score = 0;

    // Check nearby lines (±5) for identifier classes
    const nearbyText = lines
      .slice(Math.max(0, cIdx - 5), Math.min(lines.length, cIdx + 6))
      .join(" ");

    let classMatches = 0;
    for (const cls of identifierClasses) {
      const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b`).test(nearbyText)) {
        classMatches++;
        score += 2;
      }
    }

    // Tag match — check both exact tag and capitalized component name
    if (opts.tag) {
      const lcTag = `<${opts.tag}`;
      const ucTag = `<${opts.tag.charAt(0).toUpperCase()}${opts.tag.slice(1)}`;
      if (nearbyText.includes(lcTag) || nearbyText.includes(ucTag)) {
        score += 5;
      }
    }

    // Text hint match
    if (opts.textHint) {
      const textNearby = lines
        .slice(Math.max(0, cIdx - 2), Math.min(lines.length, cIdx + 5))
        .join(" ");
      if (textNearby.includes(opts.textHint)) {
        score += 3;
      }
    }

    // Line hint proximity
    if (opts.lineHint !== undefined) {
      const distance = Math.abs(cIdx - opts.lineHint);
      score += Math.max(0, 10 - distance);
    }

    // Require at least 3 identifier classes to match (or 30% of total),
    // whichever is smaller, to avoid matching unrelated elements
    const minRequired = Math.min(3, Math.ceil(identifierClasses.length * 0.3));
    if (classMatches < minRequired) {
      score = -1000; // Effectively disqualify
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = cIdx;
    }
  }

  return bestIdx;
}

// --- Core operations ---

function replaceClassInElement(
  source: string,
  opts: {
    eid?: string;
    classIdentifier: string;
    oldClass: string;
    newClass: string;
    tag?: string;
    textHint?: string;
    lineHint?: number;
  }
): { source: string; eid: string } {
  const lines = source.split("\n");

  const targetLineIdx = findElementLine(lines, opts);

  if (targetLineIdx === -1) {
    throw new Error(
      `Could not find element with class "${opts.oldClass}" in source`
    );
  }

  // Replace the old class
  const oldEscaped = opts.oldClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${oldEscaped}\\b`, "g");

  let replaced = false;
  for (let i = Math.max(0, targetLineIdx - 2); i <= Math.min(lines.length - 1, targetLineIdx + 2); i++) {
    if (regex.test(lines[i])) {
      regex.lastIndex = 0; // Reset after test()
      lines[i] = lines[i].replace(regex, opts.newClass);
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    throw new Error(`Class "${opts.oldClass}" not found near the identified element`);
  }

  // Insert marker if this is the first edit (no eid yet)
  let eid = opts.eid || "";
  if (!eid) {
    eid = generateEid();
    insertMarkerNearLine(lines, targetLineIdx, eid);
  }

  return { source: lines.join("\n"), eid };
}

function addClassToElement(
  source: string,
  opts: {
    eid?: string;
    classIdentifier: string;
    newClass: string;
    tag?: string;
    textHint?: string;
    lineHint?: number;
  }
): { source: string; eid: string } {
  const lines = source.split("\n");

  // For addClass, we need to find the className attribute rather than a specific old class.
  // Use the marker if available, otherwise fall back to classIdentifier matching.
  let targetLineIdx = -1;

  if (opts.eid) {
    const markerStr = `data-studio-eid="${opts.eid}"`;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(markerStr)) {
        targetLineIdx = i;
        break;
      }
    }
  }

  if (targetLineIdx === -1) {
    // Fall back to finding by individual classes from the identifier
    const identifierClasses = opts.classIdentifier.split(/\s+/).filter(Boolean);
    // Pick the most specific class (longest) to search for
    const anchor = identifierClasses.sort((a, b) => b.length - a.length)[0];
    if (anchor) {
      const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const anchorRegex = new RegExp(`\\b${escaped}\\b`);
      const candidates: number[] = [];
      for (let i = 0; i < lines.length; i++) {
        if (anchorRegex.test(lines[i])) candidates.push(i);
      }
      if (candidates.length === 1) {
        targetLineIdx = candidates[0];
      } else if (candidates.length > 1 && opts.lineHint !== undefined) {
        targetLineIdx = candidates.reduce((closest, c) =>
          Math.abs(c - opts.lineHint!) < Math.abs(closest - opts.lineHint!) ? c : closest
        );
      } else if (candidates.length > 0) {
        targetLineIdx = candidates[0];
      }
    }
  }

  if (targetLineIdx === -1) {
    throw new Error(`Could not find element with class identifier "${opts.classIdentifier}"`);
  }

  // Find the className string on or near this line and append the new class
  const classNameRegex = /className="([^"]*)"/;
  for (let i = Math.max(0, targetLineIdx - 3); i <= Math.min(lines.length - 1, targetLineIdx + 5); i++) {
    const match = lines[i].match(classNameRegex);
    if (match) {
      const existingClasses = match[1];
      lines[i] = lines[i].replace(
        `className="${existingClasses}"`,
        `className="${existingClasses} ${opts.newClass}"`
      );

      // Insert marker if needed
      let eid = opts.eid || "";
      if (!eid) {
        eid = generateEid();
        insertMarkerNearLine(lines, i, eid);
      }

      return { source: lines.join("\n"), eid };
    }
  }

  throw new Error(`Could not find className near the identified element`);
}

/**
 * Override a class on a specific component instance by modifying its className prop.
 * If the instance already has className="...", replace oldClass within it or append newClass.
 * If no className prop exists, add className="newClass" to the component tag.
 * This allows instance-level overrides that tailwind-merge will resolve over CVA base classes.
 */
function overrideClassOnInstance(
  source: string,
  opts: {
    eid?: string;
    componentName: string;
    oldClass: string;
    newClass: string;
    textHint?: string;
    lineHint?: number;
  }
): { source: string; eid: string } {
  const lines = source.split("\n");

  // Find the component instance
  let componentLineIdx = -1;

  // Strategy 1: Use existing marker
  if (opts.eid) {
    const markerStr = `data-studio-eid="${opts.eid}"`;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(markerStr)) {
        componentLineIdx = i;
        break;
      }
    }
  }

  // Strategy 2: Find by component name + hints
  if (componentLineIdx === -1) {
    const candidateLines: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`<${opts.componentName}`)) {
        candidateLines.push(i);
      }
    }

    if (candidateLines.length === 0) {
      throw new Error(`Component <${opts.componentName}> not found`);
    }

    if (candidateLines.length === 1) {
      componentLineIdx = candidateLines[0];
    } else {
      // Disambiguate using textHint and lineHint
      let bestIdx = candidateLines[0];
      let bestScore = -Infinity;

      for (const cIdx of candidateLines) {
        let score = 0;
        if (opts.textHint) {
          const nearby = lines.slice(cIdx, Math.min(cIdx + 5, lines.length)).join(" ");
          if (nearby.includes(opts.textHint)) score += 10;
        }
        if (opts.lineHint !== undefined) {
          score += Math.max(0, 20 - Math.abs(cIdx - opts.lineHint));
        }
        if (score > bestScore) {
          bestScore = score;
          bestIdx = cIdx;
        }
      }
      componentLineIdx = bestIdx;
    }
  }

  // Find the closing > of this component's opening tag
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

  // Check if className prop already exists on this instance
  const classNameRegex = /className="([^"]*)"/;
  let classNameFound = false;

  for (let i = componentLineIdx; i <= tagEnd; i++) {
    const match = lines[i].match(classNameRegex);
    if (match) {
      classNameFound = true;
      const existingClasses = match[1];
      // Check if oldClass is already in the className (from a prior override)
      const oldEscaped = opts.oldClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const oldRegex = new RegExp(`\\b${oldEscaped}\\b`);

      if (oldRegex.test(existingClasses)) {
        // Replace old override with new one
        const updated = existingClasses.replace(oldRegex, opts.newClass).replace(/\s+/g, " ").trim();
        lines[i] = lines[i].replace(
          `className="${existingClasses}"`,
          `className="${updated}"`
        );
      } else {
        // Append the new override class
        lines[i] = lines[i].replace(
          `className="${existingClasses}"`,
          `className="${existingClasses} ${opts.newClass}"`
        );
      }
      break;
    }
  }

  if (!classNameFound) {
    // No className prop — add one after the component name
    const componentTag = lines[componentLineIdx];
    const insertPos = componentTag.indexOf(`<${opts.componentName}`) + `<${opts.componentName}`.length;
    lines[componentLineIdx] =
      componentTag.slice(0, insertPos) +
      ` className="${opts.newClass}"` +
      componentTag.slice(insertPos);
  }

  // Insert marker if needed
  let eid = opts.eid || "";
  if (!eid) {
    eid = generateEid();
    insertMarkerNearLine(lines, componentLineIdx, eid);
  }

  return { source: lines.join("\n"), eid };
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
      const nearby = lines.slice(lineIdx, Math.min(lineIdx + 3, lines.length)).join(" ");
      if (nearby.includes(textHint)) {
        componentLineIdx = lineIdx;
        break;
      }
    }
  }
  if (lineHint && candidateLines.length > 1) {
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
