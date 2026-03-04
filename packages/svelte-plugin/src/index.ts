/**
 * SvelteKit/Svelte plugin for designtools.
 * Provides source annotation for .svelte templates (via svelte/compiler)
 * and any React islands (via the Vite plugin's Babel transform).
 *
 * Surface mount: SvelteKit reads `src/app.html` directly from disk and strips
 * content outside its placeholders. We inject a <script> into <head> that
 * references a virtual module served by Vite, so bare specifiers get resolved.
 */

import type { Plugin } from "vite";
import fs from "fs/promises";
import path from "path";
import designtoolsVite, {
  type DesigntoolsOptions,
} from "@designtools/vite-plugin";
import { createSvelteSourcePlugin } from "./svelte-source-transform.js";

export type { DesigntoolsOptions };

const VIRTUAL_MOUNT_ID = "virtual:designtools-surface-mount";
const RESOLVED_VIRTUAL_ID = "\0" + VIRTUAL_MOUNT_ID;

const MOUNT_MARKER = "<!-- designtools-surface -->";
const MOUNT_TAG = `${MOUNT_MARKER}\n  <script type="module" src="/@id/${VIRTUAL_MOUNT_ID}"></script>`;

const CLEANUP_RE =
  /\s*<!-- designtools-surface -->\n\s*<script[^>]*designtools-surface-mount[^>]*><\/script>/;

export default function designtools(options?: DesigntoolsOptions): Plugin[] {
  let isDev = false;

  return [
    designtoolsVite(options),
    createSvelteSourcePlugin(),
    {
      name: "designtools-svelte-mount",

      async configResolved(config) {
        isDev = config.command === "serve";
        if (!isDev) return;

        // Inject BEFORE SvelteKit reads app.html (which happens at server start).
        // configResolved runs before configureServer, so this is early enough.
        const appHtmlPath = path.join(config.root, "src", "app.html");
        try {
          const rawHtml = await fs.readFile(appHtmlPath, "utf-8");
          const clean = rawHtml.includes(MOUNT_MARKER)
            ? rawHtml.replace(CLEANUP_RE, "")
            : rawHtml;
          const injected = clean.replace(
            "%sveltekit.head%",
            `${MOUNT_TAG}\n  %sveltekit.head%`
          );
          await fs.writeFile(appHtmlPath, injected, "utf-8");
        } catch {
          // No app.html — not a SvelteKit project
        }
      },

      resolveId(id) {
        if (id === VIRTUAL_MOUNT_ID) return RESOLVED_VIRTUAL_ID;
      },

      load(id) {
        if (id === RESOLVED_VIRTUAL_ID) {
          return `
import { Surface } from "@designtools/vite-plugin/surface";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
const el = document.createElement("div");
el.id = "__designtools_surface";
document.body.appendChild(el);
createRoot(el).render(createElement(Surface));
`;
        }
      },

      async configureServer(server) {
        if (!isDev) return;

        const appHtmlPath = path.join(server.config.root, "src", "app.html");

        // Restore app.html on server close
        const restore = async () => {
          try {
            const current = await fs.readFile(appHtmlPath, "utf-8");
            if (current.includes(MOUNT_MARKER)) {
              await fs.writeFile(
                appHtmlPath,
                current.replace(CLEANUP_RE, ""),
                "utf-8"
              );
            }
          } catch {
            // Best effort
          }
        };

        server.httpServer?.on("close", restore);
        process.on("exit", () => {
          try {
            const fsSync = require("fs");
            const current = fsSync.readFileSync(appHtmlPath, "utf-8");
            if (current.includes(MOUNT_MARKER)) {
              fsSync.writeFileSync(
                appHtmlPath,
                current.replace(CLEANUP_RE, ""),
                "utf-8"
              );
            }
          } catch {
            // Best effort
          }
        });
      },
    },
  ];
}
