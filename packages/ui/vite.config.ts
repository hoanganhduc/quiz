import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const hmrHost = process.env.HMR_CLIENT_HOST || "localhost";
const hmrPort = Number(process.env.HMR_CLIENT_PORT) || 5173;
const hmrProtocol = process.env.HMR_CLIENT_PROTOCOL === "wss" ? "wss" : "ws";
const repoSlug = process.env.GITHUB_REPOSITORY?.split("/")[1];
const basePath = process.env.VITE_BASE_URL || (repoSlug ? `/${repoSlug}/` : "/");

export default defineConfig({
  base: basePath,
  plugins: [react()],
  // Prefer TypeScript sources when both .ts/.tsx and emitted .js exist side_by-side.
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js"]
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
    hmr: {
      host: hmrHost,
      port: hmrPort,
      protocol: hmrProtocol
    },
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
        headers: {
          "X-Forwarded-Prefix": "/api"
        }
      }
    }
  }
});
