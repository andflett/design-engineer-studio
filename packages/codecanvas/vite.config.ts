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
  },
});
