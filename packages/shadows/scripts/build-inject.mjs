// Pre-compile the inject script so the published package doesn't need @designtools/core at runtime.
import { transformSync } from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const coreInject = path.resolve(packageRoot, "../core/src/inject/selection.ts");

const src = fs.readFileSync(coreInject, "utf-8");
const { code } = transformSync(src, { loader: "ts" });

const outDir = path.join(packageRoot, "dist/inject");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "selection.js"), code);

console.log("Inject script compiled → dist/inject/selection.js");
