import fs from "fs/promises";
import path from "path";
import recast from "recast";
import { namedTypes as n } from "ast-types";
import { getParser } from "./ast-helpers.js";

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
  exportName: string; // e.g. "Button" — the named export to import
  baseClasses: string; // CVA base classes
  variants: VariantDimension[];
  tokenReferences: string[]; // tokens used across all variants
  /** Whether this component accepts children (has ...props spread on a container element) */
  acceptsChildren: boolean;
}

export interface ComponentRegistry {
  components: ComponentEntry[];
}

export async function scanComponents(
  projectRoot: string,
  overrideDir?: string,
): Promise<ComponentRegistry> {
  let componentDir = overrideDir || "";

  if (!componentDir) {
    // Fallback: check hardcoded candidates
    const componentDirs = [
      "components/ui",
      "src/components/ui",
    ];

    for (const dir of componentDirs) {
      try {
        await fs.access(path.join(projectRoot, dir));
        componentDir = dir;
        break;
      } catch {
        // doesn't exist
      }
    }
  }

  if (!componentDir) {
    return { components: [] };
  }

  const fullDir = path.join(projectRoot, componentDir);
  const files = await fs.readdir(fullDir);
  const tsxFiles = files.filter((f) => f.endsWith(".tsx") || f.endsWith(".jsx"));

  const parser = await getParser();
  const components: ComponentEntry[] = [];

  for (const file of tsxFiles) {
    const filePath = path.join(componentDir, file);
    const source = await fs.readFile(path.join(projectRoot, filePath), "utf-8");

    const entries = parseComponentAST(source, filePath, parser);
    components.push(...entries);
  }

  return { components };
}

/**
 * AST-based component parser. Extracts data-slot components, CVA variants,
 * export names, and token references from a single file.
 */
