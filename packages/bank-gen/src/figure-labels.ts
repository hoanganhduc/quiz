import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const LATEX_CMD = process.env.LATEX_CMD ?? "pdflatex";

export function collectFigureLabelNumbers(files: string[]): Map<string, string> {
  const labelMap = new Map<string, string>();

  for (const file of files) {
    const workDir = mkdtempSync(join(tmpdir(), "figure-labels-"));
    try {
      let success = true;
      for (let pass = 0; pass < 2; pass += 1) {
        const result = spawnSync(
          LATEX_CMD,
          ["-interaction=nonstopmode", "-halt-on-error", "-output-directory", workDir, basename(file)],
          {
            cwd: dirname(file),
            encoding: "utf8"
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

      const auxPath = join(workDir, `${basename(file, extname(file))}.aux`);
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
