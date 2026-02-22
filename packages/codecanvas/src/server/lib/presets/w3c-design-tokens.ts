import fs from "fs/promises";
import path from "path";

/**
 * W3C Design Tokens Format (DTCG) shadow token support.
 *
 * Spec: https://www.designtokens.org/tr/drafts/format/
 * File extensions: .tokens, .tokens.json
 *
 * Shadow tokens use $type: "shadow" with a composite value:
 * {
 *   "shadow-md": {
 *     "$type": "shadow",
 *     "$value": {
 *       "offsetX": "0px",
 *       "offsetY": "4px",
 *       "blur": "8px",
 *       "spread": "0px",
 *       "color": "rgb(0, 0, 0, 0.15)"
 *     }
 *   }
 * }
 *
 * Layered shadows use an array of shadow objects:
 * {
 *   "shadow-lg": {
 *     "$type": "shadow",
 *     "$value": [
 *       { "offsetX": "0px", "offsetY": "4px", "blur": "6px", "spread": "-1px", "color": "..." },
 *       { "offsetX": "0px", "offsetY": "2px", "blur": "4px", "spread": "-2px", "color": "..." }
 *     ]
 *   }
 * }
 */

export interface W3CShadowValue {
  offsetX: string;
  offsetY: string;
  blur: string;
  spread: string;
  color: string;
}

export interface W3CShadowToken {
  /** Token name, dot-separated path for nested groups (e.g. "elevation.shadow-md") */
  name: string;
  /** The raw $value -- single object or array */
  value: W3CShadowValue | W3CShadowValue[];
  /** Converted to CSS box-shadow string */
  cssValue: string;
  /** Optional $description from the token */
  description?: string;
  /** The file this token was found in */
  filePath: string;
  /** The JSON path within the file (e.g. "elevation.shadow-md") */
  tokenPath: string;
}

/**
 * Find all W3C Design Token files in a project.
 * Looks for *.tokens and *.tokens.json files.
 */
export async function findDesignTokenFiles(projectRoot: string): Promise<string[]> {
  const candidates = [
    "tokens",
    "design-tokens",
    "src/tokens",
    "src/design-tokens",
    "styles/tokens",
    ".",
  ];

  const found: string[] = [];

  for (const dir of candidates) {
    try {
      const fullDir = path.join(projectRoot, dir);
      const entries = await fs.readdir(fullDir);
      for (const entry of entries) {
        if (entry.endsWith(".tokens.json") || entry.endsWith(".tokens")) {
          found.push(path.join(dir, entry));
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return found;
}

/**
 * Scan W3C Design Token files for shadow tokens.
 */
export async function scanDesignTokenShadows(
  projectRoot: string,
  tokenFiles?: string[]
): Promise<W3CShadowToken[]> {
  const files = tokenFiles || await findDesignTokenFiles(projectRoot);
  const tokens: W3CShadowToken[] = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(projectRoot, file), "utf-8");
      const parsed = JSON.parse(content);
      extractShadowTokens(parsed, [], file, tokens);
    } catch {
      // Invalid JSON or file not found
    }
  }

  return tokens;
}

/**
 * Recursively traverse a design token object tree and extract shadow tokens.
 */
function extractShadowTokens(
  obj: any,
  pathParts: string[],
  filePath: string,
  results: W3CShadowToken[]
): void {
  if (!obj || typeof obj !== "object") return;

  // Check if this node is a shadow token
  if (obj.$type === "shadow" && obj.$value !== undefined) {
    const tokenPath = pathParts.join(".");
    const name = pathParts[pathParts.length - 1] || tokenPath;

    results.push({
      name,
      value: obj.$value,
      cssValue: w3cShadowToCss(obj.$value),
      description: obj.$description,
      filePath,
      tokenPath,
    });
    return;
  }

  // Check if there's a group-level $type that applies to children
  const groupType = obj.$type;

  // Recurse into children
  for (const [key, child] of Object.entries(obj)) {
    if (key.startsWith("$")) continue; // Skip meta properties

    if (child && typeof child === "object") {
      // If this child has no $type but the group does, inherit it
      const childObj = child as any;
      if (groupType === "shadow" && childObj.$value !== undefined && !childObj.$type) {
        const tokenPath = [...pathParts, key].join(".");
        results.push({
          name: key,
          value: childObj.$value,
          cssValue: w3cShadowToCss(childObj.$value),
          description: childObj.$description,
          filePath,
          tokenPath,
        });
      } else {
        extractShadowTokens(childObj, [...pathParts, key], filePath, results);
      }
    }
  }
}

/**
 * Convert a W3C shadow value (single or array) to a CSS box-shadow string.
 */
export function w3cShadowToCss(value: W3CShadowValue | W3CShadowValue[]): string {
  if (Array.isArray(value)) {
    return value.map(singleW3cToCss).join(", ");
  }
  return singleW3cToCss(value);
}

function singleW3cToCss(v: W3CShadowValue): string {
  const parts = [
    v.offsetX || "0px",
    v.offsetY || "0px",
    v.blur || "0px",
    v.spread || "0px",
    v.color || "rgb(0, 0, 0, 0.1)",
  ];
  return parts.join(" ");
}

/**
 * Convert a CSS box-shadow string to W3C Design Token shadow value(s).
 * Used for export.
 */
export function cssToW3cShadow(cssValue: string): W3CShadowValue | W3CShadowValue[] {
  if (!cssValue || cssValue === "none") {
    return { offsetX: "0px", offsetY: "0px", blur: "0px", spread: "0px", color: "transparent" };
  }

  // Split by comma, respecting parentheses
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of cssValue) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());

  const shadows = parts.map(parseSingleCssToW3c).filter((s): s is W3CShadowValue => s !== null);

  if (shadows.length === 1) return shadows[0];
  return shadows;
}

