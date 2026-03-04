import { sveltekit } from "@sveltejs/kit/vite";
import designtools from "@designtools/svelte-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit(), designtools()],
});
