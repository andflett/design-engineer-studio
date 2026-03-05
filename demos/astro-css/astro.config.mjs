import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import designtools from "../../packages/astro-plugin/dist/index.js";

export default defineConfig({
  integrations: [react(), designtools()],
});
