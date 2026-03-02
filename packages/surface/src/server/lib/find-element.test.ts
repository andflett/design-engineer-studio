import { describe, it, expect, beforeAll } from "vitest";
import { findElementAtSource, findComponentAtSource } from "./find-element.js";
import { getParser, parseSource, getTagName } from "./ast-helpers.js";

let parser: any;

beforeAll(async () => {
  parser = await getParser();
});

function parse(src: string) {
  return parseSource(src, parser);
}

describe("findElementAtSource", () => {
  it("finds element at exact line:col", () => {
    // Line 1, col 10 (0-based) is where <div starts
    const src = `const x = <div className="p-4" />;`;
    const ast = parse(src);
    const result = findElementAtSource(ast, 1, 10);
    expect(result).not.toBeNull();
    expect(getTagName(result.node)).toBe("div");
  });

  it("finds nested element", () => {
    const src = [
      `const x = (`,
      `  <div>`,
      `    <span className="text-sm">Hi</span>`,
      `  </div>`,
      `);`,
    ].join("\n");
    const ast = parse(src);
    // <span is on line 3, col 4
    const result = findElementAtSource(ast, 3, 4);
    expect(result).not.toBeNull();
    expect(getTagName(result.node)).toBe("span");
  });

  it("returns null for non-matching coordinates", () => {
    const src = `const x = <div />;`;
    const ast = parse(src);
    expect(findElementAtSource(ast, 99, 0)).toBeNull();
  });
});

describe("findComponentAtSource", () => {
  it("finds component by name and location", () => {
    const src = `const x = <Button variant="primary" />;`;
    const ast = parse(src);
    const result = findComponentAtSource(ast, "Button", 1, 10);
    expect(result).not.toBeNull();
    expect(getTagName(result.node)).toBe("Button");
  });

  it("returns null for wrong component name", () => {
    const src = `const x = <Button />;`;
    const ast = parse(src);
    expect(findComponentAtSource(ast, "Input", 1, 10)).toBeNull();
  });

  it("returns null for wrong location", () => {
    const src = `const x = <Button />;`;
    const ast = parse(src);
    expect(findComponentAtSource(ast, "Button", 1, 0)).toBeNull();
  });
});
