import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { yahooProxy } from "./vite-plugin-yahoo";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss(), yahooProxy()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      // Optional generic CORS proxy. Enable by setting VITE_CORS_PROXY in .env
      // e.g. VITE_CORS_PROXY=https://corsproxy.io/?
    },
  },
});
