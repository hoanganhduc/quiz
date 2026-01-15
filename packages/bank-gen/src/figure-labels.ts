import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const LATEX_CMD = process.env.LATEX_CMD ?? "pdflatex";

export function collectFigureLabelNumbers(files: string[]): Map<string, string> {
  if (files.length === 0) return new Map();

  const labelMap = new Map<string, string>();
  const repoRoot = process.cwd();

  const workDir = mkdtempSync(join(tmpdir(), "figure-labels-"));
  const wrapperPath = join(workDir, "wrapper.tex");

  const inputs = files
    .map((f) => `\\input{${f.split("\\").join("/")}}`)
    .join("\n");

  const wrapperContent = `
\\documentclass[11pt]{article}
\\usepackage{mathpazo}
\\usepackage[baitap]{dethi}
\\usepackage[utf8]{vietnam}
\\usepackage{amsmath,amssymb}
\\usepackage{tikz}
\\usetikzlibrary{calc,intersections,arrows,backgrounds,circuits.logic.US}
\\usepackage{tkz-base}
\\usepackage{tkz-euclide}
\\usepackage{tkz-tab}
\\begin{document}
${inputs}
\\end{document}
`;
  writeFileSync(wrapperPath, wrapperContent);

  const delimiter = process.platform === "win32" ? ";" : ":";
  // Use // suffix for recursive search in many TeX distributions
  const texInputs = `.${delimiter}${repoRoot}${delimiter}${repoRoot}${process.platform === "win32" ? "//" : "//:"}${delimiter}`;

  try {
    const result = spawnSync(
      LATEX_CMD,
      ["-interaction=nonstopmode", "-output-directory", workDir, "wrapper.tex"],
      {
        cwd: workDir,
        encoding: "utf8",
        env: { ...process.env, TEXINPUTS: texInputs }
      }
    );

    if (result.status !== 0 && result.status !== null) {
      console.warn(`[bank-gen] ${LATEX_CMD} returned status ${result.status}. Label collection might be incomplete.`);
    }

    const auxPath = join(workDir, "wrapper.aux");
    if (existsSync(auxPath)) {
      const aux = readFileSync(auxPath, "utf8");

      // Robust parsing of \newlabel{label}{{number}{page}...}
      const labelStarts = aux.split("\\newlabel{");
      for (let i = 1; i < labelStarts.length; i++) {
        const part = labelStarts[i];
        const labelEnd = part.indexOf("}");
        if (labelEnd === -1) continue;
        const label = part.slice(0, labelEnd).trim();

        const valueStart = part.indexOf("{{", labelEnd);
        if (valueStart === -1) continue;

        // Find the matching closing brace for the first argument {{NUMBER}{PAGE}}
        // which is usually the third character after {{ if it's a simple number
        // but we look for the next }
        const numberEnd = part.indexOf("}", valueStart + 2);
        if (numberEnd === -1) continue;

        let numberText = part.slice(valueStart + 2, numberEnd);
        // Strip common LaTeX decorations
        // e.g. \foreignlanguage {vietnam}{4} -> 4
        // e.g. \protect \@arabic {4} -> 4
        numberText = numberText.replace(/\\(?:arabic|@arabic|alph|Alph|roman|Roman|number|foreignlanguage\{[^}]+\}|protect)\s*\{?([^}]+)\}?/g, "$1");
        // Remove any remaining braces
        numberText = numberText.replace(/[\{\}]/g, "").trim();

        if (label && numberText && !labelMap.has(label)) {
          console.debug(`[bank-gen] Found label: ${label} -> ${numberText}`);
          labelMap.set(label, numberText);
        }
      }
    }
  } catch (err) {
    console.error(`[bank-gen] Error during label collection: ${err}`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  console.log(`[bank-gen] Collected ${labelMap.size} figure/table labels.`);
  return labelMap;
}

export function replaceFigureReferences(
  text: string,
  labelNumbers: Map<string, string>,
  language: "en" | "vi" = "vi"
): string {
  if (!text) return text;

  const figureName = language === "vi" ? "Hình" : "Figure";

  // Match \ref{...} with optional \figurename prefix
  return text.replace(/(\\figurename\s*~\s*)?\\ref\{([^}]+)\}/g, (match, prefix, label) => {
    const trimmedLabel = label.trim();
    const resolved = labelNumbers.get(trimmedLabel);

    let display = resolved || trimmedLabel;
    if (prefix) {
      display = `${figureName} ${display}`;
    }

    return `<a href="#fig-${trimmedLabel}" class="latex-ref">${display}</a>`;
  });
}
