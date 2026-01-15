import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import type { BankAnswersV1, BankPublicV1, QuestionAnswersV1, QuestionPublicV1 } from "@app/shared";

type RenderOptions = {
  assetsDir: string;
  assetsBase: string;
  dpi?: number;
  labelNumbers?: Map<string, string>;
};

const BLOCK_REGEX = /\\begin\{(tikzpicture|tikz|table|tabular|figure)\}[\s\S]*?\\end\{\1\}/g;
const MACRO_REGEX = /\\dongkhung\{((?:[^{}]|{[^{}]*})*)\}/g;

function normalizeAssetsBase(value: string): string {
  if (!value) return value;
  return value.endsWith("/") ? value : `${value}/`;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
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
    "\\newcommand{\\dongkhung}[1]{\\par\\noindent\\fbox{\\begin{minipage}{\\linewidth-2\\fboxsep}\\vspace{0.15cm}#1\\vspace{0.15cm}\\end{minipage}}\\par}"
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

  // Try to find a label to sync figure number
  let initialFigureCounter: number | undefined;
  if (opts.labelNumbers) {
    const labelMatch = /\\label\{([^}]+)\}/.exec(normalized);
    if (labelMatch) {
      const label = labelMatch[1];
      const numberStr = opts.labelNumbers.get(label);
      if (numberStr) {
        const num = parseInt(numberStr, 10);
        if (!isNaN(num)) {
          // If figure is 5, we set counter to 4 so next increment is 5.
          initialFigureCounter = num - 1;
        }
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

function replaceBlocks(text: string, opts: RenderOptions): string {
  if (!text) return text;
  const cleaned = stripCommentLines(text);
  return cleaned.replace(BLOCK_REGEX, (match) => `\\includegraphics{${renderBlockToImage(match, opts)}}`);
}

function replaceMacros(text: string, opts: RenderOptions): string {
  if (!text) return text;
  const cleaned = stripCommentLines(text);
  return cleaned.replace(MACRO_REGEX, (match, content) => {
    // Process content recursively
    const inner = renderLatexText(content, opts);
    return `<div class="dongkhung-box" style="border: 1px solid black; padding: 6px; width: 100%; box-sizing: border-box;">${inner}</div>`;
  });
}

function replaceTypography(text: string): string {
  if (!text) return text;
  return text
    // Space before citation [N] if not preceded by space
    .replace(/([^\s\[])(\[\d+\])/g, "$1 $2")
    // Em-dash
    .replace(/---/g, "—")
    // Smart quotes -> Double quotes
    .replace(/``/g, '"')
    .replace(/''/g, '"');
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
