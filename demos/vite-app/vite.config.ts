import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import designtools from "../../packages/vite-plugin/dist/index.js";
import path from "path";

export default defineConfig({
  plugins: [designtools(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
