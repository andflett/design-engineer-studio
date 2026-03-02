import { describe, it, expect, beforeAll } from "vitest";
import {
  getParser,
  parseSource,
  printSource,
  getTagName,
  findAttr,
  classBoundaryRegex,
  replaceClassInAttr,
  appendClassToAttr,
  addClassNameAttr,
} from "./ast-helpers.js";
import { namedTypes as n } from "ast-types";

let parser: any;

beforeAll(async () => {
  parser = await getParser();
});

function getFirstElement(source: string) {
  const ast = parseSource(source, parser);
  let found: any = null;
  const { visit } = require("recast");
  visit(ast, {
    visitJSXOpeningElement(path: any) {
      found = path.node;
      return false;
    },
  });
  return { ast, opening: found };
}

describe("getParser", () => {
  it("returns a parser with a parse method", async () => {
    const p = await getParser();
    expect(p).toBeDefined();
    expect(typeof p.parse).toBe("function");
  });
});

describe("parseSource / printSource roundtrip", () => {
  it("preserves simple JSX", () => {
    const src = `const x = <div className="p-4">Hello</div>;`;
    const ast = parseSource(src, parser);
    const out = printSource(ast);
    expect(out).toBe(src);
  });

  it("parses TypeScript syntax", () => {
    const src = `const x: React.FC = () => <span />;`;
    const ast = parseSource(src, parser);
    const out = printSource(ast);
    expect(out).toBe(src);
  });
});

describe("getTagName", () => {
  it("returns tag name for simple JSX element", () => {
    const { opening } = getFirstElement(`const x = <div />;`);
    expect(getTagName(opening)).toBe("div");
  });

  it("returns tag name for component", () => {
    const { opening } = getFirstElement(`const x = <Button />;`);
    expect(getTagName(opening)).toBe("Button");
  });

  it("handles member expressions", () => {
    const { opening } = getFirstElement(`const x = <Radix.Dialog />;`);
    expect(getTagName(opening)).toBe("Radix.Dialog");
  });
});

describe("findAttr", () => {
  it("finds className attribute", () => {
    const { opening } = getFirstElement(`const x = <div className="p-4" />;`);
    const attr = findAttr(opening, "className");
    expect(attr).not.toBeNull();
    expect(n.JSXAttribute.check(attr)).toBe(true);
  });

  it("returns null for missing attribute", () => {
    const { opening } = getFirstElement(`const x = <div id="test" />;`);
    expect(findAttr(opening, "className")).toBeNull();
  });
});

describe("classBoundaryRegex", () => {
  it("matches class at start of string", () => {
    expect(classBoundaryRegex("p-4").test("p-4 m-2")).toBe(true);
  });

  it("matches class at end of string", () => {
    expect(classBoundaryRegex("m-2").test("p-4 m-2")).toBe(true);
  });

  it("does not match partial class names", () => {
    expect(classBoundaryRegex("p-4").test("ap-4")).toBe(false);
  });

  it("matches class surrounded by quotes", () => {
    expect(classBoundaryRegex("p-4").test('"p-4"')).toBe(true);
  });
});

describe("replaceClassInAttr", () => {
  it("replaces class in string literal", () => {
    const { ast, opening } = getFirstElement(`const x = <div className="p-4 m-2" />;`);
    const result = replaceClassInAttr(opening, "p-4", "p-8");
    expect(result).toBe(true);
    expect(printSource(ast)).toContain("p-8 m-2");
  });

  it("replaces class in expression container", () => {
    const { ast, opening } = getFirstElement(`const x = <div className={"p-4 m-2"} />;`);
    const result = replaceClassInAttr(opening, "p-4", "p-8");
    expect(result).toBe(true);
    expect(printSource(ast)).toContain("p-8 m-2");
  });

  it("replaces class in cn() call", () => {
    const { ast, opening } = getFirstElement(`const x = <div className={cn("p-4 flex", variant)} />;`);
    const result = replaceClassInAttr(opening, "p-4", "p-8");
    expect(result).toBe(true);
    expect(printSource(ast)).toContain("p-8 flex");
  });

  it("replaces class in ternary expression", () => {
    const { ast, opening } = getFirstElement(`const x = <div className={active ? "p-4" : "p-2"} />;`);
    const result = replaceClassInAttr(opening, "p-4", "p-8");
    expect(result).toBe(true);
    expect(printSource(ast)).toContain("p-8");
  });

  it("returns false when class not found", () => {
    const { opening } = getFirstElement(`const x = <div className="p-4" />;`);
    expect(replaceClassInAttr(opening, "m-2", "m-4")).toBe(false);
  });

  it("returns false when no className attribute", () => {
    const { opening } = getFirstElement(`const x = <div id="test" />;`);
    expect(replaceClassInAttr(opening, "p-4", "p-8")).toBe(false);
  });
});

describe("appendClassToAttr", () => {
  it("appends to string literal", () => {
    const { ast, opening } = getFirstElement(`const x = <div className="p-4" />;`);
    const result = appendClassToAttr(opening, "m-2");
    expect(result).toBe(true);
    expect(printSource(ast)).toContain("p-4 m-2");
  });

  it("appends to first arg of cn() call", () => {
    const { ast, opening } = getFirstElement(`const x = <div className={cn("p-4", variant)} />;`);
    const result = appendClassToAttr(opening, "m-2");
    expect(result).toBe(true);
    expect(printSource(ast)).toContain("p-4 m-2");
  });

  it("returns false when no className", () => {
    const { opening } = getFirstElement(`const x = <div />;`);
    expect(appendClassToAttr(opening, "m-2")).toBe(false);
  });
});

describe("addClassNameAttr", () => {
  it("adds className to element without one", () => {
    const { ast, opening } = getFirstElement(`const x = <div />;`);
    addClassNameAttr(opening, "p-4");
    const out = printSource(ast);
    expect(out).toContain('className="p-4"');
  });
});
