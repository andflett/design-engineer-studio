import fs from "fs/promises";
import path from "path";
import type { FrameworkInfo } from "./detect-framework.js";

export interface TokenDefinition {
  name: string; // e.g. "--primary-500"
  category: "color" | "spacing" | "radius" | "shadow" | "typography" | "other";
  group: string; // e.g. "primary", "radius", "shadow"
  lightValue: string; // value in :root
  darkValue: string; // value in .dark (empty if not set)
  colorFormat?: "oklch" | "hsl" | "rgb" | "hex" | null;
}

export interface TokenMap {
  tokens: TokenDefinition[];
  cssFilePath: string;
  groups: Record<string, TokenDefinition[]>;
}

export async function scanTokens(
  projectRoot: string,
  framework: FrameworkInfo
): Promise<TokenMap> {
  if (framework.cssFiles.length === 0) {
    return { tokens: [], cssFilePath: "", groups: {} };
  }

  const cssFilePath = framework.cssFiles[0];
  const fullPath = path.join(projectRoot, cssFilePath);
  const css = await fs.readFile(fullPath, "utf-8");

  const rootTokens = parseBlock(css, ":root");
  const darkTokens = parseBlock(css, ".dark");

  const tokenMap = new Map<string, TokenDefinition>();

  // Process :root tokens
  for (const [name, value] of rootTokens) {
    const def: TokenDefinition = {
      name,
      category: categorizeToken(name, value),
      group: getTokenGroup(name),
      lightValue: value,
      darkValue: darkTokens.get(name) || "",
      colorFormat: detectColorFormat(value),
    };
    tokenMap.set(name, def);
  }

  // Add any dark-only tokens
  for (const [name, value] of darkTokens) {
    if (!tokenMap.has(name)) {
      tokenMap.set(name, {
        name,
        category: categorizeToken(name, value),
        group: getTokenGroup(name),
        lightValue: "",
        darkValue: value,
        colorFormat: detectColorFormat(value),
      });
    }
  }

  const tokens = Array.from(tokenMap.values());
  const groups: Record<string, TokenDefinition[]> = {};
  for (const token of tokens) {
    if (!groups[token.group]) groups[token.group] = [];
    groups[token.group].push(token);
  }

  return { tokens, cssFilePath, groups };
}

function parseBlock(css: string, selector: string): Map<string, string> {
  const tokens = new Map<string, string>();

  const selectorEscaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockStart = css.search(new RegExp(`${selectorEscaped}\\s*\\{`));
  if (blockStart === -1) return tokens;

  const openBrace = css.indexOf("{", blockStart);
  let depth = 1;
  let pos = openBrace + 1;
  while (depth > 0 && pos < css.length) {
    if (css[pos] === "{") depth++;
    if (css[pos] === "}") depth--;
    pos++;
  }

  const block = css.slice(openBrace + 1, pos - 1);

  // Parse CSS custom properties: --name: value;
  const propRegex = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = propRegex.exec(block)) !== null) {
    tokens.set(match[1], match[2].trim());
  }

  return tokens;
}

function categorizeToken(name: string, value: string): TokenDefinition["category"] {
  // Check by value format
  if (
    value.includes("oklch") ||
    value.includes("hsl") ||
    value.includes("rgb") ||
    value.startsWith("#")
  ) {
    return "color";
  }

  // Check by name patterns
  if (name.includes("radius")) return "radius";
  if (name.includes("shadow")) return "shadow";
  if (name.includes("spacing")) return "spacing";
  if (
    name.includes("font") ||
    name.includes("text") ||
    name.includes("tracking") ||
    name.includes("leading")
  ) {
    return "typography";
  }

  // Check value format for spacing
  if (value.endsWith("rem") || value.endsWith("px") || value.endsWith("em")) {
    if (name.includes("radius")) return "radius";
    return "spacing";
  }

  return "other";
}

function getTokenGroup(name: string): string {
  // --primary-500 → "primary"
  // --primary → "primary"
  // --primary-foreground → "primary"
  // --radius-lg → "radius"
  // --shadow-md → "shadow"
  // --background → "surface"
  // --border → "utility"

  const n = name.replace(/^--/, "");

  // Primitives with numeric suffixes
  const scaleMatch = n.match(/^([\w]+)-\d+$/);
  if (scaleMatch) return scaleMatch[1];

  // Semantic tokens with role suffixes
  const semanticPrefixes = [
    "primary",
    "secondary",
    "neutral",
    "success",
    "destructive",
    "warning",
  ];
  for (const prefix of semanticPrefixes) {
    if (n === prefix || n.startsWith(`${prefix}-`)) return prefix;
  }

  // Surface tokens
  if (["background", "foreground", "card", "card-foreground", "popover", "popover-foreground"].includes(n)) {
    return "surface";
  }

  // Utility tokens
  if (["border", "input", "ring", "muted", "muted-foreground", "accent", "accent-foreground"].includes(n)) {
    return "utility";
  }

  // Chart
  if (n.startsWith("chart")) return "chart";

  // Sidebar
  if (n.startsWith("sidebar")) return "sidebar";

  // Radius
  if (n.startsWith("radius")) return "radius";

  // Shadow
  if (n.startsWith("shadow")) return "shadow";

  return "other";
}

function detectColorFormat(value: string): TokenDefinition["colorFormat"] {
  if (value.includes("oklch")) return "oklch";
  if (value.includes("hsl")) return "hsl";
  if (value.includes("rgb")) return "rgb";
  if (value.startsWith("#")) return "hex";
  return null;
}
