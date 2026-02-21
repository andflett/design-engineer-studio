#!/usr/bin/env node

// src/cli.ts
import fs10 from "fs";
import path8 from "path";
import process from "process";
import open from "open";

// src/server/lib/detect-framework.ts
import fs from "fs/promises";
import path from "path";
async function detectFramework(projectRoot) {
  const pkgPath = path.join(projectRoot, "package.json");
  let pkg = {};
  try {
    pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
  } catch {
  }
  const deps = {
    ...pkg.dependencies,
    ...pkg.devDependencies
  };
  let name = "unknown";
  let appDirCandidates;
  let componentDirCandidates;
  if (deps.next) {
    name = "nextjs";
    appDirCandidates = ["app", "src/app"];
    componentDirCandidates = ["components/ui", "src/components/ui"];
  } else if (deps["@remix-run/react"] || deps["@remix-run/node"]) {
    name = "remix";
    appDirCandidates = ["app/routes", "src/routes"];
    componentDirCandidates = ["components/ui", "app/components/ui", "src/components/ui"];
  } else if (deps.vite) {
    name = "vite";
    appDirCandidates = ["src/pages", "src/routes", "src", "pages"];
    componentDirCandidates = ["components/ui", "src/components/ui"];
  } else {
    appDirCandidates = ["app", "src", "pages"];
    componentDirCandidates = ["components/ui", "src/components/ui"];
  }
  const appResult = await findDir(projectRoot, appDirCandidates);
  const componentResult = await findDir(projectRoot, componentDirCandidates);
  const componentFileCount = componentResult.exists ? await countFiles(projectRoot, componentResult.dir, ".tsx") : 0;
  return {
    name,
    appDir: appResult.dir,
    appDirExists: appResult.exists,
    componentDir: componentResult.dir,
    componentDirExists: componentResult.exists,
    componentFileCount,
    cssFiles: await findCssFiles(projectRoot)
  };
}
async function findDir(root, candidates) {
  for (const candidate of candidates) {
    const full = path.join(root, candidate);
    try {
      const stat = await fs.stat(full);
      if (stat.isDirectory()) return { dir: candidate, exists: true };
    } catch {
    }
  }
  return { dir: candidates[0], exists: false };
}
async function countFiles(root, dir, ext) {
  const full = path.join(root, dir);
  try {
    const entries = await fs.readdir(full);
    return entries.filter((e) => e.endsWith(ext)).length;
  } catch {
    return 0;
  }
}
async function findCssFiles(projectRoot) {
  const candidates = [
    "app/globals.css",
    "src/app/globals.css",
    "app/global.css",
    "src/globals.css",
    "src/index.css",
    "src/app.css",
    "styles/globals.css"
  ];
  const found = [];
  for (const candidate of candidates) {
    try {
      await fs.access(path.join(projectRoot, candidate));
      found.push(candidate);
    } catch {
    }
  }
  return found;
}

// src/server/lib/detect-styling.ts
import fs2 from "fs/promises";
import path2 from "path";
async function detectStylingSystem(projectRoot, framework) {
  const pkgPath = path2.join(projectRoot, "package.json");
  let pkg = {};
  try {
    pkg = JSON.parse(await fs2.readFile(pkgPath, "utf-8"));
  } catch {
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.tailwindcss) {
    const version = deps.tailwindcss;
    const isV4 = version.startsWith("^4") || version.startsWith("~4") || version.startsWith("4");
    if (isV4) {
      const hasDarkMode3 = await checkDarkMode(projectRoot, framework.cssFiles);
      return {
        type: "tailwind-v4",
        cssFiles: framework.cssFiles,
        scssFiles: [],
        hasDarkMode: hasDarkMode3
      };
    }
    const configCandidates = [
      "tailwind.config.ts",
      "tailwind.config.js",
      "tailwind.config.mjs",
      "tailwind.config.cjs"
    ];
    let configPath;
    for (const candidate of configCandidates) {
      try {
        await fs2.access(path2.join(projectRoot, candidate));
        configPath = candidate;
        break;
      } catch {
      }
    }
    const hasDarkMode2 = await checkDarkMode(projectRoot, framework.cssFiles);
    return {
      type: "tailwind-v3",
      configPath,
      cssFiles: framework.cssFiles,
      scssFiles: [],
      hasDarkMode: hasDarkMode2
    };
  }
  if (deps.bootstrap) {
    const hasDarkMode2 = await checkDarkMode(projectRoot, framework.cssFiles);
    const scssFiles = await findBootstrapScssFiles(projectRoot);
    return {
      type: "bootstrap",
      cssFiles: framework.cssFiles,
      scssFiles,
      hasDarkMode: hasDarkMode2
    };
  }
  const hasDarkMode = await checkDarkMode(projectRoot, framework.cssFiles);
  const hasCustomProps = await checkCustomProperties(projectRoot, framework.cssFiles);
  if (hasCustomProps) {
    return {
      type: "css-variables",
      cssFiles: framework.cssFiles,
      scssFiles: [],
      hasDarkMode
    };
  }
  return {
    type: framework.cssFiles.length > 0 ? "plain-css" : "unknown",
    cssFiles: framework.cssFiles,
    scssFiles: [],
    hasDarkMode
  };
}
async function checkDarkMode(projectRoot, cssFiles) {
  for (const file of cssFiles) {
    try {
      const css = await fs2.readFile(path2.join(projectRoot, file), "utf-8");
      if (css.includes(".dark") || css.includes('[data-theme="dark"]') || css.includes("prefers-color-scheme: dark")) {
        return true;
      }
    } catch {
    }
  }
  return false;
}
async function checkCustomProperties(projectRoot, cssFiles) {
  for (const file of cssFiles) {
    try {
      const css = await fs2.readFile(path2.join(projectRoot, file), "utf-8");
      if (/--[\w-]+\s*:/.test(css)) {
        return true;
      }
    } catch {
    }
  }
  return false;
}
async function findBootstrapScssFiles(projectRoot) {
  const candidates = [
    "src/scss/_variables.scss",
    "src/scss/_custom.scss",
    "src/scss/custom.scss",
    "src/styles/_variables.scss",
    "src/styles/variables.scss",
    "assets/scss/_variables.scss",
    "scss/_variables.scss",
    "styles/_variables.scss"
  ];
  const found = [];
  for (const candidate of candidates) {
    try {
      await fs2.access(path2.join(projectRoot, candidate));
      found.push(candidate);
    } catch {
    }
  }
  return found;
}

// src/server/index.ts
import express from "express";
import path7 from "path";
import fs9 from "fs";
import { fileURLToPath } from "url";

// src/server/api/write-element.ts
import { Router } from "express";
import fs3 from "fs/promises";

// src/server/lib/safe-path.ts
import path3 from "path";
function safePath(projectRoot, filePath) {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("File path is required");
  }
  if (path3.isAbsolute(filePath)) {
    throw new Error(
      `Absolute paths are not allowed: "${filePath}". Paths must be relative to the project root.`
    );
  }
  const resolvedRoot = path3.resolve(projectRoot);
  const resolvedPath = path3.resolve(resolvedRoot, filePath);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(resolvedRoot + path3.sep)) {
    throw new Error(
      `Path "${filePath}" resolves outside the project directory. Refusing to write.`
    );
  }
  return resolvedPath;
}