function parseComponentAST(
  source: string,
  filePath: string,
  parser: any
): ComponentEntry[] {
  let ast: any;
  try {
    ast = recast.parse(source, { parser });
  } catch {
    return [];
  }

  // Collect CVA call info: variable name → { baseClasses, variants }
  const cvaMap = new Map<string, { baseClasses: string; variants: VariantDimension[] }>();

  // Collect data-slot → component variable name associations
  const slotToComponent = new Map<string, string>();

  // Collect exported names
  const exportedNames = new Set<string>();

  // Collect component variable names that accept children (spread props)
  const acceptsChildrenSet = new Set<string>();

  // Track which variable name is currently being defined (for linking data-slot to component)
  let currentComponentName: string | null = null;

  recast.visit(ast, {
    // Find cva() calls: const fooVariants = cva("base classes", { variants: {...}, defaultVariants: {...} })
    visitVariableDeclaration(path) {
      for (const decl of path.node.declarations) {
        if (
          n.VariableDeclarator.check(decl) &&
          n.Identifier.check(decl.id) &&
          n.CallExpression.check(decl.init) &&
          isIdentifierNamed(decl.init.callee, "cva")
        ) {
          const varName = decl.id.name;
          const args = decl.init.arguments;
          const baseClasses = extractStringValue(args[0]) || "";
          const configArg = args[1];
          const variants = configArg && n.ObjectExpression.check(configArg)
            ? extractVariantsFromConfig(configArg)
            : [];

          cvaMap.set(varName, { baseClasses, variants });
        }
      }
      this.traverse(path);
    },

    // Find forwardRef and function components to track data-slot and currentComponentName
    visitCallExpression(path) {
      const node = path.node;
      // React.forwardRef() — the parent variable declarator gives the component name
      if (isForwardRefCall(node)) {
        const parent = path.parent?.node;
        if (n.VariableDeclarator.check(parent) && n.Identifier.check(parent.id)) {
          currentComponentName = parent.id.name;
        }
      }
      this.traverse(path);
    },

    // Find data-slot JSX attributes
    visitJSXAttribute(path) {
      const attr = path.node;
      if (
        n.JSXIdentifier.check(attr.name) &&
        attr.name.name === "data-slot" &&
        n.StringLiteral.check(attr.value)
      ) {
        const slotValue = attr.value.value;
        // Associate with current component context
        const compName = findEnclosingComponentName(path) || currentComponentName;
        if (compName) {
          slotToComponent.set(slotValue, compName);
        }
      }
      this.traverse(path);
    },

    // Detect {...props} spread in JSX — indicates component accepts children
    visitJSXSpreadAttribute(path) {
      const expr = path.node.argument;
      if (n.Identifier.check(expr) && expr.name === "props") {
        const compName = findEnclosingComponentName(path) || currentComponentName;
        if (compName) {
          acceptsChildrenSet.add(compName);
        }
      }
      this.traverse(path);
    },

    // Collect named exports: export { Button, Card, ... }
    visitExportNamedDeclaration(path) {
      const node = path.node;
      if (node.specifiers) {
        for (const spec of node.specifiers) {
          if (n.ExportSpecifier.check(spec) && n.Identifier.check(spec.exported)) {
            exportedNames.add(spec.exported.name);
          }
        }
      }
      // export const Foo = ...
      if (node.declaration) {
        if (n.VariableDeclaration.check(node.declaration)) {
          for (const decl of node.declaration.declarations) {
            if (n.VariableDeclarator.check(decl) && n.Identifier.check(decl.id)) {
              exportedNames.add(decl.id.name);
            }
          }
        } else if (n.FunctionDeclaration.check(node.declaration) && node.declaration.id) {
          exportedNames.add(node.declaration.id.name);
        }
      }
      this.traverse(path);
    },

    // export default function Foo
    visitExportDefaultDeclaration(path) {
      const decl = path.node.declaration;
      if (n.FunctionDeclaration.check(decl) && decl.id) {
        exportedNames.add(decl.id.name);
      }
      this.traverse(path);
    },
  });

  // Reset for second pass to find function components with data-slot
  // (non-forwardRef functions like Badge)
  recast.visit(ast, {
    visitFunctionDeclaration(path) {
      const name = path.node.id ? String(path.node.id.name) : null;
      if (name) {
        currentComponentName = name;
        this.traverse(path);
        currentComponentName = null;
      } else {
        this.traverse(path);
      }
    },

    visitJSXAttribute(path) {
      const attr = path.node;
      if (
        n.JSXIdentifier.check(attr.name) &&
        attr.name.name === "data-slot" &&
        n.StringLiteral.check(attr.value)
      ) {
        const slotValue = attr.value.value;
        if (!slotToComponent.has(slotValue) && currentComponentName) {
          slotToComponent.set(slotValue, currentComponentName);
        }
      }
      this.traverse(path);
    },
  });

  // Build component entries
  const tokenRefs = extractTokenReferences(source);
  const entries: ComponentEntry[] = [];

  for (const [dataSlot, componentName] of slotToComponent) {
    // Only include exported components
    const exportName = exportedNames.has(componentName) ? componentName : null;
    if (!exportName) continue;

    // Try to find matching CVA definition (e.g. buttonVariants for Button)
    const cvaVarName = findCvaForComponent(componentName, cvaMap);
    const cvaData = cvaVarName ? cvaMap.get(cvaVarName) : null;

    const name = dataSlot
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("");

    entries.push({
      name,
      filePath,
      dataSlot,
      exportName,
      baseClasses: cvaData?.baseClasses || "",
      variants: cvaData?.variants || [],
      tokenReferences: tokenRefs,
      acceptsChildren: acceptsChildrenSet.has(componentName),
    });
  }

  return entries;
}

/** Check if a node is an identifier with a specific name. */
function isIdentifierNamed(node: any, name: string): boolean {
  return n.Identifier.check(node) && node.name === name;
}

/**
 * Check if a node is an object property (handles both ESTree `Property`
 * and Babel's `ObjectProperty` which ast-types registers separately).
 */
function isObjectProperty(node: any): boolean {
  return n.Property.check(node) || n.ObjectProperty.check(node);
}

/** Check if a call expression is React.forwardRef(...) or forwardRef(...). */
function isForwardRefCall(node: any): boolean {
  if (!n.CallExpression.check(node)) return false;
  if (isIdentifierNamed(node.callee, "forwardRef")) return true;
  if (
    n.MemberExpression.check(node.callee) &&
    isIdentifierNamed(node.callee.object, "React") &&
    isIdentifierNamed(node.callee.property, "forwardRef")
  ) {
    return true;
  }
  return false;
}

/** Extract a string value from an AST node (StringLiteral or TemplateLiteral with no expressions). */
function extractStringValue(node: any): string | null {
  if (!node) return null;
  if (n.StringLiteral.check(node) || (n.Literal.check(node) && typeof node.value === "string")) {
    return String(node.value);
  }
  if (n.TemplateLiteral.check(node) && node.expressions.length === 0 && node.quasis.length === 1) {
    return node.quasis[0].value.cooked || node.quasis[0].value.raw;
  }
  return null;
}

