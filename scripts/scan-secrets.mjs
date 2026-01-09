import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  ".wrangler",
  ".wrangler-state",
  ".turbo",
  ".vite",
  "coverage"
]);

const IGNORE_FILES = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".dev.vars",
  ".dev.vars.local"
];

const TEXT_EXTS = new Set([
  ".js",
  ".ts",
  ".tsx",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".toml",
  ".txt",
  ".mjs",
  ".cjs"
]);

const SECRET_PATTERNS = [
  /ADMIN_TOKEN\s*=\s*.+/i,
  /JWT_SECRET\s*=\s*.+/i,
  /CODE_PEPPER\s*=\s*.+/i,
  /CONFIG_ENC_KEY_B64\s*=\s*.+/i,
  /GITHUB_CLIENT_SECRET\s*=\s*.+/i,
  /GOOGLE_CLIENT_SECRET\s*=\s*.+/i,
  /Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/i,
  /x-access-token:[A-Za-z0-9._-]+/i
];

function isTextFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  return TEXT_EXTS.has(ext) || !ext;
}

function shouldIgnoreFile(filePath) {
  const lower = filePath.toLowerCase();
  return IGNORE_FILES.some((name) => lower.endsWith(name));
}

function walk(dir, out) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
}

function scanFile(filePath, findings) {
  if (!isTextFile(filePath) || shouldIgnoreFile(filePath)) return;
  const stat = statSync(filePath);
  if (stat.size > 1024 * 1024) return;
  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        findings.push(`${filePath}:${i + 1}: ${line.trim()}`);
        break;
      }
    }
  }
}

const files = [];
walk(ROOT, files);

const findings = [];
for (const file of files) {
  scanFile(file, findings);
}

if (findings.length > 0) {
  console.error("Potential secrets detected:");
  for (const line of findings) {
    console.error(`- ${line}`);
  }
  process.exit(1);
}

console.log("Secret scan passed.");
