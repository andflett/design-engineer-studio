import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  outDir: "dist",
  banner: { js: "#!/usr/bin/env node" },
  noExternal: [],
  // Mark all node_modules as external — the CLI runs with them installed at runtime
  external: [/^[^./]/],
});
