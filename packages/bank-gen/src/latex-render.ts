import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import type { BankAnswersV1, BankPublicV1, QuestionAnswersV1, QuestionPublicV1 } from "@app/shared";
import type { LabelMap } from "./figure-labels.js";

type RenderOptions = {
  assetsDir: string;
  assetsBase: string;
  dpi?: number;
  labelData?: LabelMap;
  language?: "en" | "vi";
};

const ENV_LIST = "tikzpicture|tikz|table|tabular|figure|figwindow|tabwindow|algorithm|algo";
// Group 3 is the environment name because Group 1 is minipage match and Group 2 is block match.
const BLOCK_PATTERN = `\\\\begin\\{(${ENV_LIST})\\}(?:\\[[^\\]]*\\])?[\\s\\S]*?\\\\end\\{\\3\\}`;
const MINIPAGE_PATTERN = "(?:\\\\begin\\{minipage\\}(?:\\[[^\\]]*\\])?\\{[^}]+\\}[\\s\\S]*?\\\\end\\{minipage\\}[~%\\s]*)+";
const COMBINED_REGEX = new RegExp(`(${MINIPAGE_PATTERN})|(${BLOCK_PATTERN})`, "g");

const MACRO_REGEX = /\\dongkhung\{((?:[^{}]|{[^{}]*})*)\}/g;

function normalizeAssetsBase(value: string): string {
  if (!value) return value;
  return value.endsWith("/") ? value : `${value}/`;
}

function hashContent(content: string): string {
  // Use the same normalization as collectSequentialLabels for consistency
  const normalized = content.replace(/\r\n?/g, "\n").trim();
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

function normalizeBlockForRender(block: string): string {
  let normalized = block.replace(/\r\n?/g, "\n");
  if (/^\s*\\begin\{(tikzpicture|tikz)\}/.test(normalized)) {
    // Some sources may inject blank lines or even literal \par inside the optional argument,
    // which makes TikZ fail with "Paragraph ended before \\tikz@picture was complete".
    normalized = normalized.replace(
      /\\begin\{(tikzpicture|tikz)\}(\s*)\[([\s\S]*?)\]/,
      (_m, env: string, ws: string, opts: string) => {
        const cleaned = opts
          .replace(/^[\t ]*%.*$/gm, "")
          .replace(/(?<!\\)%.*$/gm, "")
          .replace(/\\par\b/g, " ")
          .replace(/\s*\n\s*/g, " ")
          .replace(/\s{2,}/g, " ")
          .trim();
        return `\\begin{${env}}${ws}[${cleaned}]`;
      }
    );
    normalized = normalized.replace(/\n[\t ]*\n+/g, "\n");
  }
  normalized = normalized.replace(/\]\s*\n\s*\n+/g, "]\n");
  normalized = normalized.replace(/\n\s*\n+/g, "\n");
  return normalized;
}

function buildTexDocument(body: string, initialFigureCounter?: number): string {
  const parts = [
    "\\documentclass[preview,varwidth=21cm,border=3pt]{standalone}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage{amsmath,amssymb}",
    "\\usepackage{mathpazo}",
    "\\usepackage{adjustbox}",
    "\\usepackage{array,booktabs,longtable}",
    "\\usepackage{graphicx}",
    "\\usepackage{varwidth}",
    "\\usepackage{tikz}",
    "\\usetikzlibrary{calc,intersections,arrows,backgrounds,circuits.logic.US}",
    "\\usepackage{tkz-base}",
    "\\usepackage{tkz-euclide}",
    "\\usepackage{tkz-tab}",
    "\\usepackage[T5]{fontenc}",
    "\\usepackage[utf8]{vietnam}",
    "\\usepackage{xcolor}",
    "\\pagestyle{empty}",
    "\\newcommand{\\dongkhung}[1]{\\par\\noindent\\fbox{\\begin{minipage}{\\linewidth-2\\fboxsep}\\vspace{0.15cm}#1\\vspace{0.15cm}\\end{minipage}}\\par}",
    // Algorithm environments from dethi.sty
    "\\def\\beginAlgoTabbing{\\begin{minipage}{1in}\\begin{tabbing}\\quad\\=\\qquad\\=\\qquad\\=\\qquad\\=\\qquad\\=\\qquad\\=\\qquad\\=\\qquad\\=\\qquad\\=\\qquad\\=\\qquad\\=\\qquad\\=\\qquad\\=\\kill}",
    "\\def\\endAlgoTabbing{\\end{tabbing}\\end{minipage}}",
    "\\newenvironment{algorithm}{\\begin{tabular}{|l|}\\hline\\beginAlgoTabbing}{\\endAlgoTabbing\\\\\\hline\\end{tabular}}",
    "\\newenvironment{algo}{\\begin{center}\\small\\begin{algorithm}}{\\end{algorithm}\\end{center}}",
    "\\def\\Comment#1{{\\textsf{\\textsl{$\\langle\\!\\langle$#1\\/$\\rangle\\!\\rangle$}}}}",
    // Additional macros from dethi.sty for algorithm formatting
    "\\def\\textul#1{\\underline{\\smash{#1}\\vphantom{.}}}",
    "\\def\\mathsc#1{\\text{\\textsc{#1}}}",
    "\\def\\Floor#1{\\left\\lfloor #1 \\right\\rfloor}",
    "\\def\\Ceil#1{\\left\\lceil #1 \\right\\rceil}"
  ];

  if (initialFigureCounter !== undefined) {
    parts.push(`\\setcounter{figure}{${initialFigureCounter}}`);
  }

  parts.push("\\begin{document}", body, "\\end{document}", "");
  return parts.join("\n");
}

