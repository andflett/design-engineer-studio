import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import designtools from "../../packages/vite-plugin/dist/index.js";

export default defineConfig({
  plugins: [designtools(), react()],
});
