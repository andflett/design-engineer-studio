import { describe, it, expect } from "vitest";
import path from "path";
import { safePath } from "./safe-path.js";

describe("safePath", () => {
  const root = "/project";

  it("resolves a valid relative path", () => {
    expect(safePath(root, "src/app.tsx")).toBe(path.resolve(root, "src/app.tsx"));
  });

  it("resolves nested paths", () => {
    expect(safePath(root, "src/components/Button.tsx")).toBe(
      path.resolve(root, "src/components/Button.tsx")
    );
  });

  it("throws on absolute paths", () => {
    expect(() => safePath(root, "/etc/passwd")).toThrow("Absolute paths are not allowed");
  });

  it("throws on path traversal", () => {
    expect(() => safePath(root, "../etc/passwd")).toThrow("resolves outside the project");
    expect(() => safePath(root, "src/../../etc/passwd")).toThrow("resolves outside the project");
  });

  it("throws on empty path", () => {
    expect(() => safePath(root, "")).toThrow("File path is required");
  });

  it("throws on non-string path", () => {
    expect(() => safePath(root, null as any)).toThrow("File path is required");
    expect(() => safePath(root, undefined as any)).toThrow("File path is required");
  });

  it("allows path that resolves to project root", () => {
    expect(safePath(root, ".")).toBe(path.resolve(root));
  });

  it("prevents prefix matching attack (/project-bar)", () => {
    // "/project/../project-bar/evil" resolves to "/project-bar/evil"
    expect(() => safePath(root, "../project-bar/evil")).toThrow("resolves outside");
  });
});