type RenderTool = {
  name: string;
  cmd: string;
  args: (pdfPath: string, outputBase: string, outputPath: string, dpi: number) => string[];
  output: (outputBase: string, outputPath: string) => string;
};

const RENDER_TOOLS: RenderTool[] = [
  {
    name: "pdftoppm",
    cmd: "pdftoppm",
    args: (pdfPath, outputBase, _outputPath, dpi) => ["-png", "-singlefile", "-r", String(dpi), pdfPath, outputBase],
    output: (outputBase) => `${outputBase}.png`
  },
  {
    name: "pdftocairo",
    cmd: "pdftocairo",
    args: (pdfPath, outputBase, _outputPath, dpi) => ["-png", "-singlefile", "-r", String(dpi), pdfPath, outputBase],
    output: (outputBase) => `${outputBase}.png`
  },
  {
    name: "magick",
    cmd: "magick",
    args: (pdfPath, _outputBase, outputPath, dpi) => ["-density", String(dpi), pdfPath, "-quality", "100", outputPath],
    output: (_outputBase, outputPath) => outputPath
  },
  {
    name: "convert",
    cmd: "convert",
    args: (pdfPath, _outputBase, outputPath, dpi) => ["-density", String(dpi), pdfPath, "-quality", "100", outputPath],
    output: (_outputBase, outputPath) => outputPath
  },
  {
    name: "gs",
    cmd: "gs",
    args: (pdfPath, _outputBase, outputPath, dpi) => [
      "-dSAFER",
      "-dBATCH",
      "-dNOPAUSE",
      `-r${dpi}`,
      "-sDEVICE=pngalpha",
      `-sOutputFile=${outputPath}`,
      pdfPath
    ],
    output: (_outputBase, outputPath) => outputPath
  },
  {
    name: "mutool",
    cmd: "mutool",
    args: (pdfPath, _outputBase, outputPath, dpi) => ["draw", "-r", String(dpi), "-o", outputPath, pdfPath],
    output: (_outputBase, outputPath) => outputPath
  }
];

function renderPdfToPng(pdfPath: string, outputPath: string, dpi: number, workDir: string): void {
  const outputBase = join(workDir, "snippet");
  const errors: string[] = [];
  mkdirSync(dirname(outputPath), { recursive: true });

  for (const tool of RENDER_TOOLS) {
    const args = tool.args(pdfPath, outputBase, outputPath, dpi);
    const res = spawnSync(tool.cmd, args, { encoding: "utf8" });
    if (res.error && (res.error as any).code === "ENOENT") {
      errors.push(`${tool.name}: not found`);
      continue;
    }
    const expectedPath = tool.output(outputBase, outputPath);
    if (res.status === 0 && existsSync(expectedPath)) {
      mkdirSync(dirname(outputPath), { recursive: true });
      copyFileSync(expectedPath, outputPath);
      return;
    }
    const message = res.stderr || res.stdout || "unknown error";
    errors.push(`${tool.name}: ${message.trim()}`);
  }

  throw new Error(`No PDF renderer available. Tried: ${errors.join(" | ")}`);
}

