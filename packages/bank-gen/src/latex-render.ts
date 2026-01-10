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

function buildTexDocument(body: string): string {
  return [
    "\\documentclass[preview]{standalone}",
    "\\usepackage{amsmath,amssymb}",
    "\\usepackage{array,booktabs}",
    "\\usepackage{graphicx}",
    "\\usepackage{tikz}",
    "\\pagestyle{empty}",
    "\\begin{document}",
    body,
    "\\end{document}",
    ""
  ].join("\n");
}

function runLatexToPng(texBody: string, outputPath: string, dpi: number): void {
  const workDir = mkdtempSync(join(tmpdir(), "latex-render-"));
  const texPath = join(workDir, "snippet.tex");
  const pdfPath = join(workDir, "snippet.pdf");
  const pngBase = join(workDir, "snippet");

  try {
    writeFileSync(texPath, buildTexDocument(texBody), "utf8");
    const latex = spawnSync("lualatex", ["-interaction=nonstopmode", "-halt-on-error", "-output-directory", workDir, texPath], {
      encoding: "utf8"
    });
    if (latex.status !== 0 || !existsSync(pdfPath)) {
      throw new Error(`lualatex failed: ${latex.stderr || latex.stdout}`);
    }
    const ppm = spawnSync(
      "pdftoppm",
      ["-png", "-singlefile", "-r", String(dpi), pdfPath, pngBase],
      { encoding: "utf8" }
    );
    const pngPath = `${pngBase}.png`;
    if (ppm.status !== 0 || !existsSync(pngPath)) {
      throw new Error(`pdftoppm failed: ${ppm.stderr || ppm.stdout}`);
    }
    mkdirSync(dirname(outputPath), { recursive: true });
    copyFileSync(pngPath, outputPath);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

function renderBlockToImage(block: string, opts: RenderOptions): string {
  const hash = hashContent(block);
  const filename = `latex-${hash}.png`;
  const outputPath = resolve(opts.assetsDir, filename);
  if (!existsSync(outputPath)) {
    runLatexToPng(block, outputPath, opts.dpi ?? 220);
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
