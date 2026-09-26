import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../headrace/web/dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/socket.io": { target: "http://127.0.0.1:5000", ws: true },
      "/historial": "http://127.0.0.1:5000",
      "/sesiones": "http://127.0.0.1:5000",
      "/mejores-carreras": "http://127.0.0.1:5000",
    },
  },
});
