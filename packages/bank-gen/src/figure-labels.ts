import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const LATEX_CMD = process.env.LATEX_CMD ?? "pdflatex";

export function collectFigureLabelNumbers(files: string[]): Map<string, string> {
  if (files.length === 0) return new Map();

  const labelMap = new Map<string, string>();

  // Try to find the real repository root by looking for critical project files
  // Search upwards from the first input file's directory
  let repoRoot = resolve(dirname(files[0]));
  let current = repoRoot;
  let found = false;
  while (current !== dirname(current)) {
    if (existsSync(join(current, "dethi.sty"))) {
      repoRoot = current;
      found = true;
      break;
    }
    current = dirname(current);
  }
  if (!found) {
    current = process.cwd();
    while (current !== dirname(current)) {
      if (existsSync(join(current, "dethi.sty"))) {
        repoRoot = current;
        break;
      }
      current = dirname(current);
    }
  }

  const workDir = mkdtempSync(join(tmpdir(), "figure-labels-"));
  const wrapperPath = join(workDir, "wrapper.tex");

  const inputs = files
    .map((f) => `\\setcounter{figure}{0}\n\\input{${f.split("\\").join("/")}}`)
    .join("\n");

  const wrapperContent = `
\\documentclass[11pt]{article}
\\usepackage[utf8]{vietnam}
\\usepackage{amsmath,amssymb}
\\usepackage{graphics}
\\usepackage{tikz}
\\usepackage{circuitikz}
\\usetikzlibrary{calc,intersections,arrows,arrows.meta,backgrounds,circuits.logic.US,shapes,positioning,fit,decorations}
\\usepackage{float}
\\begin{document}
\\makeatletter
\\renewcommand{\\fps@figure}{H}
\\makeatother
\\providecommand{\\baitracnghiem}[4]{#2 #3}
\\providecommand{\\bonpa}[6][0]{#2 #3 #4 #5 #6}
\\providecommand{\\figurename}{Hình}
${inputs}
\\end{document}
`;
  writeFileSync(wrapperPath, wrapperContent);

  const delimiter = process.platform === "win32" ? ";" : ":";
  // More robust TEXINPUTS: current dir, repoRoot recursively, and repoRoot itself
  const texInputs = `.${delimiter}${repoRoot}${process.platform === "win32" ? "//" : "//:"}${delimiter}${repoRoot}${delimiter}`;

  try {
    console.log(`[bank-gen] Collecting labels using ${LATEX_CMD}...`);
    // Run twice to ensure labels are resolved
    for (let run = 1; run <= 2; run++) {
      const result = spawnSync(
        LATEX_CMD,
        ["-interaction=nonstopmode", "-output-directory", workDir, "wrapper.tex"],
        {
          cwd: workDir,
          encoding: "utf8",
          env: { ...process.env, TEXINPUTS: texInputs }
        }
      );

      if (result.error) {
        console.error(`[bank-gen] Failed to run ${LATEX_CMD}: ${result.error.message}`);
        break;
      }

      if (result.status !== 0) {
        console.warn(`[bank-gen] ${LATEX_CMD} run ${run} returned status ${result.status}.`);
      }
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

        const valueIndex = part.indexOf("{", labelEnd);
        if (valueIndex === -1) continue;

        // The value part is usually { {number} {page} ... }
        // We want the content of the first inner brace
        let pos = valueIndex + 1;
        while (pos < part.length && /\s/.test(part[pos])) pos++;
        if (part[pos] !== "{") continue;

        let numberStart = pos + 1;
        let depth = 1;
        let p = numberStart;
        while (p < part.length && depth > 0) {
          if (part[p] === "{") depth++;
          else if (part[p] === "}") depth--;
          p++;
        }

        if (depth === 0) {
          let numberText = part.slice(numberStart, p - 1);
          // Strip common LaTeX decorations
          numberText = numberText.replace(/\\(?:arabic|@arabic|alph|Alph|roman|Roman|number|foreignlanguage\{[^}]+\}|protect|unhbox|voidb@x|hbox)\s*\{?([^}]+)\}?/g, "$1");
          // Remove any remaining braces and tags
          numberText = numberText.replace(/[\{\}]/g, "").trim();

          if (label && numberText && !labelMap.has(label)) {
            console.log(`[bank-gen] Detected label: ${label} -> ${numberText}`);
            labelMap.set(label, numberText);
          }
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
    if (resolved === undefined) {
      console.warn(`[bank-gen] Warning: Reference label '${trimmedLabel}' not found in label map.`);
    }
    if (prefix) {
      display = `${figureName} ${display}`;
    }

    return `<a href="#fig-${trimmedLabel}" class="latex-ref">${display}</a>`;
  });
}
