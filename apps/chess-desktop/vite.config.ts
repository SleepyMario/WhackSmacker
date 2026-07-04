import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  build: {
    outDir: "dist-electron/renderer",
    emptyOutDir: false
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true
  }
});
