
import { mkdirSync } from "fs";
import { resolve } from "path";

console.log("Start test-env");
console.log("CWD:", process.cwd());

try {
    const dir = resolve(process.cwd(), "debug-check");
    mkdirSync(dir, { recursive: true });
    console.log("Created:", dir);
} catch (e) {
    console.error("Mkdir failed:", e);
}

try {
    // Try dynamic import to catch error gracefully? 
    // No, static import issues crash before execution.
    // We'll rely on script output.
    const shared = require("@app/shared");
    console.log("Shared loaded keys:", Object.keys(shared));
} catch (e) {
    console.error("Shared load failed:", e);
}