const LATEX_CMD = process.env.LATEX_CMD ?? "pdflatex";
const LATEX_DEBUG = ["1", "true", "yes"].includes((process.env.LATEX_DEBUG ?? "").toLowerCase());

function runLatexToPng(texBody: string, outputPath: string, dpi: number, initialFigureCounter?: number): void {
  const workDir = mkdtempSync(join(tmpdir(), "latex-render-"));
  const texPath = join(workDir, "snippet.tex");
  const pdfPath = join(workDir, "snippet.pdf");
  const logPath = join(workDir, "snippet.log");

  try {
    writeFileSync(texPath, buildTexDocument(texBody, initialFigureCounter), "utf8");
    const latex = spawnSync(LATEX_CMD, ["-interaction=nonstopmode", "-halt-on-error", "snippet.tex"], {
      cwd: workDir,
      encoding: "utf8"
    });
    if (LATEX_DEBUG) {
      console.error(
        [
          `[latex-render] cmd=${LATEX_CMD}`,
          `[latex-render] workDir=${workDir}`,
          `[latex-render] tex=${texPath}`,
          `[latex-render] pdf=${pdfPath}`,
          `[latex-render] log=${logPath}`,
          `[latex-render] status=${latex.status}`
        ].join("\n")
      );
      if (latex.stdout) console.error(`[latex-render] stdout:\n${latex.stdout}`);
      if (latex.stderr) console.error(`[latex-render] stderr:\n${latex.stderr}`);
    }
    if (latex.status !== 0 || !existsSync(pdfPath)) {
      const log = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
      const logTail = log ? log.split("\n").slice(-80).join("\n") : "";
      const details = [latex.stderr, latex.stdout, logTail].filter(Boolean).join("\n");
      throw new Error(`${LATEX_CMD} failed: ${details}`);
    }
    renderPdfToPng(pdfPath, outputPath, dpi, workDir);
  } finally {
    if (LATEX_DEBUG) {
      console.error(`[latex-render] debug enabled; preserving ${workDir}`);
    } else {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
}

function renderBlockToImage(block: string, opts: RenderOptions): string {
  const normalized = normalizeBlockForRender(block);

  // Try to find a label or hash to sync figure number
  let initialFigureCounter: number | undefined;
  if (opts.labelData) {
    const labelMatch = /\\label\s*\{([^}]+)\}/.exec(normalized);
    const label = labelMatch ? labelMatch[1].trim() : "";
    const hash = hashContent(block);

    const numberStr = (label && opts.labelData.labels.get(label)) || opts.labelData.hashes.get(hash);

    if (numberStr) {
      const num = parseInt(numberStr, 10);
      if (!isNaN(num)) {
        initialFigureCounter = num - 1;
      }
    }
  }

  const hash = hashContent(normalized + (initialFigureCounter ?? ""));
  const filename = `latex-${hash}.png`;
  const outputPath = resolve(opts.assetsDir, filename);
  if (!existsSync(outputPath)) {
    runLatexToPng(normalized, outputPath, opts.dpi ?? 220, initialFigureCounter);
  }
  const base = normalizeAssetsBase(opts.assetsBase);
  return `${base}${filename}`;
}

function stripCommentLines(text: string): string {
  if (!text) return text;
  return text.replace(/^\s*%.*$/gm, "");
}

function extractCommandContent(text: string, command: string): { content: string; fullMatch: string } | null {
  const token = `\\${command}`;
  const start = text.indexOf(token);
  if (start === -1) return null;

  // Search for { after the command, skipping whitespace
  let braceStart = -1;
  for (let i = start + token.length; i < text.length; i++) {
    const char = text[i];
    if (char === "{") {
      braceStart = i;
      break;
    }
    if (!/\s/.test(char)) break; // Found non-whitespace before {
    // If we hit something else, it might be command without args (unlikely here)
  }

  if (braceStart === -1) return null;

  let pos = braceStart + 1;
  let depth = 1;
  while (pos < text.length && depth > 0) {
    if (text[pos] === "{") depth += 1;
    else if (text[pos] === "}") depth -= 1;
    pos += 1;
  }

  if (depth === 0) {
    return {
      content: text.slice(braceStart + 1, pos - 1),
      fullMatch: text.slice(start, pos)
    };
  }
  return null;
}

function replaceBlocks(text: string, opts: RenderOptions): string {
  if (!text) return text;
  let cleaned = stripCommentLines(text);

  return cleaned.replace(COMBINED_REGEX, (match, minipageMatch, blockMatch) => {
    // If it matched the minipage pattern (Group 1), render it as an image
    if (minipageMatch) {
      return `\\includegraphics{${renderBlockToImage(minipageMatch, opts)}}`;
    }

    // If it matched the normal block pattern (Group 2)
    const envName = (match.match(/\\begin\{([^}]+)\}/) || [])[1];
    if (!envName) return match;

    const isFigure = /^(figure|figwindow)$/.test(envName);
    const isMath = /^(align|equation|gather|multline|alignat|flalign)\*?$/.test(envName);

    // Extract ALL labels
    const allLabels: string[] = [];
    const LABEL_REG = /\\label\s*\{([^}]+)\}/g;
    let lMatch;
    while ((lMatch = LABEL_REG.exec(match)) !== null) {
      allLabels.push(lMatch[1].trim());
    }

    if (isFigure) {
      let contentForImage = match;
      let primaryLabel = "";
      let captionText = "";

      const captionRes = extractCommandContent(match, "caption");
      if (captionRes) {
        captionText = captionRes.content.trim();
        contentForImage = contentForImage.replace(captionRes.fullMatch, "");

        // Match label AFTER caption start
        const textAfterCaption = match.slice(match.indexOf(captionRes.fullMatch) + captionRes.fullMatch.length);
        LABEL_REG.lastIndex = 0;
        const nextLabelMatch = LABEL_REG.exec(textAfterCaption);
        if (nextLabelMatch) {
          primaryLabel = nextLabelMatch[1].trim();
        }
      }

      // Fallback for primary label
      if (!primaryLabel && allLabels.length > 0) {
        primaryLabel = allLabels[allLabels.length - 1];
      }

      const imgUrl = renderBlockToImage(contentForImage, opts);
      const hash = hashContent(match);
      const placeholderId = primaryLabel || hash;
      const figureNumberPlaceholder = `<span class="latex-fig-num" data-label="${placeholderId}">[[FIG_NUM_${placeholderId}]]</span>`;

      const figureAttrs = [
        placeholderId ? `id="fig-${placeholderId}"` : "",
        `data-latex-type="figure"`,
        `data-label="${placeholderId}"`
      ].filter(Boolean).join(" ");

      const prefix = opts.language === "en" ? "Figure" : "Hình";
      const figcaption = `<figcaption>${prefix} ${figureNumberPlaceholder}: ${captionText}</figcaption>`;

      // Create anchors for all labels so they all jump to this figure
      const anchors = allLabels
        .filter((l) => l !== primaryLabel)
        .map((l) => `<div id="fig-${l}" class="latex-anchor" data-latex-type="anchor" data-label="${l}"></div>`)
        .join("\n");

      return `${anchors}\n<figure ${figureAttrs}>\n\\includegraphics{${imgUrl}}\n${figcaption}\n</figure>`;
    }

    // Generic block (math, table, algorithm, etc)
    const imgUrl = renderBlockToImage(match, opts);

    // For math environments, each label needs an anchor that is COUNTED as a figure in our global sequence
    const anchors = allLabels.map((l) => {
      // If it's math, we want the UI to count it so labels match. 
      // In UI logic, data-latex-type="figure" is what triggers a number assignment.
      return `<div id="fig-${l}" class="latex-anchor" data-latex-type="figure" data-label="${l}"></div>`;
    }).join("\n");

    return `${anchors}\n\\includegraphics{${imgUrl}}`;
  });
}