function parseSingleCssToW3c(shadow: string): W3CShadowValue | null {
  const trimmed = shadow.trim();
  if (!trimmed) return null;

  // Remove inset prefix (W3C spec doesn't define inset in the shadow type)
  const withoutInset = trimmed.replace(/^inset\s+/, "");

  // Extract color at end
  let color = "rgb(0, 0, 0, 0.1)";
  let measurements = withoutInset;

  const colorPatterns = [
    /\s+((?:rgb|rgba|oklch|hsl|hsla)\([^)]+\))$/,
    /\s+(#[\da-fA-F]{3,8})$/,
    /\s+((?:black|white|transparent|currentColor))$/i,
  ];

  for (const pattern of colorPatterns) {
    const match = measurements.match(pattern);
    if (match) {
      color = match[1];
      measurements = measurements.slice(0, match.index).trim();
      break;
    }
  }

  const dims = measurements.split(/\s+/);
  if (dims.length < 2) return null;

  return {
    offsetX: dims[0] || "0px",
    offsetY: dims[1] || "0px",
    blur: dims[2] || "0px",
    spread: dims[3] || "0px",
    color,
  };
}

/**
 * Build a W3C Design Tokens JSON structure from a map of shadow names to CSS values.
 */
export function buildDesignTokensJson(
  shadows: Array<{ name: string; value: string; description?: string }>
): Record<string, any> {
  const tokens: Record<string, any> = {};

  for (const shadow of shadows) {
    tokens[shadow.name] = {
      $type: "shadow",
      $value: cssToW3cShadow(shadow.value),
      ...(shadow.description ? { $description: shadow.description } : {}),
    };
  }

  return tokens;
}

/**
 * Write a W3C Design Tokens file.
 */
export async function writeDesignTokensFile(
  filePath: string,
  tokens: Record<string, any>
): Promise<void> {
  const content = JSON.stringify(tokens, null, 2) + "\n";
  await fs.writeFile(filePath, content, "utf-8");
}

/**
 * Update a single shadow token in a W3C Design Tokens file.
 */
export async function updateDesignTokenShadow(
  filePath: string,
  tokenPath: string,
  newCssValue: string
): Promise<void> {
  const content = await fs.readFile(filePath, "utf-8");
  const tokens = JSON.parse(content);

  const pathParts = tokenPath.split(".");
  let current = tokens;

  // Navigate to parent
  for (let i = 0; i < pathParts.length - 1; i++) {
    current = current[pathParts[i]];
    if (!current) throw new Error(`Token path "${tokenPath}" not found`);
  }

  const lastKey = pathParts[pathParts.length - 1];
  if (!current[lastKey]) {
    throw new Error(`Token "${tokenPath}" not found`);
  }

  current[lastKey].$value = cssToW3cShadow(newCssValue);

  await fs.writeFile(filePath, JSON.stringify(tokens, null, 2) + "\n", "utf-8");
}
