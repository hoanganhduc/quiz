import { renderLatexText } from "../src/latex-render";
import { mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join, extname } from "node:path";

// 1. Setup paths
const debugOutDir = resolve(process.cwd(), "debug-output");
mkdirSync(debugOutDir, { recursive: true });

async function main() {
  // Get directory from args or default to user's requested path
  const searchDir = process.argv[2] || "C:/Users/hoanganhduc/VNU-HUS/MAT3500/src";

  console.log(`Scanning for .tex files in: ${searchDir}`);

  // 2. Find .tex files using simple readdir (non-recursive for speed/stability)
  let files: string[] = [];
  try {
    files = readdirSync(searchDir)
      .filter(f => extname(f).toLowerCase() === ".tex")
      .map(f => join(searchDir, f));
  } catch (err) {
    console.error(`Failed to read directory: ${err}`);
    return;
  }

  if (files.length === 0) {
    console.error("No .tex files found in the root of that directory.");
    return;
  }

  console.log(`Found ${files.length} .tex files.`);

  const foundBlocks: { block: string; source: string }[] = [];

  // 3. Extract up to 3 tikzpicture blocks
  for (const file of files) {
    if (foundBlocks.length >= 3) break;
    try {
      const content = readFileSync(file, "utf8");
      // Use global flag to find multiple occurrences
      const regex = /\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        foundBlocks.push({ block: match[0], source: file });
        if (foundBlocks.length >= 3) break;
      }
    } catch (e) {
      console.warn(`Skipping file ${file}: ${e}`);
    }
  }

  if (foundBlocks.length === 0) {
    console.error("No tikzpicture blocks found in any .tex file.");
    return;
  }

  console.log(`\n--- Found ${foundBlocks.length} TikZ Blocks ---`);

  // 4. Render
  console.log("\n--- Rendering ---");

  for (let i = 0; i < foundBlocks.length; i++) {
    const { block, source } = foundBlocks[i];
    console.log(`\nRendering Block ${i + 1} from ${source}...`);
    // console.log(block.substring(0, 100) + "..."); // Optional: print start of block

    try {
      const result = renderLatexText(block, {
        assetsDir: debugOutDir,
        assetsBase: "/debug-assets/",
        dpi: 300
      });

      console.log(`Block ${i + 1} success! Ref: ${result}`);
    } catch (err) {
      console.error(`Block ${i + 1} failed:`, err);
    }
  }

  console.log(`\nCheck images in: ${debugOutDir}`);
}

main().catch(console.error);
