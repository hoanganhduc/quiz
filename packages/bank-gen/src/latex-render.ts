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
};

const BLOCK_REGEX = /\\begin\{(tikzpicture|tikz|table|tabular|figure)\}[\s\S]*?\\end\{\1\}/g;

function normalizeAssetsBase(value: string): string {
  if (!value) return value;
  return value.endsWith("/") ? value : `${value}/`;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function normalizeBlockForRender(block: string): string {
  const normalized = block.replace(/\r\n/g, "\n");
  if (/^\s*\\begin\{(tikzpicture|tikz)\}/.test(normalized)) {
    return normalized.replace(/\n\s*\n+/g, "\n");
  }
  return normalized;
}

function buildTexDocument(body: string): string {
  return [
    "\\documentclass[preview]{standalone}",
    "\\usepackage{amsmath,amssymb}",
    "\\usepackage{adjustbox}",
    "\\usepackage{array,booktabs,longtable}",
    "\\usepackage{graphicx}",
    "\\usepackage{tikz}",
    "\\usetikzlibrary{calc,intersections,arrows,backgrounds,circuits.logic.US}",
    "\\usepackage{tkz-base}",
    "\\usepackage{tkz-euclide}",
    "\\usepackage{tkz-tab}",
    "\\usepackage[T5]{fontenc}",
    "\\usepackage[utf8]{vietnam}",
    "\\pagestyle{empty}",
    "\\begin{document}",
    body,
    "\\end{document}",
    ""
  ].join("\n");
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

function runLatexToPng(texBody: string, outputPath: string, dpi: number): void {
  const workDir = mkdtempSync(join(tmpdir(), "latex-render-"));
  const texPath = join(workDir, "snippet.tex");
  const pdfPath = join(workDir, "snippet.pdf");

  try {
    writeFileSync(texPath, buildTexDocument(texBody), "utf8");
    const latex = spawnSync("lualatex", ["-interaction=nonstopmode", "-halt-on-error", "-output-directory", workDir, texPath], {
      encoding: "utf8"
    });
    if (latex.status !== 0 || !existsSync(pdfPath)) {
      throw new Error(`lualatex failed: ${latex.stderr || latex.stdout}`);
    }
    renderPdfToPng(pdfPath, outputPath, dpi, workDir);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

function renderBlockToImage(block: string, opts: RenderOptions): string {
  const normalized = normalizeBlockForRender(block);
  const hash = hashContent(normalized);
  const filename = `latex-${hash}.png`;
  const outputPath = resolve(opts.assetsDir, filename);
  if (!existsSync(outputPath)) {
    runLatexToPng(normalized, outputPath, opts.dpi ?? 220);
  }
  const base = normalizeAssetsBase(opts.assetsBase);
  return `${base}${filename}`;
}

function replaceBlocks(text: string, opts: RenderOptions): string {
  if (!text) return text;
  return text.replace(BLOCK_REGEX, (match) => `\\includegraphics{${renderBlockToImage(match, opts)}}`);
}

function renderQuestionPublic(q: QuestionPublicV1, opts: RenderOptions): QuestionPublicV1 {
  if (q.type === "mcq-single") {
    return {
      ...q,
      prompt: replaceBlocks(q.prompt, opts),
      choices: q.choices.map((c) => ({ ...c, text: replaceBlocks(c.text, opts) }))
    };
  }
  if (q.type === "fill-blank") {
    return { ...q, prompt: replaceBlocks(q.prompt, opts) };
  }
  return q;
}

function renderQuestionAnswers(q: QuestionAnswersV1, opts: RenderOptions): QuestionAnswersV1 {
  if (q.type === "mcq-single") {
    return {
      ...q,
      prompt: replaceBlocks(q.prompt, opts),
      choices: q.choices.map((c) => ({ ...c, text: replaceBlocks(c.text, opts) })),
      solution: q.solution ? replaceBlocks(q.solution, opts) : q.solution
    };
  }
  if (q.type === "fill-blank") {
    return {
      ...q,
      prompt: replaceBlocks(q.prompt, opts),
      solution: q.solution ? replaceBlocks(q.solution, opts) : q.solution
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
