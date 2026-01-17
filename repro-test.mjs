import { renderLatexText } from "./packages/bank-gen/src/latex-render.js";

const input = `Ta chứng minh \`\`$\\forall n \\in \\mathbb{N}\\, P(n)$'' bằng quy nạp.`;
const result = renderLatexText(input, { assetsDir: "tmp", assetsBase: "tmp" });
console.log("Input:", input);
console.log("Output:", result);
