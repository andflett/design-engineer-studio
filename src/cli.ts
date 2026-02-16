import { startServer } from "./server/index.js";

const args = process.argv.slice(2);
let targetPort = 3000;
let studioPort = 4400;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && args[i + 1]) {
    targetPort = parseInt(args[i + 1], 10);
    i++;
  }
  if (args[i] === "--studio-port" && args[i + 1]) {
    studioPort = parseInt(args[i + 1], 10);
    i++;
  }
}

console.log(`
  ╭──────────────────────────────────╮
  │  Design Engineer Studio          │
  │  Target:  http://localhost:${targetPort}  │
  │  Studio:  http://localhost:${studioPort}  │
  ╰──────────────────────────────────╯
`);

startServer({ targetPort, studioPort }).catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
