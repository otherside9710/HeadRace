import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backend = `http://127.0.0.1:${process.env.HEADRACE_PORT ?? "5000"}`;

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../headrace/web/dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/socket.io": { target: backend, ws: true },
      "/historial": backend,
      "/sesiones": backend,
      "/mejores-carreras": backend,
    },
  },
});