function replaceMacros(text: string, opts: RenderOptions): string {
  if (!text) return text;
  const cleaned = stripCommentLines(text);
  return cleaned.replace(MACRO_REGEX, (match, content) => {
    // Process content recursively
    const inner = renderLatexText(content, opts);
    return `\\dongkhung{${inner}}`;
  });
}

function replaceTypography(text: string): string {
  if (!text) return text;

  // 1. Core typographic replacements
  let result = text
    // Space before citation [N] if not preceded by space
    .replace(/([^\s\[])(\[\d+\])/g, "$1 $2")
    // Em-dash
    .replace(/---/g, "—")
    // Smart quotes -> Double quotes
    .replace(/``/g, '"')
    .replace(/''/g, '"')
    // Math brackets
    .replace(/\\(Floor|floor)\{((?:[^{}]|\{[^{}]*\})*)\}/g, "⌊$2⌋")
    .replace(/\\(Ceil|ceil)\{((?:[^{}]|\{[^{}]*\})*)\}/g, "⌈$2⌉")
    // \emph{...} -> <i>...</i>
    .replace(/\\emph\{((?:[^{}]|\{[^{}]*\})*)\}/g, "<i>$1</i>");

  // 2. Holistic Math Block Fragmentation (\mathsc, \mathsf)
  // We match $ ... $ blocks and fragment them if they contain our styled commands
  result = result.replace(/\$([\s\S]+?)\$/g, (match, content) => {
    if (!/\\(mathsc|mathsf)/.test(content)) return match;

    // Split by these commands (including capturing groups so they are included in the split array)
    const parts = content.split(/(\\mathsc\{[^{}]+\}|\\mathsf\{[^{}]+\})/g);
    const converted = parts
      .map((part: string) => {
        if (!part) return "";

        if (part.startsWith("\\mathsc{")) {
          const inner = part.slice(8, -1);
          return `<span style="font-variant: small-caps;">${inner}</span>`;
        }
        if (part.startsWith("\\mathsf{")) {
          const inner = part.slice(8, -1);
          return `<span style="font-family: sans-serif;">${inner}</span>`;
        }

        // For non-command fragments:
        // 1. If it's just whitespace or basic punctuation/separators, keep as plain text
        if (/^[()\[\],.;:!?\s/\-|]+$/.test(part)) return part;

        // 2. Otherwise, treat as math content and re-wrap in $
        return `$${part.trim()}$`;
      })
      .join("");

    return converted;
  });

  // 3. Fallback for \mathsc and \mathsf outside of math blocks
  result = result.replace(/(\\mathsc|\\mathsf)\{([^{}]+)\}/g, (_m, cmd, content) => {
    const style = cmd === "\\mathsc" ? "font-variant: small-caps;" : "font-family: sans-serif;";
    return `<span style="${style}">${content}</span>`;
  });

  // 4. Final cleanup
  return result.replace(/\$\$/g, "");
}

export function renderLatexText(text: string, opts: RenderOptions): string {
  const withBlocks = replaceBlocks(text, opts);
  const withMacros = replaceMacros(withBlocks, opts);
  return replaceTypography(withMacros);
}

function renderQuestionPublic(q: QuestionPublicV1, opts: RenderOptions): QuestionPublicV1 {
  if (q.type === "mcq-single") {
    return {
      ...q,
      prompt: renderLatexText(q.prompt, opts),
      choices: q.choices.map((c) => ({ ...c, text: renderLatexText(c.text, opts) }))
    };
  }
  if (q.type === "fill-blank") {
    return { ...q, prompt: renderLatexText(q.prompt, opts) };
  }
  return q;
}

function renderQuestionAnswers(q: QuestionAnswersV1, opts: RenderOptions): QuestionAnswersV1 {
  if (q.type === "mcq-single") {
    return {
      ...q,
      prompt: renderLatexText(q.prompt, opts),
      choices: q.choices.map((c) => ({ ...c, text: renderLatexText(c.text, opts) })),
      solution: q.solution ? renderLatexText(q.solution, opts) : q.solution
    };
  }
  if (q.type === "fill-blank") {
    return {
      ...q,
      prompt: renderLatexText(q.prompt, opts),
      solution: q.solution ? renderLatexText(q.solution, opts) : q.solution
    };
  }
  return q;
}

export function renderLatexAssets(
  publicBank: BankPublicV1,
  answersBank: BankAnswersV1,
  opts: RenderOptions
): { publicBank: BankPublicV1; answersBank: BankAnswersV1 } {
  const nextPublic = {
    ...publicBank,
    questions: publicBank.questions.map((q) => renderQuestionPublic(q, opts))
  };
  const nextAnswers = {
    ...answersBank,
    questions: answersBank.questions.map((q) => renderQuestionAnswers(q, opts))
  };
  return { publicBank: nextPublic, answersBank: nextAnswers };
}
