import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@app/shared": path.resolve(__dirname, "../shared/src")
    }
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")]
    }
  }
});
