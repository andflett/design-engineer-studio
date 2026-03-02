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

interface VariantExtractionResult {
  baseClasses: string;
  variants: VariantDimension[];
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

// ---------------------------------------------------------------------------
// Config-object extractors (patterns 1–5)
// ---------------------------------------------------------------------------

/** Pattern 1: CVA — `cva("base classes", { variants, defaultVariants })` */
function extractCva(decl: any): VariantExtractionResult | null {
  if (
    !n.CallExpression.check(decl.init) ||
    !isIdentifierNamed(decl.init.callee, "cva")
  ) return null;

  const args = decl.init.arguments;
  // CVA uses a string as 1st arg; if it's an object, that's PandaCSS (pattern 5)
  if (args[0] && n.ObjectExpression.check(args[0])) return null;

  const baseClasses = extractStringValue(args[0]) || "";
  const configArg = args[1];
  const variants = configArg && n.ObjectExpression.check(configArg)
    ? extractVariantsFromConfig(configArg)
    : [];

  return { baseClasses, variants };
}

/** Pattern 2: Tailwind Variants — `tv({ base: "...", variants, defaultVariants })` */
function extractTv(decl: any): VariantExtractionResult | null {
  if (
    !n.CallExpression.check(decl.init) ||
    !isIdentifierNamed(decl.init.callee, "tv")
  ) return null;

  const configArg = decl.init.arguments[0];
  if (!configArg || !n.ObjectExpression.check(configArg)) return null;

  const baseProp = findObjProperty(configArg, "base");
  const baseClasses = baseProp ? extractStringValue(baseProp.value) || "" : "";
  const variants = extractVariantsFromConfig(configArg);

  return { baseClasses, variants };
}

/** Pattern 3: Stitches — `styled("button", { variants, defaultVariants })` */
function extractStyled(decl: any): VariantExtractionResult | null {
  if (
    !n.CallExpression.check(decl.init) ||
    !isIdentifierNamed(decl.init.callee, "styled")
  ) return null;

  const configArg = decl.init.arguments[1];
  if (!configArg || !n.ObjectExpression.check(configArg)) return null;

  const variants = extractVariantsFromConfig(configArg);
  return { baseClasses: "", variants };
}

/** Pattern 4: Vanilla Extract — `recipe({ base: "...", variants, defaultVariants })` */
function extractRecipe(decl: any): VariantExtractionResult | null {
  if (
    !n.CallExpression.check(decl.init) ||
    !isIdentifierNamed(decl.init.callee, "recipe")
  ) return null;

  const configArg = decl.init.arguments[0];
  if (!configArg || !n.ObjectExpression.check(configArg)) return null;

  const baseProp = findObjProperty(configArg, "base");
  const baseClasses = baseProp ? extractStringValue(baseProp.value) || "" : "";
  const variants = extractVariantsFromConfig(configArg);

  return { baseClasses, variants };
}

/** Pattern 5: PandaCSS — `cva({ base: { ... }, variants, defaultVariants })` (1st arg is object) */
function extractPandaCva(decl: any): VariantExtractionResult | null {
  if (
    !n.CallExpression.check(decl.init) ||
    !isIdentifierNamed(decl.init.callee, "cva")
  ) return null;

  const configArg = decl.init.arguments[0];
  if (!configArg || !n.ObjectExpression.check(configArg)) return null;

  const baseProp = findObjProperty(configArg, "base");
  const baseClasses = baseProp ? extractStringValue(baseProp.value) || "" : "";
  const variants = extractVariantsFromConfig(configArg);

  return { baseClasses, variants };
}

/** Pattern 6: Plain object map — `const sizeStyles = { sm: "...", md: "...", lg: "..." }` */
function extractPlainObjectMap(decl: any): VariantExtractionResult | null {
  if (!n.Identifier.check(decl.id) || !n.ObjectExpression.check(decl.init)) return null;

  const varName = decl.id.name;
  // Heuristic: variable name must suggest a variant/style map
  if (!/variant|style|class|map|theme|appearance/i.test(varName)) return null;

  const obj = decl.init;
  if (obj.properties.length < 2) return null;

  // All properties must be string-valued
  const options: string[] = [];
  const classes: Record<string, string> = {};
  for (const prop of obj.properties) {
    if (!isObjectProperty(prop)) return null;
    const key = getPropertyKeyName(prop);
    const val = extractStringValue(prop.value);
    if (!key || val === null) return null;
    options.push(key);
    classes[key] = val;
  }

  // Derive dimension name from variable name (strip "Styles", "Classes", "Map", etc.)
  const dimName = varName.replace(/(?:Styles|Classes|Map|Variants|Theme)$/i, "").replace(/^.*?([A-Z][a-z]+)$/, (_: string, m: string) => m.toLowerCase()) || varName;

  return {
    baseClasses: "",
    variants: [{
      name: dimName,
      options,
      default: options[0],
      classes,
    }],
  };
}

/** All config-object extractors in priority order */
const configExtractors = [
  extractCva,       // pattern 1 — returns null if 1st arg is object
  extractTv,        // pattern 2
  extractStyled,    // pattern 3
  extractRecipe,    // pattern 4
  extractPandaCva,  // pattern 5 — catches cva({...}) that extractCva skipped
  extractPlainObjectMap, // pattern 6 — most conservative, runs last
];

// ---------------------------------------------------------------------------
// Pattern 7: TypeScript union props
// ---------------------------------------------------------------------------

/** Props to skip when extracting variant dimensions from TS types */
const TS_PROP_SKIP_LIST = new Set([
  "children", "className", "class", "style", "ref", "key", "id",
  "onClick", "onChange", "onSubmit", "onBlur", "onFocus", "onKeyDown",
  "onKeyUp", "onMouseDown", "onMouseUp", "onMouseEnter", "onMouseLeave",
  "as", "asChild", "href", "src", "alt", "title", "name", "value",
  "type", "role", "tabIndex", "placeholder", "htmlFor", "action",
  "method", "target", "rel", "open", "checked", "selected", "readOnly",
  "required", "disabled", "hidden", "autoFocus", "autoComplete",
  "label", "description", "content", "header", "footer", "icon",
  "slot", "data-slot", "data-testid",
]);

/** Check if a prop name looks like an aria attribute */
function isAriaOrDataProp(name: string): boolean {
  return name.startsWith("aria-") || name.startsWith("data-") || name.startsWith("on");
}

/**
 * Pattern 7: Extract variant dimensions from TypeScript union props.
 * Finds the component function's parameter type annotation, resolves the
 * interface/type, and creates dimensions for string literal union properties.
 */
function extractTsUnionProps(decl: any, ast: any): VariantExtractionResult | null {
  const funcNode = getFunctionNode(decl);
  if (!funcNode) return null;

  const params = funcNode.params;
  if (!params || params.length === 0) return null;

  const firstParam = params[0];

  // Get defaults from destructuring: { size = "md", variant = "primary" }
  const defaults: Record<string, string> = {};
  let typeAnnotation: any = null;

  if (n.ObjectPattern.check(firstParam)) {
    extractDestructuredDefaults(firstParam, defaults);
    typeAnnotation = firstParam.typeAnnotation;
  } else if (n.Identifier.check(firstParam)) {
    typeAnnotation = firstParam.typeAnnotation;
  } else if (n.AssignmentPattern.check(firstParam) && n.ObjectPattern.check(firstParam.left)) {
    extractDestructuredDefaults(firstParam.left, defaults);
    typeAnnotation = firstParam.left.typeAnnotation;
  }

  if (!typeAnnotation) return null;

  // Unwrap TSTypeAnnotation wrapper
  const annotation = typeAnnotation.typeAnnotation || typeAnnotation;

  // Try inline object type first
  if (n.TSTypeLiteral.check(annotation)) {
    const variants = extractUnionDimensionsFromMembers(annotation.members, defaults);
    if (variants.length > 0) return { baseClasses: "", variants };
  }

  // Resolve type reference: `props: ButtonProps` → find `interface ButtonProps { ... }`
  const typeName = extractTypeReferenceName(annotation);
  if (!typeName) return null;

  const typeDecl = findTypeDeclaration(ast, typeName);
  if (!typeDecl) return null;

  const members = getTypeMembers(typeDecl);
  if (!members) return null;

  const variants = extractUnionDimensionsFromMembers(members, defaults);
  if (variants.length === 0) return null;

  return { baseClasses: "", variants };
}

/** Unwrap VariableDeclarator → forwardRef → ArrowFunction / FunctionExpression */
function getFunctionNode(decl: any): any {
  const init = decl.init;
  if (!init) return null;

  // const Foo = (...) => { ... }
  if (n.ArrowFunctionExpression.check(init) || n.FunctionExpression.check(init)) {
    return init;
  }

  // const Foo = forwardRef((...) => { ... })
  if (n.CallExpression.check(init) && isForwardRefCall(init)) {
    const arg = init.arguments[0];
    if (n.ArrowFunctionExpression.check(arg) || n.FunctionExpression.check(arg)) {
      return arg;
    }
  }

  return null;
}

/** Extract default values from destructured params: `{ size = "md" }` */
function extractDestructuredDefaults(pattern: any, defaults: Record<string, string>): void {
  for (const prop of pattern.properties) {
    if (!isObjectProperty(prop) && !n.Property.check(prop)) continue;
    const key = n.Identifier.check(prop.key) ? prop.key.name : null;
    if (!key) continue;

    // { size = "md" } — AssignmentPattern in the value position
    if (n.AssignmentPattern.check(prop.value)) {
      const val = extractStringValue(prop.value.right);
      if (val) defaults[key] = val;
    }
  }
}

/** Get the type name from a TSTypeReference: `ButtonProps` from `: ButtonProps` */
function extractTypeReferenceName(annotation: any): string | null {
  if (!n.TSTypeReference.check(annotation)) return null;
  const typeName = annotation.typeName;
  if (n.Identifier.check(typeName)) return typeName.name;
  return null;
}

/** Walk AST to find `interface Foo { ... }` or `type Foo = { ... }` */
function findTypeDeclaration(ast: any, name: string): any {
  let result: any = null;
  recast.visit(ast, {
    visitTSInterfaceDeclaration(path: any) {
      if (path.node.id && path.node.id.name === name) {
        result = path.node;
        return false;
      }
      this.traverse(path);
    },
    visitTSTypeAliasDeclaration(path: any) {
      if (path.node.id && path.node.id.name === name) {
        result = path.node;
        return false;
      }
      this.traverse(path);
    },
  });
  return result;
}

/** Get the members array from an interface or type alias declaration */
function getTypeMembers(typeDecl: any): any[] | null {
  // interface Foo { ... }
  if (n.TSInterfaceDeclaration.check(typeDecl)) {
    return typeDecl.body?.body || null;
  }
  // type Foo = { ... }
  if (n.TSTypeAliasDeclaration.check(typeDecl)) {
    const ann = typeDecl.typeAnnotation;
    if (n.TSTypeLiteral.check(ann)) return ann.members;
    // type Foo = BaseProps & { variant: ... } — check intersection
    if (n.TSIntersectionType.check(ann)) {
      const members: any[] = [];
      for (const t of ann.types) {
        if (n.TSTypeLiteral.check(t)) members.push(...t.members);
      }
      return members.length > 0 ? members : null;
    }
  }
  return null;
}

/** Extract variant dimensions from interface/type members */
function extractUnionDimensionsFromMembers(
  members: any[],
  defaults: Record<string, string>
): VariantDimension[] {
  const dimensions: VariantDimension[] = [];

  for (const member of members) {
    if (!n.TSPropertySignature.check(member)) continue;
    const key = n.Identifier.check(member.key) ? member.key.name : null;
    if (!key) continue;
    if (TS_PROP_SKIP_LIST.has(key) || isAriaOrDataProp(key)) continue;

    const typeAnn = member.typeAnnotation?.typeAnnotation || member.typeAnnotation;
    if (!typeAnn) continue;

    const literals = extractStringLiteralsFromUnion(typeAnn);
    if (literals.length < 2) continue;

    dimensions.push({
      name: key,
      options: literals,
      default: defaults[key] || literals[0],
      classes: {},
    });
  }

  return dimensions;
}

/** Pull string literal values from a TSUnionType: `"sm" | "md" | "lg"` → ["sm", "md", "lg"] */
function extractStringLiteralsFromUnion(typeNode: any): string[] {
  if (!n.TSUnionType.check(typeNode)) return [];

  const literals: string[] = [];
  for (const t of typeNode.types) {
    if (n.TSLiteralType.check(t) && t.literal && "value" in t.literal && typeof (t.literal as any).value === "string") {
      literals.push((t.literal as any).value);
    }
  }
  return literals;
}

// ---------------------------------------------------------------------------
// Main AST parser
// ---------------------------------------------------------------------------

/**
 * AST-based component parser. Extracts data-slot components, variant definitions,
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

  // Collect variant config info: variable name → { baseClasses, variants }
  const variantMap = new Map<string, VariantExtractionResult>();

  // Collect data-slot → component variable name associations
  const slotToComponent = new Map<string, string>();

  // Collect exported names
  const exportedNames = new Set<string>();

  // Collect component variable names that accept children (spread props)
  const acceptsChildrenSet = new Set<string>();

  // Track which variable name is currently being defined (for linking data-slot to component)
  let currentComponentName: string | null = null;

  recast.visit(ast, {
    // Find variant definitions in variable declarations
    visitVariableDeclaration(path) {
      for (const decl of path.node.declarations) {
        if (!n.VariableDeclarator.check(decl) || !n.Identifier.check(decl.id)) continue;

        const varName = decl.id.name;

        // Try config-object extractors (patterns 1–6)
        for (const extractor of configExtractors) {
          const result = extractor(decl);
          if (result) {
            variantMap.set(varName, result);
            break;
          }
        }

        // Fallback: pattern 7 — TS union props on arrow/function expression components
        if (!variantMap.has(varName)) {
          const tsResult = extractTsUnionProps(decl, ast);
          if (tsResult) variantMap.set(varName, tsResult);
        }
      }
      this.traverse(path);
    },

    // Pattern 7 for named function declarations: `function Button({ size = "md" }: ButtonProps)`
    visitFunctionDeclaration(path) {
      const node = path.node;
      if (node.id && n.Identifier.check(node.id)) {
        const name = node.id.name;
        if (!variantMap.has(name)) {
          // Build a pseudo-declarator so extractTsUnionProps can work
          const tsResult = extractTsUnionProps({ init: null, id: node.id }, ast);
          // Try directly from function params
          if (!tsResult) {
            const directResult = extractTsUnionPropsFromFunction(node, ast);
            if (directResult) variantMap.set(name, directResult);
          } else {
            variantMap.set(name, tsResult);
          }
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

    // Try to find matching variant definition
    const variantVarName = findVariantConfigForComponent(componentName, variantMap);
    const variantData = variantVarName ? variantMap.get(variantVarName) : null;

    const name = dataSlot
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("");

    entries.push({
      name,
      filePath,
      dataSlot,
      exportName,
      baseClasses: variantData?.baseClasses || "",
      variants: variantData?.variants || [],
      tokenReferences: tokenRefs,
      acceptsChildren: acceptsChildrenSet.has(componentName),
    });
  }

  return entries;
}

/**
 * Extract TS union props directly from a function declaration's params.
 * Used for `function Button({ size = "md" }: ButtonProps) { ... }`
 */
function extractTsUnionPropsFromFunction(funcNode: any, ast: any): VariantExtractionResult | null {
  const params = funcNode.params;
  if (!params || params.length === 0) return null;

  const firstParam = params[0];
  const defaults: Record<string, string> = {};
  let typeAnnotation: any = null;

  if (n.ObjectPattern.check(firstParam)) {
    extractDestructuredDefaults(firstParam, defaults);
    typeAnnotation = firstParam.typeAnnotation;
  } else if (n.Identifier.check(firstParam)) {
    typeAnnotation = firstParam.typeAnnotation;
  } else if (n.AssignmentPattern.check(firstParam) && n.ObjectPattern.check(firstParam.left)) {
    extractDestructuredDefaults(firstParam.left, defaults);
    typeAnnotation = firstParam.left.typeAnnotation;
  }

  if (!typeAnnotation) return null;

  const annotation = typeAnnotation.typeAnnotation || typeAnnotation;

  if (n.TSTypeLiteral.check(annotation)) {
    const variants = extractUnionDimensionsFromMembers(annotation.members, defaults);
    if (variants.length > 0) return { baseClasses: "", variants };
  }

  const typeName = extractTypeReferenceName(annotation);
  if (!typeName) return null;

  const typeDecl = findTypeDeclaration(ast, typeName);
  if (!typeDecl) return null;

  const members = getTypeMembers(typeDecl);
  if (!members) return null;

  const variants = extractUnionDimensionsFromMembers(members, defaults);
  if (variants.length === 0) return null;

  return { baseClasses: "", variants };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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
 * Extract variant dimensions from a config ObjectExpression with `variants` and `defaultVariants` properties.
 * Shared by all config-object extractors (CVA, TV, Stitches, Vanilla Extract, PandaCSS).
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
 * Find the variant config variable that matches a component.
 * Supports multiple naming conventions across variant libraries.
 */
function findVariantConfigForComponent(
  componentName: string,
  variantMap: Map<string, VariantExtractionResult>
): string | null {
  const lower = componentName.charAt(0).toLowerCase() + componentName.slice(1);

  // Check naming conventions in priority order
  const candidates = [
    componentName,          // direct match — styled(), TS union on function component
    `${lower}Variants`,     // CVA, PandaCSS convention
    lower,                  // tv() convention
    `${lower}Recipe`,       // Vanilla Extract convention
    `${lower}Styles`,       // general convention
  ];

  for (const candidate of candidates) {
    if (variantMap.has(candidate)) return candidate;
  }

  // Fallback: if there's only one variant definition, use it
  if (variantMap.size === 1) return variantMap.keys().next().value!;

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
