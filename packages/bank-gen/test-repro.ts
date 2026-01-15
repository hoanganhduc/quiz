import { collectFigureLabelNumbers, replaceFigureReferences } from "./src/figure-labels";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

async function main() {
    const sourceFile = "C:/Users/hoanganhduc/VNU-HUS/MAT3500/src/quiz-boolean_algebra.tex";
    if (!existsSync(sourceFile)) {
        console.error("Source file not found!");
        return;
    }

    // Create a minimal reproduction file that is a VALID LaTeX document
    const fullContent = readFileSync(sourceFile, "utf8");
    const q10Index = fullContent.indexOf("\\baitracnghiem{boolean:q10}");
    const qEndIndex = fullContent.indexOf("}{ }", fullContent.indexOf("\\baitracnghiem{boolean:q12}"));

    const contentSnippet = fullContent.slice(q10Index, qEndIndex + 4);

    const minFile = join(process.cwd(), "min-repro.tex");
    writeFileSync(minFile, contentSnippet);
    console.log("Created minimal repro file (snippet):", minFile);

    console.log("--- STEP 1: Label Collection ---");
    const labelMap = collectFigureLabelNumbers([minFile]);
    console.log("Collected Labels:", JSON.stringify(Object.fromEntries(labelMap), null, 2));

    console.log("\n--- STEP 2: Reference Replacement ---");
    const targetSnippet = "Hãy chọn mạch logic trong \\figurename~\\ref{fig:circuit4} thể hiện đúng biểu thức";
    const index = contentSnippet.indexOf(targetSnippet);

    if (index !== -1) {
        const snippet = contentSnippet.slice(index, index + 150);
        console.log("Original Snippet:", snippet);
        const replaced = replaceFigureReferences(snippet, labelMap, "vi");
        console.log("Replaced Snippet:", replaced);
    } else {
        console.warn("Target snippet not found in minimal content.");
    }
}

main().catch(console.error);
