import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import designtools from "@designtools/svelte-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), designtools()],
});
