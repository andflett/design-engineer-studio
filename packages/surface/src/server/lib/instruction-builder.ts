/**
 * instruction-builder.ts
 *
 * Manages a single .claude/surface.md instruction file and ensures
 * CLAUDE.md references it so Claude CLI loads it automatically.
 */

import fs from "fs/promises";
import nodePath from "path";
import type { ChangeIntent, SelectedElementData } from "../../shared/protocol.js";

// ──────────────────────────────────────────────────────────────────────────────
// Paths
// ──────────────────────────────────────────────────────────────────────────────

const SURFACE_MD_PATH = ".claude/surface.md";
const CLAUDE_MD_MARKER_OPEN = "<!-- surface:instructions -->";
const CLAUDE_MD_MARKER_CLOSE = "<!-- /surface:instructions -->";

// ──────────────────────────────────────────────────────────────────────────────
// Defaults
// ──────────────────────────────────────────────────────────────────────────────

function getDefaultInstructions(stylingType: string): string {
  const sections: string[] = [];

  sections.push(`# Surface Design Tool Instructions

You are editing source files in a running web application via the Surface visual editor.
Make ONLY the specific change requested. Do not reformat, reorganize, or refactor surrounding code.

## Framework & Code Quality

- Make the minimal diff needed to achieve the requested change
- Preserve all existing whitespace, indentation, and formatting
- Never reorder imports, attributes, or class names beyond what is strictly required
- Never add comments unless explicitly requested
- Do not add or remove imports unless the change strictly requires it
- Do not change unrelated elements or components on the page

**JSX / TSX**: Edit \`className\` prop directly. Preserve \`cn()\` / \`clsx()\` wrappers.
**Astro**: Use \`class\` attribute. Keep \`---\` frontmatter intact.
**Svelte**: Use \`class\` attribute. Keep \`<script>\` / \`<style>\` sections intact.`);

  if (stylingType === "tailwind-v4") {
    sections.push(`
## Tailwind v4 Styling

- Use Tailwind utility classes — never add inline \`style\` attributes unless explicitly instructed
- Prefer named scale values (\`p-4\`, \`text-lg\`) over arbitrary values (\`p-[16px]\`)
- Use the project's design token variables when available (\`bg-[var(--color-primary)]\`)
- Tailwind v4 uses CSS \`@theme\` blocks — tokens are CSS custom properties, not JS config
- When replacing a class, remove the old and add the new — never duplicate
- Preserve all existing class variants (hover, focus, dark, responsive) not being changed`);
  } else if (stylingType === "tailwind-v3") {
    sections.push(`
## Tailwind v3 Styling

- Use Tailwind utility classes — never add inline \`style\` attributes unless explicitly instructed
- Prefer named scale values (\`p-4\`, \`text-lg\`) over arbitrary values (\`p-[16px]\`)
- Use the project's design tokens from \`tailwind.config.js\` when available
- When replacing a class, remove the old and add the new — never duplicate
- Preserve all existing class variants (hover, focus, dark, responsive) not being changed`);
  } else {
    sections.push(`
## CSS Styling

1. **CSS Modules** — edit the corresponding rule in the module file
2. **Project stylesheets** — find the matching rule and edit the property there
3. **Inline styles** — only as a last resort when no CSS rule can be found
- Preserve specificity: do not add \`!important\` unless already present
- Preserve CSS custom property references: if a value uses \`var(--token)\`, update the token definition
- For \`.astro\` / \`.svelte\` files: edit the \`<style>\` block within the same file`);
  }

  sections.push(`
## Project Conventions

Add your project-specific rules here — component patterns, naming conventions, token usage, etc.`);

  return sections.join("\n");
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/** Read .claude/surface.md, or return null if it doesn't exist. */
export async function readSurfaceMd(projectRoot: string): Promise<string | null> {
  try {
    return await fs.readFile(nodePath.join(projectRoot, SURFACE_MD_PATH), "utf-8");
  } catch {
    return null;
  }
}

/** Write .claude/surface.md */
export async function writeSurfaceMd(projectRoot: string, content: string): Promise<void> {
  const dir = nodePath.join(projectRoot, ".claude");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(nodePath.join(projectRoot, SURFACE_MD_PATH), content, "utf-8");
}

/**
 * Ensure .claude/surface.md exists (write defaults if missing)
 * and CLAUDE.md references it. Called at server startup.
 */
export async function ensureSurfaceInstructions(projectRoot: string, stylingType: string): Promise<string> {
  let content = await readSurfaceMd(projectRoot);
  if (!content) {
    content = getDefaultInstructions(stylingType);
    await writeSurfaceMd(projectRoot, content);
  }
  // Always ensure CLAUDE.md has the reference
  await addSurfaceClaudeMdBlock(projectRoot);
  return content;
}

// ──────────────────────────────────────────────────────────────────────────────
// CLAUDE.md integration
// ──────────────────────────────────────────────────────────────────────────────

const CLAUDE_MD_BLOCK = `
${CLAUDE_MD_MARKER_OPEN}
## Surface Design Tool

When editing source files via Surface, load and follow the instructions in [.claude/surface.md](.claude/surface.md).
${CLAUDE_MD_MARKER_CLOSE}
`;

export async function hasSurfaceClaudeMdBlock(projectRoot: string): Promise<boolean> {
  try {
    const content = await fs.readFile(nodePath.join(projectRoot, "CLAUDE.md"), "utf-8");
    return content.includes(CLAUDE_MD_MARKER_OPEN);
  } catch {
    return false;
  }
}

export async function addSurfaceClaudeMdBlock(projectRoot: string): Promise<void> {
  const claudeMdPath = nodePath.join(projectRoot, "CLAUDE.md");
  let existing = "";
  try {
    existing = await fs.readFile(claudeMdPath, "utf-8");
  } catch {
    // File doesn't exist — we'll create it
  }
  if (existing.includes(CLAUDE_MD_MARKER_OPEN)) return;
  const updated = existing.trimEnd() + "\n" + CLAUDE_MD_BLOCK;
  await fs.writeFile(claudeMdPath, updated, "utf-8");
}

// ──────────────────────────────────────────────────────────────────────────────
// Prompt assembly (used by deterministic write mode)
// ──────────────────────────────────────────────────────────────────────────────

export interface AssemblePromptOpts {
  instructions: string;
  changes: ChangeIntent[];
  element?: SelectedElementData;
  projectRoot: string;
  shortMode?: boolean;
}

export function assemblePrompt(opts: AssemblePromptOpts): string {
  const { instructions, changes, element, projectRoot, shortMode = false } = opts;
  const parts: string[] = [];

  if (!shortMode && instructions.trim()) {
    parts.push(instructions.trim());
    parts.push(`[PROJECT ROOT]\n${projectRoot}\nAll paths are relative to this directory.`);
  }

  if (element) {
    parts.push(buildElementContext(element, projectRoot));
  }

  if (changes.length > 0) {
    const changesStr = changes.map((c) => formatChangeIntent(c, projectRoot)).join("\n");
    parts.push(`[Changes to apply]\n${changesStr}`);
  }

  return parts.join("\n\n---\n\n");
}

function resolveFilePath(file: string, projectRoot: string): string {
  if (nodePath.isAbsolute(file)) return file;
  return nodePath.resolve(projectRoot, file);
}

function buildElementContext(element: SelectedElementData, projectRoot: string): string {
  const lines: string[] = [];
  if (element.source) {
    lines.push(`[Element: ${resolveFilePath(element.source.file, projectRoot)}:${element.source.line}]`);
  } else if (element.instanceSource) {
    lines.push(`[Element: ${resolveFilePath(element.instanceSource.file, projectRoot)}:${element.instanceSource.line}]`);
  }
  if (element.componentName) lines.push(`Component: ${element.componentName}`);
  if (element.className) lines.push(`className: "${element.className}"`);
  const relevant = ["display", "flex-direction", "padding", "margin", "width", "height",
    "font-size", "color", "background-color", "border-radius", "gap"];
  const computed = relevant.filter((p) => element.computed?.[p]).map((p) => `${p}: ${element.computed[p]}`).join("  ");
  if (computed) lines.push(computed);
  return lines.join("\n");
}

function formatChangeIntent(c: ChangeIntent, projectRoot: string): string {
  if (c.elementSource) {
    const file = resolveFilePath(c.elementSource.file, projectRoot);
    return `  ${c.property}: ${c.fromValue} → ${c.toValue}  (${file}:${c.elementSource.line})`;
  }
  const filePart = c.cssFilePath ? `  (${c.cssFilePath})` : "";
  return `  ${c.property}: ${c.fromValue} → ${c.toValue}${filePart}`;
}
