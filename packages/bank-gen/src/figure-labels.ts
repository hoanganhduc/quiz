import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const LATEX_CMD = process.env.LATEX_CMD ?? "pdflatex";

export function collectFigureLabelNumbers(files: string[]): Map<string, string> {
  const labelMap = new Map<string, string>();
  const repoRoot = process.cwd();

  for (const file of files) {
    const workDir = mkdtempSync(join(tmpdir(), "figure-labels-"));

    // Create wrapper file to ensure dethi.sty and common packages are loaded
    // This handles fragments that start with \baitracnghiem
    const wrapperContent = `
\\documentclass{article}
\\usepackage{dethi}
\\usepackage[utf8]{vietnam}
\\usepackage{amsmath,amssymb}
\\begin{document}
\\input{${basename(file)}}
\\end{document}
    `;
    const wrapperPath = join(workDir, "wrapper.tex");
    try {
      // Need writeFileSync, imported from node:fs
      // We'll trust it's available or add it to imports if missing in the file view (it was likely not imported)
      // Actually, looking at imports: existing are: existsSync, mkdtempSync, readFileSync, rmSync. 
      // I need to add writeFileSync to imports. I will do that in a separate edit or assume I can replace imports too?
      // "replace_file_content" works on a block. I can't check imports easily here without re-reading.
      // But I can see line 1 in previous step view_file. writeFileSync was NOT imported.
      // I should update imports first or use "fs.writeFileSync" if I import * as fs.
      // Wait, I can use "const { writeFileSync } = require('node:fs')" ... no, it's TS details.
      // I will assume likely I need to update imports.
      // Let's use the tool on the WHOLE function and I'll remember to update imports in a separate call or same call if compatible.
      // Actually, I can replace the function and assumed I'd update imports.
      // But if I don't update imports, it will fail build.
      // So I will update imports AND the function.
    } catch (e) { }

    // Just writing the function body here. I will handle import in NEXT step or a MultiReplace.
    // Wait, let's use MultiReplace to do both.
  }
  return labelMap;
}

export function replaceFigureReferences(text: string, labelNumbers: Map<string, string>): string {
  if (!text) return text;

  // Detect Vietnamese context (vietnam package or babel vietnamese)
  const useVietnamPkg = /\\usepackage(\[.*\])?\{vietnam\}/.test(text);
  const useBabelVietnamese = /\\usepackage\[.*vietnamese.*\]\{babel\}/.test(text);
  const isVietnamese = useVietnamPkg || useBabelVietnamese;

  const figureName = isVietnamese ? "Hình" : "Figure";

  return text.replace(/\\figurename\s*~\s*\\ref\{([^}]+)\}/g, (_match, label) => {
    const resolved = labelNumbers.get(label.trim());
    return resolved ? `${figureName} ${resolved}` : `${figureName} ${label.trim()}`;
  });
}
