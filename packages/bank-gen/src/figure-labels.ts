import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const LATEX_CMD = process.env.LATEX_CMD ?? "pdflatex";

export function collectFigureLabelNumbers(files: string[]): Map<string, string> {
  if (files.length === 0) return new Map();

  const labelMap = new Map<string, string>();
  const repoRoot = process.cwd();

  // Use a single batch run to ensure continuous numbering
  const workDir = mkdtempSync(join(tmpdir(), "figure-labels-"));
  const wrapperPath = join(workDir, "wrapper.tex");

  // Normalize paths for LaTeX \input (forward slashes)
  const inputs = files
    .map((f) => `\\input{${f.split("\\").join("/")}}`)
    .join("\n");

  // Create wrapper file including all fragments
  // Create wrapper file including all fragments
  const wrapperContent = `
\\documentclass{article}
\\usepackage{mathpazo}
\\voffset=-3cm
\\textheight 25truecm
\\textwidth 19.5truecm
\\parskip 3pt
\\headsep=12pt
\\usepackage[baitap]{dethi}
\\usepackage[utf8]{vietnam}
\\usepackage{amsmath,amssymb}
\\usepackage{tikz}
\\begin{document}
${inputs}
\\end{document}
`;
  writeFileSync(wrapperPath, wrapperContent);

  // TEXINPUTS: Include repoRoot to resolve nested imports like \input{src/...}
  const delimiter = process.platform === "win32" ? ";" : ":";
  const texInputs = `.${delimiter}${repoRoot}${delimiter}`;

  try {
    const result = spawnSync(
      LATEX_CMD,
      ["-interaction=nonstopmode", "-halt-on-error", "-output-directory", workDir, "wrapper.tex"],
      {
        cwd: workDir,
        encoding: "utf8",
        env: { ...process.env, TEXINPUTS: texInputs }
      }
    );

    if (result.status !== 0) {
      console.error(`[bank-gen] ${LATEX_CMD} returned non-zero status. Check logs if numbers are missing.`);
      // We don't abort immediately because valid labels might still be generated in aux
    }

    const auxPath = join(workDir, "wrapper.aux");
    if (existsSync(auxPath)) {
      const aux = readFileSync(auxPath, "utf8");
      // \newlabel{label}{{number}{page}}
      const regex = /\\newlabel\{([^}]+)\}\{\{([^}]+)\}/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(aux)) !== null) {
        const [, label, number] = match;
        // The first group in the value is the counter (e.g., figure number)
        if (!labelMap.has(label)) {
          labelMap.set(label, number);
        }
      }
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  return labelMap;
}

export function replaceFigureReferences(text: string, labelNumbers: Map<string, string>): string {
  if (!text) return text;

  // Detect Vietnamese context:
  // 1. Explicit package usage
  // 2. Usage of 'dethi' package (implies Vietnamese context for this project)
  // 3. Usage of macros like '\baitracnghiem' (from dethi)
  const useVietnamPkg = /\\usepackage(\[.*\])?\{vietnam\}/.test(text);
  const useBabelVietnamese = /\\usepackage\[.*vietnamese.*\]\{babel\}/.test(text);
  const useDethi = /\\usepackage\{dethi\}/.test(text);
  const useMacro = text.includes("\\baitracnghiem");

  const isVietnamese = useVietnamPkg || useBabelVietnamese || useDethi || useMacro;

  const figureName = isVietnamese ? "Hình" : "Figure";

  return text.replace(/\\figurename\s*~\s*\\ref\{([^}]+)\}/g, (_match, label) => {
    const resolved = labelNumbers.get(label.trim());
    return resolved ? `${figureName} ${resolved}` : `${figureName} ${label.trim()}`;
  });
}
