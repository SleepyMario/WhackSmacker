import { spawn } from "node:child_process";

const vite = spawn("npx", ["vite", "--config", "apps/chess-desktop/vite.config.ts"], {
  stdio: ["ignore", "pipe", "inherit"]
});

let electron;
let started = false;

vite.stdout.setEncoding("utf8");
vite.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  if (!started && chunk.includes("http://127.0.0.1:5174/")) {
    started = true;
    const buildMain = spawn("npx", ["tsc", "-p", "apps/chess-desktop/tsconfig.json"], { stdio: "inherit" });
    buildMain.on("close", (code) => {
      if (code !== 0) {
        vite.kill("SIGTERM");
        process.exitCode = code ?? 1;
        return;
      }

      electron = spawn("npx", ["electron", "apps/chess-desktop/dist-electron/electron-main.js"], {
        env: {
          ...process.env,
          VITE_DEV_SERVER_URL: "http://127.0.0.1:5174/"
        },
        stdio: "inherit"
      });
      electron.on("close", () => vite.kill("SIGTERM"));
    });
  }
});

vite.on("close", (code) => {
  if (electron === undefined && code !== 0) {
    process.exitCode = code ?? 1;
  }
});

process.on("SIGINT", () => {
  electron?.kill("SIGINT");
  vite.kill("SIGINT");
});