// src/server/lib/ast-helpers.ts
import recast from "recast";
import { namedTypes as n, builders as b } from "ast-types";
var _parser = null;
async function getParser() {
  if (!_parser) {
    _parser = await import("recast/parsers/babel-ts");
  }
  return _parser;
}
function parseSource(source, parser) {
  return recast.parse(source, { parser: parser || getParser() });
}
function printSource(ast) {
  return recast.print(ast).code;
}
function findAttr(openingElement, name) {
  for (const attr of openingElement.attributes || []) {
    if (n.JSXAttribute.check(attr) && n.JSXIdentifier.check(attr.name) && attr.name.name === name) {
      return attr;
    }
  }
  return null;
}
function classBoundaryRegex(cls, flags = "") {
  const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<=^|[\\s"'\`])${escaped}(?=$|[\\s"'\`])`, flags);
}
function replaceClassInAttr(openingElement, oldClass, newClass) {
  const attr = findAttr(openingElement, "className");
  if (!attr) return false;
  if (n.StringLiteral.check(attr.value) || n.Literal.check(attr.value)) {
    const val = attr.value.value;
    const regex = classBoundaryRegex(oldClass);
    if (regex.test(val)) {
      attr.value = b.stringLiteral(val.replace(classBoundaryRegex(oldClass, "g"), newClass));
      return true;
    }
    return false;
  }
  if (n.JSXExpressionContainer.check(attr.value)) {
    return replaceClassInExpression(attr.value.expression, oldClass, newClass);
  }
  return false;
}
function replaceClassInExpression(expr, oldClass, newClass) {
  if (n.StringLiteral.check(expr) || n.Literal.check(expr)) {
    if (typeof expr.value === "string") {
      const regex = classBoundaryRegex(oldClass);
      if (regex.test(expr.value)) {
        expr.value = expr.value.replace(classBoundaryRegex(oldClass, "g"), newClass);
        return true;
      }
    }
    return false;
  }
  if (n.TemplateLiteral.check(expr)) {
    for (const quasi of expr.quasis) {
      const regex = classBoundaryRegex(oldClass);
      if (regex.test(quasi.value.raw)) {
        quasi.value = {
          raw: quasi.value.raw.replace(classBoundaryRegex(oldClass, "g"), newClass),
          cooked: (quasi.value.cooked || quasi.value.raw).replace(classBoundaryRegex(oldClass, "g"), newClass)
        };
        return true;
      }
    }
    return false;
  }
  if (n.CallExpression.check(expr)) {
    for (const arg of expr.arguments) {
      if (replaceClassInExpression(arg, oldClass, newClass)) return true;
    }
    return false;
  }
  if (n.ConditionalExpression.check(expr)) {
    if (replaceClassInExpression(expr.consequent, oldClass, newClass)) return true;
    if (replaceClassInExpression(expr.alternate, oldClass, newClass)) return true;
    return false;
  }
  if (n.LogicalExpression.check(expr)) {
    if (replaceClassInExpression(expr.left, oldClass, newClass)) return true;
    if (replaceClassInExpression(expr.right, oldClass, newClass)) return true;
    return false;
  }
  if (n.ArrayExpression.check(expr)) {
    for (const el of expr.elements) {
      if (el && replaceClassInExpression(el, oldClass, newClass)) return true;
    }
    return false;
  }
  return false;
}
function appendClassToAttr(openingElement, newClass) {
  const attr = findAttr(openingElement, "className");
  if (!attr) return false;
  if (n.StringLiteral.check(attr.value) || n.Literal.check(attr.value)) {
    const val = attr.value.value;
    attr.value = b.stringLiteral(val + " " + newClass);
    return true;
  }
  if (n.JSXExpressionContainer.check(attr.value)) {
    return appendClassToExpression(attr.value.expression, newClass);
  }
  return false;
}
function appendClassToExpression(expr, newClass) {
  if (n.StringLiteral.check(expr) || n.Literal.check(expr)) {
    if (typeof expr.value === "string") {
      expr.value = expr.value + " " + newClass;
      return true;
    }
    return false;
  }
  if (n.TemplateLiteral.check(expr)) {
    const last = expr.quasis[expr.quasis.length - 1];
    if (last) {
      last.value = {
        raw: last.value.raw + " " + newClass,
        cooked: (last.value.cooked || last.value.raw) + " " + newClass
      };
      return true;
    }
    return false;
  }
  if (n.CallExpression.check(expr)) {
    for (const arg of expr.arguments) {
      if ((n.StringLiteral.check(arg) || n.Literal.check(arg)) && typeof arg.value === "string") {
        arg.value = arg.value + " " + newClass;
        return true;
      }
    }
    return false;
  }
  return false;
}
function addClassNameAttr(openingElement, className) {
  openingElement.attributes.push(
    b.jsxAttribute(
      b.jsxIdentifier("className"),
      b.stringLiteral(className)
    )
  );
}

// src/server/lib/find-element.ts
import { visit } from "recast";
function findElementAtSource(ast, line, col) {
  let found = null;
  visit(ast, {
    visitJSXOpeningElement(path9) {
      const loc = path9.node.loc;
      if (loc && loc.start.line === line && loc.start.column === col) {
        found = path9;
        return false;
      }
      this.traverse(path9);
    }
  });
  return found;
}

// src/shared/tailwind-map.ts
var REVERSE_MAP = {
  // Font size
  "font-size": {
    "12px": "text-xs",
    "0.75rem": "text-xs",
    "14px": "text-sm",
    "0.875rem": "text-sm",
    "16px": "text-base",
    "1rem": "text-base",
    "18px": "text-lg",
    "1.125rem": "text-lg",
    "20px": "text-xl",
    "1.25rem": "text-xl",
    "24px": "text-2xl",
    "1.5rem": "text-2xl",
    "30px": "text-3xl",
    "1.875rem": "text-3xl",
    "36px": "text-4xl",
    "2.25rem": "text-4xl",
    "48px": "text-5xl",
    "3rem": "text-5xl",
    "60px": "text-6xl",
    "3.75rem": "text-6xl",
    "72px": "text-7xl",
    "4.5rem": "text-7xl",
    "96px": "text-8xl",
    "6rem": "text-8xl",
    "128px": "text-9xl",
    "8rem": "text-9xl"
  },
  // Font weight
  "font-weight": {
    "100": "font-thin",
    "200": "font-extralight",
    "300": "font-light",
    "400": "font-normal",
    "500": "font-medium",
    "600": "font-semibold",
    "700": "font-bold",
    "800": "font-extrabold",
    "900": "font-black"
  },
  // Line height
  "line-height": {
    "1": "leading-none",
    "1.25": "leading-tight",
    "1.375": "leading-snug",
    "1.5": "leading-normal",
    "1.625": "leading-relaxed",
    "2": "leading-loose"
  },
  // Letter spacing
  "letter-spacing": {
    "-0.05em": "tracking-tighter",
    "-0.025em": "tracking-tight",
    "0em": "tracking-normal",
    "0px": "tracking-normal",
    "0.025em": "tracking-wide",
    "0.05em": "tracking-wider",
    "0.1em": "tracking-widest"
  },
  // Text align
  "text-align": {
    "left": "text-left",
    "start": "text-left",
    "center": "text-center",
    "right": "text-right",
    "end": "text-right",
    "justify": "text-justify"
  },
  // Text transform
  "text-transform": {
    "uppercase": "uppercase",
    "lowercase": "lowercase",
    "capitalize": "capitalize",
    "none": "normal-case"
  },
  // Display
  "display": {
    "block": "block",
    "inline-block": "inline-block",
    "inline": "inline",
    "flex": "flex",
    "inline-flex": "inline-flex",
    "grid": "grid",
    "inline-grid": "inline-grid",
    "none": "hidden"
  },
  // Position
  "position": {
    "static": "static",
    "relative": "relative",
    "absolute": "absolute",
    "fixed": "fixed",
    "sticky": "sticky"
  },
  // Flex direction
  "flex-direction": {
    "row": "flex-row",
    "row-reverse": "flex-row-reverse",
    "column": "flex-col",
    "column-reverse": "flex-col-reverse"
  },
  // Flex wrap
  "flex-wrap": {
    "wrap": "flex-wrap",
    "nowrap": "flex-nowrap",
    "wrap-reverse": "flex-wrap-reverse"
  },
  // Justify content
  "justify-content": {
    "flex-start": "justify-start",
    "start": "justify-start",
    "flex-end": "justify-end",
    "end": "justify-end",
    "center": "justify-center",
    "space-between": "justify-between",
    "space-around": "justify-around",
    "space-evenly": "justify-evenly"
  },
  // Align items
  "align-items": {
    "flex-start": "items-start",
    "start": "items-start",
    "flex-end": "items-end",
    "end": "items-end",
    "center": "items-center",
    "baseline": "items-baseline",
    "stretch": "items-stretch"
  },
  // Align self
  "align-self": {
    "auto": "self-auto",
    "flex-start": "self-start",
    "start": "self-start",
    "flex-end": "self-end",
    "end": "self-end",
    "center": "self-center",
    "stretch": "self-stretch"
  },
  // Overflow
  "overflow": {
    "visible": "overflow-visible",
    "hidden": "overflow-hidden",
    "scroll": "overflow-scroll",
    "auto": "overflow-auto"
  },
  // Opacity
  "opacity": {
    "0": "opacity-0",
    "0.05": "opacity-5",
    "0.1": "opacity-10",
    "0.15": "opacity-15",
    "0.2": "opacity-20",
    "0.25": "opacity-25",
    "0.3": "opacity-30",
    "0.35": "opacity-35",
    "0.4": "opacity-40",
    "0.45": "opacity-45",
    "0.5": "opacity-50",
    "0.55": "opacity-55",
    "0.6": "opacity-60",
    "0.65": "opacity-65",
    "0.7": "opacity-70",
    "0.75": "opacity-75",
    "0.8": "opacity-80",
    "0.85": "opacity-85",
    "0.9": "opacity-90",
    "0.95": "opacity-95",
    "1": "opacity-100"
  }
};
var SPACING_PX_MAP = {
  "0px": "0",
  "1px": "px",
  "2px": "0.5",
  "4px": "1",
  "6px": "1.5",
  "8px": "2",
  "10px": "2.5",
  "12px": "3",
  "14px": "3.5",
  "16px": "4",
  "20px": "5",
  "24px": "6",
  "28px": "7",
  "32px": "8",
  "36px": "9",
  "40px": "10",
  "44px": "11",
  "48px": "12",
  "56px": "14",
  "64px": "16",
  "80px": "20",
  "96px": "24",
  "112px": "28",
  "128px": "32",
  "144px": "36",
  "160px": "40",
  "176px": "44",
  "192px": "48",
  "208px": "52",
  "224px": "56",
  "240px": "60",
  "256px": "64",
  "288px": "72",
  "320px": "80",
  "384px": "96"
};
var RADIUS_MAP = {
  "0px": "rounded-none",
  "2px": "rounded-sm",
  "0.125rem": "rounded-sm",
  "4px": "rounded",
  "0.25rem": "rounded",
  "6px": "rounded-md",
  "0.375rem": "rounded-md",
  "8px": "rounded-lg",
  "0.5rem": "rounded-lg",
  "12px": "rounded-xl",
  "0.75rem": "rounded-xl",
  "16px": "rounded-2xl",
  "1rem": "rounded-2xl",
  "24px": "rounded-3xl",
  "1.5rem": "rounded-3xl",
  "9999px": "rounded-full"
};
var CSS_TO_TW_PREFIX = {
  "padding-top": "pt",
  "padding-right": "pr",
  "padding-bottom": "pb",
  "padding-left": "pl",
  "margin-top": "mt",
  "margin-right": "mr",
  "margin-bottom": "mb",
  "margin-left": "ml",
  "gap": "gap",
  "row-gap": "gap-y",
  "column-gap": "gap-x",
  "width": "w",
  "height": "h",
  "min-width": "min-w",
  "min-height": "min-h",
  "max-width": "max-w",
  "max-height": "max-h",
  "top": "top",
  "right": "right",
  "bottom": "bottom",
  "left": "left",
  "border-top-width": "border-t",
  "border-right-width": "border-r",
  "border-bottom-width": "border-b",
  "border-left-width": "border-l",
  "border-top-left-radius": "rounded-tl",
  "border-top-right-radius": "rounded-tr",
  "border-bottom-right-radius": "rounded-br",
  "border-bottom-left-radius": "rounded-bl",
  "font-size": "text",
  "font-weight": "font",
  "line-height": "leading",
  "letter-spacing": "tracking",
  "opacity": "opacity",
  "color": "text",
  "background-color": "bg",
  "border-color": "border"
};
var SPACING_PROPS = /* @__PURE__ */ new Set([
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "gap",
  "row-gap",
  "column-gap",
  "top",
  "right",
  "bottom",
  "left",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height"
]);
var RADIUS_PROPS = /* @__PURE__ */ new Set([
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius"
]);
function computedToTailwindClass(cssProp, computedValue) {
  const directMap = REVERSE_MAP[cssProp];
  if (directMap?.[computedValue]) {
    return { tailwindClass: directMap[computedValue], exact: true };
  }
  if (SPACING_PROPS.has(cssProp)) {
    const scaleVal = SPACING_PX_MAP[computedValue];
    const prefix2 = CSS_TO_TW_PREFIX[cssProp];
    if (scaleVal && prefix2) {
      return { tailwindClass: `${prefix2}-${scaleVal}`, exact: true };
    }
    if (prefix2 && computedValue !== "auto" && computedValue !== "none") {
      return { tailwindClass: `${prefix2}-[${computedValue}]`, exact: false };
    }
  }
  if (RADIUS_PROPS.has(cssProp)) {
    const radiusClass = RADIUS_MAP[computedValue];
    if (radiusClass) {
      const prefix3 = CSS_TO_TW_PREFIX[cssProp];
      if (prefix3) {
        const suffix = radiusClass.replace("rounded", "");
        return { tailwindClass: `${prefix3}${suffix || ""}`, exact: true };
      }
      return { tailwindClass: radiusClass, exact: true };
    }
    const prefix2 = CSS_TO_TW_PREFIX[cssProp];
    if (prefix2 && computedValue !== "0px") {
      return { tailwindClass: `${prefix2}-[${computedValue}]`, exact: false };
    }
  }
  const prefix = CSS_TO_TW_PREFIX[cssProp];
  if (prefix) {
    return { tailwindClass: `${prefix}-[${computedValue}]`, exact: false };
  }
  return null;
}

// src/shared/tailwind-parser.ts
var CLASS_PATTERNS = [
  // Colors
  { regex: /^bg-([\w-]+(?:\/\d+)?)$/, category: "color", property: "backgroundColor", label: "Background", extractValue: (m) => m[1] },
  { regex: /^text-([\w-]+(?:\/\d+)?)$/, category: "color", property: "textColor", label: "Text", extractValue: (m) => m[1] },
  { regex: /^border-([\w-]+(?:\/\d+)?)$/, category: "color", property: "borderColor", label: "Border", extractValue: (m) => m[1] },
  { regex: /^ring-([\w-]+(?:\/\d+)?)$/, category: "color", property: "ringColor", label: "Ring", extractValue: (m) => m[1] },
  { regex: /^outline-([\w-]+(?:\/\d+)?)$/, category: "color", property: "outlineColor", label: "Outline", extractValue: (m) => m[1] },
  // Spacing
  { regex: /^p-([\d.]+|px)$/, category: "spacing", property: "padding", label: "Padding", extractValue: (m) => m[1] },
  { regex: /^px-([\d.]+|px)$/, category: "spacing", property: "paddingX", label: "Padding X", extractValue: (m) => m[1] },
  { regex: /^py-([\d.]+|px)$/, category: "spacing", property: "paddingY", label: "Padding Y", extractValue: (m) => m[1] },
  { regex: /^pt-([\d.]+|px)$/, category: "spacing", property: "paddingTop", label: "Padding Top", extractValue: (m) => m[1] },
  { regex: /^pr-([\d.]+|px)$/, category: "spacing", property: "paddingRight", label: "Padding Right", extractValue: (m) => m[1] },
  { regex: /^pb-([\d.]+|px)$/, category: "spacing", property: "paddingBottom", label: "Padding Bottom", extractValue: (m) => m[1] },
  { regex: /^pl-([\d.]+|px)$/, category: "spacing", property: "paddingLeft", label: "Padding Left", extractValue: (m) => m[1] },
  { regex: /^m-([\d.]+|px|auto)$/, category: "spacing", property: "margin", label: "Margin", extractValue: (m) => m[1] },
  { regex: /^mx-([\d.]+|px|auto)$/, category: "spacing", property: "marginX", label: "Margin X", extractValue: (m) => m[1] },
  { regex: /^my-([\d.]+|px|auto)$/, category: "spacing", property: "marginY", label: "Margin Y", extractValue: (m) => m[1] },
  { regex: /^mt-([\d.]+|px|auto)$/, category: "spacing", property: "marginTop", label: "Margin Top", extractValue: (m) => m[1] },
  { regex: /^mr-([\d.]+|px|auto)$/, category: "spacing", property: "marginRight", label: "Margin Right", extractValue: (m) => m[1] },
  { regex: /^mb-([\d.]+|px|auto)$/, category: "spacing", property: "marginBottom", label: "Margin Bottom", extractValue: (m) => m[1] },
  { regex: /^ml-([\d.]+|px|auto)$/, category: "spacing", property: "marginLeft", label: "Margin Left", extractValue: (m) => m[1] },
  { regex: /^gap-([\d.]+|px)$/, category: "spacing", property: "gap", label: "Gap", extractValue: (m) => m[1] },
  { regex: /^gap-x-([\d.]+|px)$/, category: "spacing", property: "gapX", label: "Gap X", extractValue: (m) => m[1] },
  { regex: /^gap-y-([\d.]+|px)$/, category: "spacing", property: "gapY", label: "Gap Y", extractValue: (m) => m[1] },
  { regex: /^space-x-([\d.]+)$/, category: "spacing", property: "spaceX", label: "Space X", extractValue: (m) => m[1] },
  { regex: /^space-y-([\d.]+)$/, category: "spacing", property: "spaceY", label: "Space Y", extractValue: (m) => m[1] },
  // Shape
  { regex: /^rounded$/, category: "shape", property: "borderRadius", label: "Radius", extractValue: () => "DEFAULT" },
  { regex: /^rounded-(none|sm|md|lg|xl|2xl|3xl|full)$/, category: "shape", property: "borderRadius", label: "Radius", extractValue: (m) => m[1] },
  { regex: /^border$/, category: "shape", property: "borderWidth", label: "Border Width", extractValue: () => "1" },
  { regex: /^border-(0|2|4|8)$/, category: "shape", property: "borderWidth", label: "Border Width", extractValue: (m) => m[1] },
  // Typography
  { regex: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/, category: "typography", property: "fontSize", label: "Font Size", extractValue: (m) => m[1] },
  { regex: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/, category: "typography", property: "fontWeight", label: "Font Weight", extractValue: (m) => m[1] },
  { regex: /^leading-(none|tight|snug|normal|relaxed|loose)$/, category: "typography", property: "lineHeight", label: "Line Height", extractValue: (m) => m[1] },
  { regex: /^tracking-(tighter|tight|normal|wide|wider|widest)$/, category: "typography", property: "letterSpacing", label: "Letter Spacing", extractValue: (m) => m[1] },
  { regex: /^font-(sans|serif|mono)$/, category: "typography", property: "fontFamily", label: "Font Family", extractValue: (m) => m[1] },
  { regex: /^text-(left|center|right|justify)$/, category: "typography", property: "textAlign", label: "Text Align", extractValue: (m) => m[1] },
  { regex: /^(uppercase|lowercase|capitalize|normal-case)$/, category: "typography", property: "textTransform", label: "Text Transform", extractValue: (m) => m[1] },
  { regex: /^(underline|overline|line-through|no-underline)$/, category: "typography", property: "textDecoration", label: "Text Decoration", extractValue: (m) => m[1] },
  { regex: /^(truncate|whitespace-nowrap|whitespace-normal)$/, category: "typography", property: "overflow", label: "Overflow", extractValue: (m) => m[1] },
  // Layout
  { regex: /^(flex|inline-flex|grid|inline-grid|block|inline-block|inline|hidden)$/, category: "layout", property: "display", label: "Display", extractValue: (m) => m[1] },
  { regex: /^(flex-row|flex-col|flex-row-reverse|flex-col-reverse)$/, category: "layout", property: "flexDirection", label: "Direction", extractValue: (m) => m[1] },
  { regex: /^(flex-wrap|flex-nowrap|flex-wrap-reverse)$/, category: "layout", property: "flexWrap", label: "Wrap", extractValue: (m) => m[1] },
  { regex: /^items-(start|end|center|baseline|stretch)$/, category: "layout", property: "alignItems", label: "Align Items", extractValue: (m) => m[1] },
  { regex: /^justify-(start|end|center|between|around|evenly)$/, category: "layout", property: "justifyContent", label: "Justify", extractValue: (m) => m[1] },
  { regex: /^(self-auto|self-start|self-end|self-center|self-stretch)$/, category: "layout", property: "alignSelf", label: "Align Self", extractValue: (m) => m[1] },
  { regex: /^grid-cols-(\d+|none)$/, category: "layout", property: "gridCols", label: "Grid Columns", extractValue: (m) => m[1] },
  { regex: /^grid-rows-(\d+|none)$/, category: "layout", property: "gridRows", label: "Grid Rows", extractValue: (m) => m[1] },
  { regex: /^col-span-(\d+|full)$/, category: "layout", property: "colSpan", label: "Column Span", extractValue: (m) => m[1] },
  { regex: /^row-span-(\d+)$/, category: "layout", property: "rowSpan", label: "Row Span", extractValue: (m) => m[1] },
  { regex: /^(relative|absolute|fixed|sticky)$/, category: "layout", property: "position", label: "Position", extractValue: (m) => m[1] },
  { regex: /^(overflow-hidden|overflow-auto|overflow-scroll|overflow-visible)$/, category: "layout", property: "overflow", label: "Overflow", extractValue: (m) => m[1] },
  // Size
  { regex: /^w-([\d.]+|full|screen|auto|min|max|fit|px)$/, category: "size", property: "width", label: "Width", extractValue: (m) => m[1] },
  { regex: /^h-([\d.]+|full|screen|auto|min|max|fit|px)$/, category: "size", property: "height", label: "Height", extractValue: (m) => m[1] },
  { regex: /^min-w-([\d.]+|full|min|max|fit|0)$/, category: "size", property: "minWidth", label: "Min Width", extractValue: (m) => m[1] },
  { regex: /^min-h-([\d.]+|full|screen|min|max|fit|0)$/, category: "size", property: "minHeight", label: "Min Height", extractValue: (m) => m[1] },
  { regex: /^max-w-([\w.]+)$/, category: "size", property: "maxWidth", label: "Max Width", extractValue: (m) => m[1] },
  { regex: /^max-h-([\w.]+)$/, category: "size", property: "maxHeight", label: "Max Height", extractValue: (m) => m[1] },
  { regex: /^size-([\d.]+|full|auto|px)$/, category: "size", property: "size", label: "Size", extractValue: (m) => m[1] },
  { regex: /^(flex-1|flex-auto|flex-initial|flex-none)$/, category: "size", property: "flex", label: "Flex", extractValue: (m) => m[1] },
  { regex: /^(grow|grow-0|shrink|shrink-0)$/, category: "size", property: "flexGrowShrink", label: "Grow/Shrink", extractValue: (m) => m[1] },
  // Arbitrary values
  { regex: /^text-\[(-?[\w.%]+)\]$/, category: "typography", property: "fontSize", label: "Font Size", extractValue: (m) => `[${m[1]}]` },
  { regex: /^leading-\[(-?[\w.%]+)\]$/, category: "typography", property: "lineHeight", label: "Line Height", extractValue: (m) => `[${m[1]}]` },
  { regex: /^tracking-\[(-?[\w.%]+)\]$/, category: "typography", property: "letterSpacing", label: "Letter Spacing", extractValue: (m) => `[${m[1]}]` },
  { regex: /^font-\[(-?[\w.%]+)\]$/, category: "typography", property: "fontWeight", label: "Font Weight", extractValue: (m) => `[${m[1]}]` },
  { regex: /^p-\[(-?[\w.%]+)\]$/, category: "spacing", property: "padding", label: "Padding", extractValue: (m) => `[${m[1]}]` },
  { regex: /^px-\[(-?[\w.%]+)\]$/, category: "spacing", property: "paddingX", label: "Padding X", extractValue: (m) => `[${m[1]}]` },
  { regex: /^py-\[(-?[\w.%]+)\]$/, category: "spacing", property: "paddingY", label: "Padding Y", extractValue: (m) => `[${m[1]}]` },
  { regex: /^pt-\[(-?[\w.%]+)\]$/, category: "spacing", property: "paddingTop", label: "Padding Top", extractValue: (m) => `[${m[1]}]` },
  { regex: /^pr-\[(-?[\w.%]+)\]$/, category: "spacing", property: "paddingRight", label: "Padding Right", extractValue: (m) => `[${m[1]}]` },
  { regex: /^pb-\[(-?[\w.%]+)\]$/, category: "spacing", property: "paddingBottom", label: "Padding Bottom", extractValue: (m) => `[${m[1]}]` },
  { regex: /^pl-\[(-?[\w.%]+)\]$/, category: "spacing", property: "paddingLeft", label: "Padding Left", extractValue: (m) => `[${m[1]}]` },
  { regex: /^m-\[(-?[\w.%]+)\]$/, category: "spacing", property: "margin", label: "Margin", extractValue: (m) => `[${m[1]}]` },
  { regex: /^mx-\[(-?[\w.%]+)\]$/, category: "spacing", property: "marginX", label: "Margin X", extractValue: (m) => `[${m[1]}]` },
  { regex: /^my-\[(-?[\w.%]+)\]$/, category: "spacing", property: "marginY", label: "Margin Y", extractValue: (m) => `[${m[1]}]` },
  { regex: /^mt-\[(-?[\w.%]+)\]$/, category: "spacing", property: "marginTop", label: "Margin Top", extractValue: (m) => `[${m[1]}]` },
  { regex: /^mr-\[(-?[\w.%]+)\]$/, category: "spacing", property: "marginRight", label: "Margin Right", extractValue: (m) => `[${m[1]}]` },
  { regex: /^mb-\[(-?[\w.%]+)\]$/, category: "spacing", property: "marginBottom", label: "Margin Bottom", extractValue: (m) => `[${m[1]}]` },
  { regex: /^ml-\[(-?[\w.%]+)\]$/, category: "spacing", property: "marginLeft", label: "Margin Left", extractValue: (m) => `[${m[1]}]` },
  { regex: /^gap-\[(-?[\w.%]+)\]$/, category: "spacing", property: "gap", label: "Gap", extractValue: (m) => `[${m[1]}]` },
  { regex: /^gap-x-\[(-?[\w.%]+)\]$/, category: "spacing", property: "gapX", label: "Gap X", extractValue: (m) => `[${m[1]}]` },
  { regex: /^gap-y-\[(-?[\w.%]+)\]$/, category: "spacing", property: "gapY", label: "Gap Y", extractValue: (m) => `[${m[1]}]` },
  { regex: /^w-\[(-?[\w.%]+)\]$/, category: "size", property: "width", label: "Width", extractValue: (m) => `[${m[1]}]` },
  { regex: /^h-\[(-?[\w.%]+)\]$/, category: "size", property: "height", label: "Height", extractValue: (m) => `[${m[1]}]` },
  { regex: /^min-w-\[(-?[\w.%]+)\]$/, category: "size", property: "minWidth", label: "Min Width", extractValue: (m) => `[${m[1]}]` },
  { regex: /^min-h-\[(-?[\w.%]+)\]$/, category: "size", property: "minHeight", label: "Min Height", extractValue: (m) => `[${m[1]}]` },
  { regex: /^max-w-\[(-?[\w.%]+)\]$/, category: "size", property: "maxWidth", label: "Max Width", extractValue: (m) => `[${m[1]}]` },
  { regex: /^max-h-\[(-?[\w.%]+)\]$/, category: "size", property: "maxHeight", label: "Max Height", extractValue: (m) => `[${m[1]}]` },
  { regex: /^rounded-\[(-?[\w.%]+)\]$/, category: "shape", property: "borderRadius", label: "Radius", extractValue: (m) => `[${m[1]}]` }
];
function stripPrefix(cls) {
  const parts = cls.split(":");
  if (parts.length === 1) return { prefix: void 0, core: cls };
  const core = parts.pop();
  const prefix = parts.join(":") + ":";
  return { prefix, core };
}
function parseClasses(classString) {
  const result = {
    color: [],
    spacing: [],
    shape: [],
    typography: [],
    layout: [],
    size: [],
    other: []
  };
  const classes = classString.split(/\s+/).filter(Boolean);
  for (const cls of classes) {
    const { prefix, core } = stripPrefix(cls);
    let matched = false;
    for (const pattern of CLASS_PATTERNS) {
      const match = core.match(pattern.regex);
      if (match) {
        if (pattern.property === "textColor") {
          const sizeValues = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"];
          if (sizeValues.includes(match[1])) continue;
          const alignValues = ["left", "center", "right", "justify"];
          if (alignValues.includes(match[1])) continue;
        }
        if (pattern.property === "borderColor") {
          const widthValues = ["0", "2", "4", "8"];
          if (widthValues.includes(match[1])) continue;
        }
        result[pattern.category].push({
          category: pattern.category,
          property: pattern.property,
          label: pattern.label,
          value: pattern.extractValue(match),
          fullClass: cls,
          prefix
        });
        matched = true;
        break;
      }
    }
    if (!matched) {
      result.other.push({
        category: "other",
        property: "unknown",
        label: cls,
        value: cls,
        fullClass: cls,
        prefix
      });
    }
  }
  return result;
}

// src/server/api/write-element.ts
var CSS_TO_PARSER_PROP = {
  "padding-top": "paddingTop",
  "padding-right": "paddingRight",
  "padding-bottom": "paddingBottom",
  "padding-left": "paddingLeft",
  "margin-top": "marginTop",
  "margin-right": "marginRight",
  "margin-bottom": "marginBottom",
  "margin-left": "marginLeft",
  "gap": "gap",
  "row-gap": "gapY",
  "column-gap": "gapX",
  "width": "width",
  "height": "height",
  "min-width": "minWidth",
  "min-height": "minHeight",
  "max-width": "maxWidth",
  "max-height": "maxHeight",
  "font-size": "fontSize",
  "font-weight": "fontWeight",
  "line-height": "lineHeight",
  "letter-spacing": "letterSpacing",
  "text-align": "textAlign",
  "text-transform": "textTransform",
  "display": "display",
  "position": "position",
  "flex-direction": "flexDirection",
  "flex-wrap": "flexWrap",
  "align-items": "alignItems",
  "justify-content": "justifyContent",
  "color": "textColor",
  "background-color": "backgroundColor",
  "border-color": "borderColor",
  "border-top-left-radius": "borderRadius",
  "border-top-right-radius": "borderRadius",
  "border-bottom-right-radius": "borderRadius",
  "border-bottom-left-radius": "borderRadius"
};
function createWriteElementRouter(config) {
  const router = Router();
  router.post("/", async (req, res) => {
    try {
      const body = req.body;
      if (!body.source) {
        res.status(400).json({ error: "Missing source" });
        return;
      }
      if (body.type === "replaceClass" || body.type === "addClass") {
        const fullPath2 = safePath(config.projectRoot, body.source.file);
        const parser2 = await getParser();
        const source2 = await fs3.readFile(fullPath2, "utf-8");
        const ast2 = parseSource(source2, parser2);
        const elementPath2 = findElementAtSource(ast2, body.source.line, body.source.col);
        if (!elementPath2) {
          res.status(404).json({
            error: `Element not found at ${body.source.file}:${body.source.line}:${body.source.col}`
          });
          return;
        }
        const openingElement2 = elementPath2.node;
        const classAttr2 = findAttr(openingElement2, "className");
        if (body.type === "replaceClass" && body.oldClass && body.newClass) {
          if (classAttr2) {
            replaceClassInAttr(openingElement2, body.oldClass, body.newClass);
          }
        } else if (body.type === "addClass" && body.newClass) {
          if (classAttr2) {
            appendClassToAttr(openingElement2, body.newClass);
          } else {
            addClassNameAttr(openingElement2, body.newClass);
          }
        }
        const output2 = printSource(ast2);
        await fs3.writeFile(fullPath2, output2, "utf-8");
        res.json({ ok: true });
        return;
      }
      if (!body.changes || body.changes.length === 0) {
        res.status(400).json({ error: "Missing changes" });
        return;
      }
      const fullPath = safePath(config.projectRoot, body.source.file);
      const parser = await getParser();
      const source = await fs3.readFile(fullPath, "utf-8");
      const ast = parseSource(source, parser);
      const elementPath = findElementAtSource(ast, body.source.line, body.source.col);
      if (!elementPath) {
        res.status(404).json({
          error: `Element not found at ${body.source.file}:${body.source.line}:${body.source.col}`
        });
        return;
      }
      const openingElement = elementPath.node;
      const classAttr = findAttr(openingElement, "className");
      const currentClassName = classAttr ? classAttr.value?.value || "" : "";
      for (const change of body.changes) {
        let newClass;
        if (change.hint?.tailwindClass) {
          newClass = change.hint.tailwindClass;
        } else {
          const match = computedToTailwindClass(change.property, change.value);
          if (!match) continue;
          newClass = match.tailwindClass;
        }
        const parserProp = CSS_TO_PARSER_PROP[change.property];
        let existingClass = null;
        if (parserProp && currentClassName) {
          const parsed = parseClasses(currentClassName);
          const allParsed = [
            ...parsed.color,
            ...parsed.spacing,
            ...parsed.shape,
            ...parsed.typography,
            ...parsed.layout,
            ...parsed.size
          ];
          const match = allParsed.find((p) => p.property === parserProp);
          if (match) {
            existingClass = match.fullClass;
          }
        }
        if (existingClass) {
          replaceClassInAttr(openingElement, existingClass, newClass);
        } else if (classAttr) {
          appendClassToAttr(openingElement, newClass);
        } else {
          addClassNameAttr(openingElement, newClass);
        }
      }
      const output = printSource(ast);
      await fs3.writeFile(fullPath, output, "utf-8");
      res.json({ ok: true });
    } catch (err) {
      console.error("[write-element]", err.message);
      res.status(500).json({ error: err.message });
    }
  });
  return router;
}

// src/server/api/write-tokens.ts
import { Router as Router2 } from "express";
import fs4 from "fs/promises";
function createTokensRouter(projectRoot) {
  const router = Router2();
  router.post("/", async (req, res) => {
    try {
      const { filePath, token, value, selector } = req.body;
      const fullPath = safePath(projectRoot, filePath);
      let css = await fs4.readFile(fullPath, "utf-8");
      css = replaceTokenInBlock(css, selector, token, value);
      await fs4.writeFile(fullPath, css, "utf-8");
      res.json({ ok: true, filePath, token, value });
    } catch (err) {
      console.error("Token write error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  return router;
}
function replaceTokenInBlock(css, selector, token, newValue) {
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
  const tokenEscaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenRegex = new RegExp(
    `(${tokenEscaped}\\s*:\\s*)([^;]+)(;)`,
    "g"
  );
  if (!tokenRegex.test(block)) {
    throw new Error(`Token "${token}" not found in "${selector}" block`);
  }
  block = block.replace(tokenRegex, `$1${newValue}$3`);
  return css.slice(0, openBrace + 1) + block + css.slice(blockEnd - 1);
}

// src/server/api/write-component.ts
import { Router as Router3 } from "express";
import fs5 from "fs/promises";
function createComponentRouter(projectRoot) {
  const router = Router3();
  router.post("/", async (req, res) => {
    try {
      const { filePath, oldClass, newClass, variantContext } = req.body;
      const fullPath = safePath(projectRoot, filePath);
      let source = await fs5.readFile(fullPath, "utf-8");
      source = replaceClassInComponent(source, oldClass, newClass, variantContext);
      await fs5.writeFile(fullPath, source, "utf-8");
      res.json({ ok: true, filePath, oldClass, newClass });
    } catch (err) {
      console.error("Component write error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  return router;
}
function replaceClassInComponent(source, oldClass, newClass, variantContext) {
  if (variantContext) {
    const variantIndex = source.indexOf(`${variantContext}:`);
    if (variantIndex === -1) {
      const quotedIndex = source.indexOf(`"${variantContext}":`);
      if (quotedIndex === -1) {
        throw new Error(`Variant context "${variantContext}" not found`);
      }
    }
  }
  const oldClassEscaped = oldClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const classRegex = new RegExp(
    `(["'\`][^"'\`]*?)\\b${oldClassEscaped}\\b([^"'\`]*?["'\`])`,
    "g"
  );
  let replaced = false;
  if (variantContext) {
    const variantPattern = new RegExp(
      `(${variantContext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"\\s]*:[\\s]*)(["'\`])([^"'\`]*?)\\b${oldClassEscaped}\\b([^"'\`]*?)(\\2)`,
      "g"
    );
    if (variantPattern.test(source)) {
      source = source.replace(
        variantPattern,
        `$1$2$3${newClass}$4$5`
      );
      replaced = true;
    }
    if (!replaced) {
      const quotedVariantPattern = new RegExp(
        `(["']${variantContext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']\\s*:\\s*)(["'\`])([^"'\`]*?)\\b${oldClassEscaped}\\b([^"'\`]*?)(\\2)`,
        "g"
      );
      if (quotedVariantPattern.test(source)) {
        source = source.replace(
          quotedVariantPattern,
          `$1$2$3${newClass}$4$5`
        );
        replaced = true;
      }
    }
  }
  if (!replaced) {
    const count = (source.match(classRegex) || []).length;
    if (count === 0) {
      throw new Error(
        `Class "${oldClass}" not found in component file`
      );
    }
    if (count > 1 && !variantContext) {
      throw new Error(
        `Class "${oldClass}" found ${count} times. Provide variantContext to narrow.`
      );
    }
    source = source.replace(classRegex, `$1${newClass}$2`);
  }
  return source;
}

// src/server/lib/scanner.ts
import { Router as Router4 } from "express";
import fs8 from "fs/promises";
import path6 from "path";

// src/server/lib/scan-tokens.ts
import fs6 from "fs/promises";
import path4 from "path";
async function scanTokens(projectRoot, framework) {
  if (framework.cssFiles.length === 0) {
    return { tokens: [], cssFilePath: "", groups: {} };
  }
  const cssFilePath = framework.cssFiles[0];
  const fullPath = path4.join(projectRoot, cssFilePath);
  const css = await fs6.readFile(fullPath, "utf-8");
  const rootTokens = parseBlock(css, ":root");
  const darkTokens = parseBlock(css, ".dark");
  const tokenMap = /* @__PURE__ */ new Map();
  for (const [name, value] of rootTokens) {
    const def = {
      name,
      category: categorizeToken(name, value),
      group: getTokenGroup(name),
      lightValue: value,
      darkValue: darkTokens.get(name) || "",
      colorFormat: detectColorFormat(value)
    };
    tokenMap.set(name, def);
  }
  for (const [name, value] of darkTokens) {
    if (!tokenMap.has(name)) {
      tokenMap.set(name, {
        name,
        category: categorizeToken(name, value),
        group: getTokenGroup(name),
        lightValue: "",
        darkValue: value,
        colorFormat: detectColorFormat(value)
      });
    }
  }
  const tokens = Array.from(tokenMap.values());
  const groups = {};
  for (const token of tokens) {
    if (!groups[token.group]) groups[token.group] = [];
    groups[token.group].push(token);
  }
  return { tokens, cssFilePath, groups };
}
function parseBlock(css, selector) {
  const tokens = /* @__PURE__ */ new Map();
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
  const propRegex = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = propRegex.exec(block)) !== null) {
    tokens.set(match[1], match[2].trim());
  }
  return tokens;
}
function categorizeToken(name, value) {
  if (value.includes("oklch") || value.includes("hsl") || value.includes("rgb") || value.startsWith("#")) {
    return "color";
  }
  if (name.includes("radius")) return "radius";
  if (name.includes("shadow")) return "shadow";
  if (name.includes("spacing")) return "spacing";
  if (name.includes("font") || name.includes("text") || name.includes("tracking") || name.includes("leading")) {
    return "typography";
  }
  if (value.endsWith("rem") || value.endsWith("px") || value.endsWith("em")) {
    if (name.includes("radius")) return "radius";
    return "spacing";
  }
  return "other";
}
function getTokenGroup(name) {
  const n2 = name.replace(/^--/, "");
  const scaleMatch = n2.match(/^([\w]+)-\d+$/);
  if (scaleMatch) return scaleMatch[1];
  const semanticPrefixes = [
    "primary",
    "secondary",
    "neutral",
    "success",
    "destructive",
    "warning"
  ];
  for (const prefix of semanticPrefixes) {
    if (n2 === prefix || n2.startsWith(`${prefix}-`)) return prefix;
  }
  if (["background", "foreground", "card", "card-foreground", "popover", "popover-foreground"].includes(n2)) {
    return "surface";
  }
  if (["border", "input", "ring", "muted", "muted-foreground", "accent", "accent-foreground"].includes(n2)) {
    return "utility";
  }
  if (n2.startsWith("chart")) return "chart";
  if (n2.startsWith("sidebar")) return "sidebar";
  if (n2.startsWith("radius")) return "radius";
  if (n2.startsWith("shadow")) return "shadow";
  return "other";
}
function detectColorFormat(value) {
  if (value.includes("oklch")) return "oklch";
  if (value.includes("hsl")) return "hsl";
  if (value.includes("rgb")) return "rgb";
  if (value.startsWith("#")) return "hex";
  return null;
}

// src/server/lib/scan-components.ts
import fs7 from "fs/promises";
import path5 from "path";
async function scanComponents(projectRoot) {
  const componentDirs = [
    "components/ui",
    "src/components/ui"
  ];
  let componentDir = "";
  for (const dir of componentDirs) {
    try {
      await fs7.access(path5.join(projectRoot, dir));
      componentDir = dir;
      break;
    } catch {
    }
  }
  if (!componentDir) {
    return { components: [] };
  }
  const fullDir = path5.join(projectRoot, componentDir);
  const files = await fs7.readdir(fullDir);
  const tsxFiles = files.filter((f) => f.endsWith(".tsx"));
  const components = [];
  for (const file of tsxFiles) {
    const filePath = path5.join(componentDir, file);
    const source = await fs7.readFile(path5.join(projectRoot, filePath), "utf-8");
    const entry = parseComponent(source, filePath);
    if (entry) {
      components.push(entry);
    }
  }
  return { components };
}
function parseComponent(source, filePath) {
  const cvaMatch = source.match(
    /const\s+(\w+)\s*=\s*cva\(\s*(["'`])([\s\S]*?)\2\s*,\s*\{/
  );
  const slotMatch = source.match(/data-slot=["'](\w+)["']/);
  if (!slotMatch) return null;
  const dataSlot = slotMatch[1];
  const name = dataSlot.charAt(0).toUpperCase() + dataSlot.slice(1);
  if (!cvaMatch) {
    return {
      name,
      filePath,
      dataSlot,
      baseClasses: "",
      variants: [],
      tokenReferences: extractTokenReferences(source)
    };
  }
  const baseClasses = cvaMatch[3].trim();
  const variants = parseVariants(source);
  const tokenReferences = extractTokenReferences(source);
  return {
    name,
    filePath,
    dataSlot,
    baseClasses,
    variants,
    tokenReferences
  };
}
function parseVariants(source) {
  const dimensions = [];
  const variantsBlock = source.match(/variants\s*:\s*\{([\s\S]*?)\}\s*,?\s*defaultVariants/);
  if (!variantsBlock) return dimensions;
  const block = variantsBlock[1];
  const dimRegex = /(\w+)\s*:\s*\{([^}]+)\}/g;
  let dimMatch;
  while ((dimMatch = dimRegex.exec(block)) !== null) {
    const dimName = dimMatch[1];
    const dimBody = dimMatch[2];
    const options = [];
    const classes = {};
    const optRegex = /["']?([\w-]+)["']?\s*:\s*\n?\s*["'`]([^"'`]*)["'`]/g;
    let optMatch;
    while ((optMatch = optRegex.exec(dimBody)) !== null) {
      options.push(optMatch[1]);
      classes[optMatch[1]] = optMatch[2].trim();
    }
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
        classes
      });
    }
  }
  return dimensions;
}
function extractTokenReferences(source) {
  const tokens = /* @__PURE__ */ new Set();
  const classStrings = source.match(/["'`][^"'`]*["'`]/g) || [];
  for (const str of classStrings) {
    const tokenPattern = /(?:bg|text|border|ring|shadow|outline|fill|stroke)-([a-z][\w-]*(?:\/\d+)?)/g;
    let match;
    while ((match = tokenPattern.exec(str)) !== null) {
      const val = match[1];
      if (!val.match(/^\d/) && // not a number
      !["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "full", "none"].includes(val) && !val.startsWith("[")) {
        tokens.add(val.split("/")[0]);
      }
    }
  }
  return Array.from(tokens);
}

// src/server/lib/scanner.ts
var cachedScan = null;
async function runScan(projectRoot) {
  const framework = await detectFramework(projectRoot);
  const [tokens, components] = await Promise.all([
    scanTokens(projectRoot, framework),
    scanComponents(projectRoot)
  ]);
  cachedScan = { framework, tokens, components };
  return cachedScan;
}
function createScanRouter(projectRoot) {
  const router = Router4();
  runScan(projectRoot).then(() => {
    console.log("  Project scanned successfully");
  }).catch((err) => {
    console.error("  Scan error:", err.message);
  });
  router.get("/all", async (_req, res) => {
    try {
      const result = cachedScan || await runScan(projectRoot);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  router.get("/tokens", async (_req, res) => {
    try {
      const result = cachedScan || await runScan(projectRoot);
      res.json(result.tokens);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  router.get("/components", async (_req, res) => {
    try {
      const result = cachedScan || await runScan(projectRoot);
      res.json(result.components);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  router.post("/rescan", async (_req, res) => {
    try {
      const result = await runScan(projectRoot);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  router.get("/resolve-route", async (req, res) => {
    try {
      const routePath = req.query.path || "/";
      const scan = cachedScan || await runScan(projectRoot);
      const appDir = scan.framework.appDir;
      const result = await resolveRouteToFile(projectRoot, appDir, routePath);
      res.json({ filePath: result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  return router;
}
var PAGE_EXTENSIONS = [".tsx", ".jsx", ".ts", ".js"];
async function resolveRouteToFile(projectRoot, appDir, routePath) {
  const segments = routePath === "/" ? [] : routePath.replace(/^\//, "").replace(/\/$/, "").split("/");
  const absAppDir = path6.join(projectRoot, appDir);
  const result = await matchSegments(absAppDir, segments, 0);
  if (result) {
    return path6.relative(projectRoot, result);
  }
  return null;
}
async function findPageFile(dir) {
  for (const ext of PAGE_EXTENSIONS) {
    const candidate = path6.join(dir, `page${ext}`);
    try {
      await fs8.access(candidate);
      return candidate;
    } catch {
    }
  }
  for (const ext of PAGE_EXTENSIONS) {
    const candidate = path6.join(dir, `index${ext}`);
    try {
      await fs8.access(candidate);
      return candidate;
    } catch {
    }
  }
  return null;
}
async function listDirs(dir) {
  try {
    const entries = await fs8.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}
async function matchSegments(currentDir, segments, index) {
  if (index >= segments.length) {
    const page = await findPageFile(currentDir);
    if (page) return page;
    const dirs2 = await listDirs(currentDir);
    for (const d of dirs2) {
      if (d.startsWith("(") && d.endsWith(")")) {
        const page2 = await findPageFile(path6.join(currentDir, d));
        if (page2) return page2;
      }
    }
    return null;
  }
  const segment = segments[index];
  const dirs = await listDirs(currentDir);
  if (dirs.includes(segment)) {
    const result = await matchSegments(path6.join(currentDir, segment), segments, index + 1);
    if (result) return result;
  }
  for (const d of dirs) {
    if (d.startsWith("(") && d.endsWith(")")) {
      const result = await matchSegments(path6.join(currentDir, d), segments, index);
      if (result) return result;
    }
  }
  for (const d of dirs) {
    if (d.startsWith("[") && d.endsWith("]") && !d.startsWith("[...") && !d.startsWith("[[")) {
      const result = await matchSegments(path6.join(currentDir, d), segments, index + 1);
      if (result) return result;
    }
  }
  for (const d of dirs) {
    if (d.startsWith("[...") && d.endsWith("]")) {
      const page = await findPageFile(path6.join(currentDir, d));
      if (page) return page;
    }
  }
  for (const d of dirs) {
    if (d.startsWith("[[...") && d.endsWith("]]")) {
      const page = await findPageFile(path6.join(currentDir, d));
      if (page) return page;
    }
  }
  return null;
}

// src/server/index.ts
async function createServer(config) {
  const app = express();
  app.use("/api", express.json());
  app.use("/scan", express.json());
  app.get("/api/config", (_req, res) => {
    res.json({
      targetUrl: `http://localhost:${config.targetPort}`,
      stylingType: config.stylingType,
      projectRoot: config.projectRoot
    });
  });
  app.use(
    "/api/write-element",
    createWriteElementRouter({
      projectRoot: config.projectRoot,
      stylingType: config.stylingType
    })
  );
  app.use("/api/tokens", createTokensRouter(config.projectRoot));
  app.use("/api/component", createComponentRouter(config.projectRoot));
  app.use("/scan", createScanRouter(config.projectRoot));
  const __dirname = path7.dirname(fileURLToPath(import.meta.url));
  const clientDistPath = path7.join(__dirname, "client");
  const isDev = !fs9.existsSync(path7.join(clientDistPath, "index.html"));
  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const viteRoot = path7.resolve(__dirname, "../client");
    const vite = await createViteServer({
      configFile: path7.resolve(__dirname, "../../vite.config.ts"),
      server: { middlewareMode: true },
      appType: "custom"
    });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      try {
        const url = req.originalUrl || "/";
        const htmlPath = path7.join(viteRoot, "index.html");
        let html = fs9.readFileSync(htmlPath, "utf-8");
        html = await vite.transformIndexHtml(url, html);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (err) {
        vite.ssrFixStacktrace(err);
        next(err);
      }
    });
  } else {
    app.use(express.static(clientDistPath));
    app.use((_req, res) => {
      res.sendFile(path7.join(clientDistPath, "index.html"));
    });
  }
  return app;
}

// src/cli.ts
var green = (s) => `\x1B[32m${s}\x1B[0m`;
var yellow = (s) => `\x1B[33m${s}\x1B[0m`;
var red = (s) => `\x1B[31m${s}\x1B[0m`;
var dim = (s) => `\x1B[2m${s}\x1B[0m`;
var bold = (s) => `\x1B[1m${s}\x1B[0m`;
async function main() {
  const args = process.argv.slice(2);
  let targetPort = 3e3;
  let toolPort = 4400;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" && args[i + 1]) {
      targetPort = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === "--tool-port" && args[i + 1]) {
      toolPort = parseInt(args[i + 1], 10);
      i++;
    }
  }
  const projectRoot = process.cwd();
  console.log("");
  console.log(`  ${bold("@designtools/codecanvas")}`);
  console.log(`  ${dim(projectRoot)}`);
  console.log("");
  const pkgPath = path8.join(projectRoot, "package.json");
  if (!fs10.existsSync(pkgPath)) {
    console.log(`  ${red("\u2717")} No package.json found in ${projectRoot}`);
    console.log(`    ${dim("Run this command from the root of the app you want to edit.")}`);
    console.log(`    ${dim("All file reads and writes are scoped to this directory.")}`);
    console.log("");
    process.exit(1);
  }
  const framework = await detectFramework(projectRoot);
  const frameworkLabel = framework.name === "nextjs" ? "Next.js" : framework.name === "remix" ? "Remix" : framework.name === "vite" ? "Vite" : "Unknown";
  console.log(`  ${green("\u2713")} Framework      ${frameworkLabel}`);
  if (framework.appDirExists) {
    console.log(`  ${green("\u2713")} App dir        ${framework.appDir}/`);
  } else {
    console.log(`  ${yellow("\u26A0")} App dir        ${dim("not found \u2014 route detection won't be available")}`);
  }
  if (framework.componentDirExists) {
    console.log(
      `  ${green("\u2713")} Components     ${framework.componentDir}/ ${dim(`(${framework.componentFileCount} files)`)}`
    );
  } else {
    console.log(`  ${yellow("\u26A0")} Components     ${dim("not found \u2014 component editing won't be available")}`);
  }
  if (framework.cssFiles.length > 0) {
    console.log(`  ${green("\u2713")} CSS files      ${framework.cssFiles[0]}`);
  } else {
    console.log(`  ${yellow("\u26A0")} CSS files      ${dim("no CSS files found")}`);
  }
  const styling = await detectStylingSystem(projectRoot, framework);
  const stylingLabels = {
    "tailwind-v4": "Tailwind CSS v4",
    "tailwind-v3": "Tailwind CSS v3",
    "bootstrap": "Bootstrap",
    "css-variables": "CSS Custom Properties",
    "plain-css": "Plain CSS",
    "unknown": "Unknown"
  };
  const stylingLabel = stylingLabels[styling.type];
  if (styling.type !== "unknown") {
    console.log(`  ${green("\u2713")} Styling        ${stylingLabel}`);
  } else {
    console.log(`  ${yellow("\u26A0")} Styling        ${dim("no styling system detected")}`);
  }
  console.log("");
  const targetUrl = `http://localhost:${targetPort}`;
  let targetReachable = false;
  let waited = false;
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      await fetch(targetUrl, { signal: AbortSignal.timeout(2e3) });
      targetReachable = true;
      break;
    } catch {
      if (attempt === 0) {
        process.stdout.write(`  ${dim("Waiting for dev server at " + targetUrl + "...")}`);
        waited = true;
      }
      await new Promise((r) => setTimeout(r, 1e3));
    }
  }
  if (waited) process.stdout.write("\r\x1B[K");
  if (targetReachable) {
    console.log(`  ${green("\u2713")} Target         ${targetUrl}`);
  } else {
    console.log("");
    console.log(`  ${red("\u2717")} No dev server at ${targetUrl}`);
    console.log(`    ${dim("Start your dev server first, then run this command.")}`);
    console.log(`    ${dim(`Use --port to specify a different port.`)}`);
    console.log("");
    process.exit(1);
  }
  console.log(`  ${green("\u2713")} Tool           http://localhost:${toolPort}`);
  console.log("");
  console.log(`  ${dim("All file writes are scoped to:")} ${bold(projectRoot)}`);
  console.log("");
  const server = await createServer({
    targetPort,
    toolPort,
    projectRoot,
    stylingType: styling.type
  });
  server.listen(toolPort, () => {
    open(`http://localhost:${toolPort}`);
  });
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
