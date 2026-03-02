/**
 * Vite plugin for designtools.
 * Provides source annotation, Surface auto-mount, and component registry generation.
 */

import type { Plugin, ResolvedConfig } from "vite";
import path from "path";
import { transformSource } from "./source-transform.js";
import { transformMount } from "./mount-transform.js";
import {
  generateComponentRegistry,
  cleanupComponentRegistry,
} from "./registry-generator.js";

export interface DesigntoolsOptions {
  /** Override the component directory to scan (relative to project root). */
  componentDir?: string;
}

export default function designtools(options?: DesigntoolsOptions): Plugin {
  let root: string;
  let isDev = false;

  return {
    name: "designtools",
    enforce: "pre", // Run before @vitejs/plugin-react

    configResolved(config: ResolvedConfig) {
      root = config.root;
      isDev = config.command === "serve";
    },

    buildStart() {
      if (!isDev) return;
      try {
        generateComponentRegistry(root, options?.componentDir);
      } catch (err: any) {
        console.warn(`[designtools] Registry generation failed: ${err.message}`);
      }
    },

    transform(code: string, id: string) {
      if (!isDev) return;

      // Skip node_modules and non-JSX files
      if (id.includes("node_modules")) return;
      if (!id.endsWith(".tsx") && !id.endsWith(".jsx")) return;

      const relativePath = path.relative(root, id);

      try {
        let result = code;

        // Source annotation (all JSX files)
        result = transformSource(result, id, relativePath);

        // Mount injection (main.tsx only)
        const basename = path.basename(id);
        if (basename === "main.tsx" || basename === "main.jsx") {
          result = transformMount(result);
        }

        if (result !== code) {
          return { code: result, map: null };
        }
      } catch (err: any) {
        console.warn(
          `[designtools] Transform skipped for ${relativePath}: ${err.message}`
        );
      }
    },

    buildEnd() {
      if (!isDev) return;
      try {
        cleanupComponentRegistry(root);
      } catch {
        // ignore
      }
    },
  };
}
