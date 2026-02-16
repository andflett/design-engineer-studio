import fs from "fs/promises";
import path from "path";

export interface VariantDimension {
  name: string; // e.g. "variant"
  options: string[]; // e.g. ["default", "destructive", "outline", ...]
  default: string; // e.g. "default"
  classes: Record<string, string>; // option → class string
}

export interface ComponentEntry {
  name: string; // e.g. "Button"
  filePath: string; // relative path
  dataSlot: string; // e.g. "button"
  baseClasses: string; // CVA base classes
  variants: VariantDimension[];
  tokenReferences: string[]; // tokens used across all variants
}

export interface ComponentRegistry {
  components: ComponentEntry[];
}

export async function scanComponents(
  projectRoot: string
): Promise<ComponentRegistry> {
  const componentDirs = [
    "components/ui",
    "src/components/ui",
  ];

  let componentDir = "";
  for (const dir of componentDirs) {
    try {
      await fs.access(path.join(projectRoot, dir));
      componentDir = dir;
      break;
    } catch {
      // doesn't exist
    }
  }

  if (!componentDir) {
    return { components: [] };
  }

  const fullDir = path.join(projectRoot, componentDir);
  const files = await fs.readdir(fullDir);
  const tsxFiles = files.filter((f) => f.endsWith(".tsx"));

  const components: ComponentEntry[] = [];

  for (const file of tsxFiles) {
    const filePath = path.join(componentDir, file);
    const source = await fs.readFile(path.join(projectRoot, filePath), "utf-8");

    const entry = parseComponent(source, filePath);
    if (entry) {
      components.push(entry);
    }
  }

  return { components };
}

function parseComponent(
  source: string,
  filePath: string
): ComponentEntry | null {
  // Check if this file has a CVA definition
  const cvaMatch = source.match(
    /const\s+(\w+)\s*=\s*cva\(\s*(["'`])([\s\S]*?)\2\s*,\s*\{/
  );

  // Find data-slot
  const slotMatch = source.match(/data-slot=["'](\w+)["']/);
  if (!slotMatch) return null;

  const dataSlot = slotMatch[1];
  const name = dataSlot.charAt(0).toUpperCase() + dataSlot.slice(1);

  if (!cvaMatch) {
    // Non-CVA component with data-slot
    return {
      name,
      filePath,
      dataSlot,
      baseClasses: "",
      variants: [],
      tokenReferences: extractTokenReferences(source),
    };
  }

  const baseClasses = cvaMatch[3].trim();

  // Parse variants
  const variants = parseVariants(source);
  const tokenReferences = extractTokenReferences(source);

  return {
    name,
    filePath,
    dataSlot,
    baseClasses,
    variants,
    tokenReferences,
  };
}

function parseVariants(source: string): VariantDimension[] {
  const dimensions: VariantDimension[] = [];

  // Find the variants object inside cva()
  const variantsBlock = source.match(/variants\s*:\s*\{([\s\S]*?)\}\s*,?\s*defaultVariants/);
  if (!variantsBlock) return dimensions;

  const block = variantsBlock[1];

  // Parse each variant dimension
  // Pattern: dimensionName: { option: "classes", ... }
  const dimRegex = /(\w+)\s*:\s*\{([^}]+)\}/g;
  let dimMatch;

  while ((dimMatch = dimRegex.exec(block)) !== null) {
    const dimName = dimMatch[1];
    const dimBody = dimMatch[2];

    const options: string[] = [];
    const classes: Record<string, string> = {};

    // Parse options within the dimension
    // Pattern: optionName: "classes" or "optionName": "classes"
    const optRegex = /["']?([\w-]+)["']?\s*:\s*\n?\s*["'`]([^"'`]*)["'`]/g;
    let optMatch;

    while ((optMatch = optRegex.exec(dimBody)) !== null) {
      options.push(optMatch[1]);
      classes[optMatch[1]] = optMatch[2].trim();
    }

    // Find default
    const defaultMatch = source.match(
      new RegExp(`${dimName}\\s*:\\s*["'](\\w+)["']`, "g")
    );
    const defaultValues = defaultMatch || [];
    // The last match in defaultVariants section is the default
    const defaultVariantsSection = source.match(
      /defaultVariants\s*:\s*\{([^}]+)\}/
    );
    let defaultVal = options[0] || "";
    if (defaultVariantsSection) {
      const defMatch = defaultVariantsSection[1].match(
        new RegExp(`${dimName}\\s*:\\s*["'](\\w+)["']`)
      );
      if (defMatch) defaultVal = defMatch[1];
    }

    if (options.length > 0) {
      dimensions.push({
        name: dimName,
        options,
        default: defaultVal,
        classes,
      });
    }
  }

  return dimensions;
}

function extractTokenReferences(source: string): string[] {
  const tokens = new Set<string>();
  // Find bg-{token}, text-{token}, border-{token} patterns in string literals
  const classStrings = source.match(/["'`][^"'`]*["'`]/g) || [];

  for (const str of classStrings) {
    const tokenPattern =
      /(?:bg|text|border|ring|shadow|outline|fill|stroke)-([a-z][\w-]*(?:\/\d+)?)/g;
    let match;
    while ((match = tokenPattern.exec(str)) !== null) {
      // Filter out non-token values like size utilities
      const val = match[1];
      if (
        !val.match(/^\d/) && // not a number
        !["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "full", "none"].includes(val) &&
        !val.startsWith("[") // not arbitrary values
      ) {
        tokens.add(val.split("/")[0]); // remove opacity modifier
      }
    }
  }

  return Array.from(tokens);
}
