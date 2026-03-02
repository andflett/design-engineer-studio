import { describe, it, expect } from "vitest";
import { transformMount } from "./mount-transform.js";

describe("transformMount", () => {
  it("skips if Surface already imported", () => {
    const code = `import { Surface } from "@designtools/vite-plugin/surface";\ncreateRoot(document.getElementById("root")).render(<App />);`;
    expect(transformMount(code)).toBe(code);
  });

  it("skips if no createRoot or render call", () => {
    const code = `import React from "react";\nconst x = 1;`;
    expect(transformMount(code)).toBe(code);
  });

  it("inserts imports after last import statement", () => {
    const code = `import React from "react";\nimport App from "./App";\ncreateRoot(document.getElementById("root")).render(<App />);`;
    const result = transformMount(code);
    expect(result).toContain('import { Surface } from "@designtools/vite-plugin/surface";');
    expect(result).toContain('import { DesigntoolsRegistry } from "./designtools-registry";');
  });

  it("wraps .render(<App />) in fragment with Surface", () => {
    const code = `import App from "./App";\ncreateRoot(document.getElementById("root")).render(<App />);`;
    const result = transformMount(code);
    expect(result).toContain(".render(<><App /><Surface /><DesigntoolsRegistry /></>)");
  });

  it("injects before </StrictMode> when present", () => {
    const code = [
      `import React from "react";`,
      `import App from "./App";`,
      `createRoot(document.getElementById("root")).render(`,
      `  <StrictMode>`,
      `    <App />`,
      `  </StrictMode>`,
      `);`,
    ].join("\n");
    const result = transformMount(code);
    expect(result).toContain("<Surface /><DesigntoolsRegistry /></StrictMode>");
  });

  it("prepends imports if no existing imports", () => {
    const code = `createRoot(document.getElementById("root")).render(<App />);`;
    const result = transformMount(code);
    expect(result.indexOf("import { Surface }")).toBeLessThan(result.indexOf("createRoot"));
  });
});
