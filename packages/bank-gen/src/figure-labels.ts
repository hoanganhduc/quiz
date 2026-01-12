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
    const wrapperPath = join(workDir, "wrapper.tex");

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
    writeFileSync(wrapperPath, wrapperContent);

    // Windows uses semicolon, others use colon for TEXINPUTS
    const delimiter = process.platform === "win32" ? ";" : ":";
    // We run in workDir.
    // Need to find:
    // 1. The input file: dirname(file)
    // 2. dethi.sty: repoRoot (or parent of src)
    // 3. Nested inputs: parent of file directory (e.g. src root)
    const fileParent = resolve(dirname(file), "..");

    // . (workDir) : dirname(file) : fileParent : repoRoot : system
    const texInputs = `.${delimiter}${dirname(file)}${delimiter}${fileParent}${delimiter}${repoRoot}${delimiter}`;

    try {
      let success = true;
      for (let pass = 0; pass < 2; pass += 1) {
        const result = spawnSync(
          LATEX_CMD,
          // Process wrapper.tex instead of raw file
          ["-interaction=nonstopmode", "-halt-on-error", "-output-directory", workDir, "wrapper.tex"],
          {
            cwd: workDir, // Run in temp dir
            encoding: "utf8",
            env: { ...process.env, TEXINPUTS: texInputs }
          }
        );
        if (result.status !== 0) {
          success = false;
          console.error(`[${file}] ${LATEX_CMD} failed (pass ${pass + 1})`);
          if (result.stdout) console.error(`stdout:\n${result.stdout}`);
          if (result.stderr) console.error(`stderr:\n${result.stderr}`);
          break;
        }
      }

      if (!success) {
        continue;
      }

      // Output is wrapper.aux
      const auxPath = join(workDir, "wrapper.aux");
      if (!existsSync(auxPath)) {
        continue;
      }

      const aux = readFileSync(auxPath, "utf8");
      const regex = /\\newlabel\{([^}]+)\}\{\{([^}]+)\}/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(aux)) !== null) {
        const [, label, number] = match;
        if (!labelMap.has(label)) {
          labelMap.set(label, number);
        }
      }
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
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
