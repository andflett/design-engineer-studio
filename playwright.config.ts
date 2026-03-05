import { defineConfig } from "@playwright/test";
import type { PlaywrightTestConfig } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_ROOT = path.join(__dirname, "demos");
const PKG_ROOT = path.join(__dirname, "packages");

type WebServerConfig = NonNullable<PlaywrightTestConfig["webServer"]>;

// Helper to build a [demo, surface] server pair
function servers(
  demoDir: string,
  demoPort: number,
  toolPort: number,
  devCmd: string,
  timeout = 30_000,
): WebServerConfig {
  return [
    {
      command: `cd ${DEMO_ROOT}/${demoDir} && ${devCmd}`,
      url: `http://localhost:${demoPort}`,
      timeout,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `cd ${DEMO_ROOT}/${demoDir} && node ${PKG_ROOT}/surface/dist/cli.js --port ${demoPort} --tool-port ${toolPort} --no-open`,
      url: `http://localhost:${toolPort}`,
      timeout: 90_000,
      reuseExistingServer: !process.env.CI,
      env: { PLAYWRIGHT_TEST: "1" },
    },
  ];
}

// Project → server configs map
const serverConfigs: Record<string, WebServerConfig> = {
  "next-react-tailwind":      servers("next-react-tailwind",      3100, 4500, "PORT=3100 npm run dev"),
  "vite-react-tailwind":      servers("vite-react-tailwind",      3101, 4501, "npx vite --port 3101"),
  "vite-react-css":           servers("vite-react-css",           3103, 4503, "npx vite --port 3103"),
  "astro-css":                servers("astro-css",                3105, 4505, "npx astro dev --port 3105"),
  "svelte-css":               servers("svelte-css",               3106, 4506, "npx vite dev --port 3106"),
  "remix-react-tailwind":     servers("remix-react-tailwind",     3107, 4507, "npx react-router dev --port 3107"),
  "vite-react-tailwind-v3":   servers("vite-react-tailwind-v3",   3109, 4509, "npx vite --port 3109"),
  "svelte-tailwind":          servers("svelte-tailwind",          3110, 4510, "npx vite dev --port 3110"),
};

// Detect selected projects from CLI args (handles --project=name and --project name)
const selectedProjects: string[] = [];
for (let i = 0; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === "--project" && process.argv[i + 1]) {
    selectedProjects.push(process.argv[++i]);
  } else if (arg.startsWith("--project=")) {
    selectedProjects.push(arg.slice("--project=".length));
  }
}
const activeProjects =
  selectedProjects.length > 0 ? selectedProjects : Object.keys(serverConfigs);
const webServer = activeProjects.flatMap((p) => serverConfigs[p] ?? []);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  workers: process.env.CI ? 1 : 4, // Parallelize across projects; tests within each project run serially (fullyParallel is off)
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }]],
  use: {
    isMobile: false,
    viewport: { width: 1600, height: 900 },
    ignoreHTTPSErrors: true,
  },
  webServer,
  projects: [
    { name: "next-react-tailwind",     testMatch: "**/next-react-tailwind/**/*.spec.ts",     use: { baseURL: "http://localhost:4500" } },
    { name: "vite-react-tailwind",     testMatch: "**/vite-react-tailwind/**/*.spec.ts",     use: { baseURL: "http://localhost:4501" } },
    { name: "vite-react-css",          testMatch: "**/vite-react-css/**/*.spec.ts",          use: { baseURL: "http://localhost:4503" } },
    { name: "astro-css",               testMatch: "**/astro-css/**/*.spec.ts",               use: { baseURL: "http://localhost:4505" } },
    { name: "svelte-css",              testMatch: "**/svelte-css/**/*.spec.ts",               use: { baseURL: "http://localhost:4506" } },
    { name: "remix-react-tailwind",    testMatch: "**/remix-react-tailwind/**/*.spec.ts",    use: { baseURL: "http://localhost:4507" } },
    { name: "vite-react-tailwind-v3",  testMatch: "**/vite-react-tailwind-v3/**/*.spec.ts",  use: { baseURL: "http://localhost:4509" } },
    { name: "svelte-tailwind",         testMatch: "**/svelte-tailwind/**/*.spec.ts",         use: { baseURL: "http://localhost:4510" } },
  ],
});
