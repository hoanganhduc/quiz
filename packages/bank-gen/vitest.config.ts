import { defineConfig } from "vitest/config";
import path from "node:path";

const sharedSrc = path.resolve(__dirname, "../shared/src");

export default defineConfig({
  resolve: {
    alias: [{ find: /^@app\/shared(\/.*)?$/, replacement: `${sharedSrc}$1` }]
  }
});
