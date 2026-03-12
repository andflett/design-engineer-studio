import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { imagetools } from "vite-imagetools";

export default defineConfig({
  plugins: [react(), tailwindcss(), imagetools()],
  server: { port: 5555 },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        "ai-writes": "ai-writes.html",
      },
    },
  },
});
