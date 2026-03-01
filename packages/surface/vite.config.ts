import { defineConfig } from "vite";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(__dirname, "src/client"),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(__dirname, "dist/client"),
  },
  server: {
    port: 4401,
    hmr: {
      // Use a specific HMR port so it doesn't conflict with the target app's Vite.
      // strictPort: false lets Vite pick the next available port if this one is busy.
      port: 24679,
    },
    strictPort: false,
  },
});