/**
 * Extract variant dimensions from a CVA config ObjectExpression.
 * Handles: cva("base", { variants: { variant: { default: "...", ... } }, defaultVariants: { variant: "default" } })
 */
function extractVariantsFromConfig(configObj: any): VariantDimension[] {
  const dimensions: VariantDimension[] = [];

  const variantsProp = findObjProperty(configObj, "variants");
  if (!variantsProp || !n.ObjectExpression.check(variantsProp.value)) return dimensions;

  const defaultVariantsProp = findObjProperty(configObj, "defaultVariants");
  const defaults: Record<string, string> = {};
  if (defaultVariantsProp && n.ObjectExpression.check(defaultVariantsProp.value)) {
    for (const prop of defaultVariantsProp.value.properties) {
      if (isObjectProperty(prop)) {
        const key = getPropertyKeyName(prop);
        const val = extractStringValue(prop.value);
        if (key && val) defaults[key] = val;
      }
    }
  }

  // Each property of the variants object is a dimension
  for (const dimProp of variantsProp.value.properties) {
    if (!isObjectProperty(dimProp)) continue;
    const dimName = getPropertyKeyName(dimProp);
    if (!dimName || !n.ObjectExpression.check(dimProp.value)) continue;

    const options: string[] = [];
    const classes: Record<string, string> = {};

    for (const optProp of dimProp.value.properties) {
      if (!isObjectProperty(optProp)) continue;
      const optName = getPropertyKeyName(optProp);
      const optValue = extractStringValue(optProp.value);
      if (optName) {
        options.push(optName);
        classes[optName] = optValue || "";
      }
    }

    if (options.length > 0) {
      dimensions.push({
        name: dimName,
        options,
        default: defaults[dimName] || options[0],
        classes,
      });
    }
  }

  return dimensions;
}

/** Find a property by key name in an ObjectExpression. */
function findObjProperty(obj: any, name: string): any | null {
  for (const prop of obj.properties) {
    if (isObjectProperty(prop) && getPropertyKeyName(prop) === name) {
      return prop;
    }
  }
  return null;
}

/** Get the string key name of an object property. */
function getPropertyKeyName(prop: any): string | null {
  if (n.Identifier.check(prop.key)) return prop.key.name;
  if (n.StringLiteral.check(prop.key) || (n.Literal.check(prop.key) && typeof prop.key.value === "string")) {
    return prop.key.value;
  }
  return null;
}

/** Walk up the AST from a path to find the enclosing component name. */
function findEnclosingComponentName(astPath: any): string | null {
  let current = astPath.parent;
  while (current) {
    const node = current.node;
    // const Foo = React.forwardRef(...)
    if (n.VariableDeclarator.check(node) && n.Identifier.check(node.id)) {
      return node.id.name;
    }
    // function Foo() { ... }
    if (n.FunctionDeclaration.check(node) && node.id) {
      return node.id.name;
    }
    current = current.parent;
  }
  return null;
}

/**
 * Find the CVA variable that matches a component.
 * Convention: Button → buttonVariants, Badge → badgeVariants
 */
function findCvaForComponent(
  componentName: string,
  cvaMap: Map<string, any>
): string | null {
  const lower = componentName.charAt(0).toLowerCase() + componentName.slice(1);
  const expected = `${lower}Variants`;
  if (cvaMap.has(expected)) return expected;

  // Fallback: if there's only one CVA definition, use it
  if (cvaMap.size === 1) return cvaMap.keys().next().value!;

  return null;
}

function extractTokenReferences(source: string): string[] {
  const tokens = new Set<string>();
  const classStrings = source.match(/["'`][^"'`]*["'`]/g) || [];

  for (const str of classStrings) {
    const tokenPattern =
      /(?:bg|text|border|ring|shadow|outline|fill|stroke)-([a-z][\w-]*(?:\/\d+)?)/g;
    let match;
    while ((match = tokenPattern.exec(str)) !== null) {
      const val = match[1];
      if (
        !val.match(/^\d/) &&
        !["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "full", "none"].includes(val) &&
        !val.startsWith("[")
      ) {
        tokens.add(val.split("/")[0]);
      }
    }
  }

  return Array.from(tokens);
}
