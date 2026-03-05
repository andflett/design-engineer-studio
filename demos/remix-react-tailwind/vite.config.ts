import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import designtools from "../../packages/vite-plugin/dist/index.js";
import path from "path";

export default defineConfig({
  plugins: [designtools(), tailwindcss(), reactRouter()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./app"),
    },
  },
});
