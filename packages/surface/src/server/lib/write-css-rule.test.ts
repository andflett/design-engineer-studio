import { describe, it, expect } from "vitest";
import {
  findCssRule,
  writeCssProperty,
  findCssModuleImports,
  resolveModuleClassNames,
} from "./write-css-rule.js";

describe("findCssRule", () => {
  it("finds a simple class selector", () => {
    const css = `.card {\n  color: red;\n}`;
    const loc = findCssRule(css, ".card");
    expect(loc).not.toBeNull();
    expect(loc!.blockStart).toBe(0);
    expect(loc!.openBrace).toBe(6);
    expect(css.slice(loc!.openBrace, loc!.openBrace + 1)).toBe("{");
  });

  it("finds a rule in the middle of a file", () => {
    const css = `body { margin: 0; }\n.card {\n  color: red;\n}\n.footer { padding: 10px; }`;
    const loc = findCssRule(css, ".card");
    expect(loc).not.toBeNull();
    expect(css.slice(loc!.openBrace + 1, loc!.blockEnd - 1)).toContain("color: red");
  });

  it("returns null when selector not found", () => {
    const css = `.card { color: red; }`;
    expect(findCssRule(css, ".missing")).toBeNull();
  });

  it("handles nested braces (media queries / nesting)", () => {
    const css = `.parent {\n  .child {\n    color: blue;\n  }\n  font-size: 14px;\n}`;
    const loc = findCssRule(css, ".parent");
    expect(loc).not.toBeNull();
    // Should find the complete parent block including nested .child
    const block = css.slice(loc!.openBrace + 1, loc!.blockEnd - 1);
    expect(block).toContain(".child");
    expect(block).toContain("font-size: 14px");
  });

  it("handles selector with special regex chars", () => {
    const css = `.card-header { color: red; }`;
    const loc = findCssRule(css, ".card-header");
    expect(loc).not.toBeNull();
  });
});

describe("writeCssProperty", () => {
  it("replaces an existing property value", () => {
    const css = `.card {\n  color: red;\n  padding: 10px;\n}`;
    const result = writeCssProperty(css, ".card", "color", "blue");
    expect(result).not.toBeNull();
    expect(result).toContain("color: blue;");
    expect(result).toContain("padding: 10px;");
  });

  it("appends a new property when not present", () => {
    const css = `.card {\n  color: red;\n}`;
    const result = writeCssProperty(css, ".card", "padding", "20px");
    expect(result).not.toBeNull();
    expect(result).toContain("padding: 20px;");
    expect(result).toContain("color: red;");
  });

  it("preserves indentation when appending", () => {
    const css = `.card {\n    color: red;\n}`;
    const result = writeCssProperty(css, ".card", "padding", "20px");
    expect(result).not.toBeNull();
    expect(result).toContain("    padding: 20px;");
  });

  it("returns null when selector not found", () => {
    const css = `.card { color: red; }`;
    expect(writeCssProperty(css, ".missing", "color", "blue")).toBeNull();
  });

  it("handles multiple rules, only modifies target", () => {
    const css = `.a {\n  color: red;\n}\n.b {\n  color: green;\n}`;
    const result = writeCssProperty(css, ".b", "color", "blue");
    expect(result).not.toBeNull();
    expect(result).toContain(".a {\n  color: red;\n}");
    expect(result).toContain("color: blue;");
  });

  it("handles property with multiple colons (e.g. url values)", () => {
    const css = `.card {\n  background: url(http://example.com);\n}`;
    const result = writeCssProperty(css, ".card", "color", "red");
    expect(result).not.toBeNull();
    expect(result).toContain("color: red;");
    expect(result).toContain("background: url(http://example.com);");
  });
});

describe("findCssModuleImports", () => {
  it("finds default CSS module import", () => {
    const source = `import styles from "./Card.module.css";`;
    const result = findCssModuleImports(source);
    expect(result).toEqual([{ binding: "styles", modulePath: "./Card.module.css" }]);
  });

  it("finds multiple CSS module imports", () => {
    const source = [
      `import styles from "./Card.module.css";`,
      `import headerStyles from "../Header.module.scss";`,
    ].join("\n");
    const result = findCssModuleImports(source);
    expect(result).toHaveLength(2);
    expect(result[0].binding).toBe("styles");
    expect(result[1].binding).toBe("headerStyles");
  });

  it("ignores non-module CSS imports", () => {
    const source = `import "./globals.css";`;
    expect(findCssModuleImports(source)).toHaveLength(0);
  });

  it("ignores regular JS imports", () => {
    const source = `import React from "react";`;
    expect(findCssModuleImports(source)).toHaveLength(0);
  });

  it("returns empty for no imports", () => {
    expect(findCssModuleImports("const x = 1;")).toHaveLength(0);
  });
});

describe("resolveModuleClassNames", () => {
  it("resolves styles.foo dot notation", () => {
    const jsx = `import styles from "./Card.module.css";\n<div className={styles.card}>`;
    const bindings = new Map([["styles", "./Card.module.css"]]);
    const result = resolveModuleClassNames(jsx, 2, 0, bindings);
    expect(result).toContain("card");
  });

  it("resolves styles['foo'] bracket notation", () => {
    const jsx = `import styles from "./Card.module.css";\n<div className={styles["card-header"]}>`;
    const bindings = new Map([["styles", "./Card.module.css"]]);
    const result = resolveModuleClassNames(jsx, 2, 0, bindings);
    expect(result).toContain("card-header");
  });

  it("resolves multiple class references", () => {
    const jsx = `import styles from "./Card.module.css";\n<div className={\`\${styles.card} \${styles.active}\`}>`;
    const bindings = new Map([["styles", "./Card.module.css"]]);
    const result = resolveModuleClassNames(jsx, 2, 0, bindings);
    expect(result).toContain("card");
    expect(result).toContain("active");
  });

  it("returns empty for out-of-bounds line", () => {
    const jsx = `<div className={styles.card}>`;
    const bindings = new Map([["styles", "./Card.module.css"]]);
    expect(resolveModuleClassNames(jsx, 99, 0, bindings)).toEqual([]);
  });

  it("returns empty when no className found", () => {
    const jsx = `<div id="test">`;
    const bindings = new Map([["styles", "./Card.module.css"]]);
    expect(resolveModuleClassNames(jsx, 1, 0, bindings)).toEqual([]);
  });
});
