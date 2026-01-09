import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const banksFile = resolve(currentDir, "../dist/banks.json");

if (!existsSync(banksFile)) {
  console.error('banks.json not found. Run "npm run bank:gen" first.');
  process.exit(1);
}

const result = spawnSync("npx", ["wrangler", "kv:bulk", "put", "BANKS", banksFile], {
  stdio: "inherit",
});

if (result.error) {
  console.error(`Failed to run wrangler: ${result.error.message}`);
  process.exit(result.status ?? 1);
}

process.exit(result.status ?? 0);