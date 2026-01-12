
import { mkdirSync } from "fs";
import { resolve } from "path";
// import * as shared from "@app/shared"; // Comment out to test basic execution first

console.log("Start test-env");
console.log("CWD:", process.cwd());

try {
    const dir = resolve(process.cwd(), "debug-check-2");
    mkdirSync(dir, { recursive: true });
    console.log("Created:", dir);
} catch (e) {
    console.error("Mkdir failed:", e);
}
