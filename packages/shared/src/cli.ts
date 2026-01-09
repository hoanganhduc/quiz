#!/usr/bin/env node
import { Command } from "commander";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import {
  buildLatexQuestions,
  canvasZipToLatex,
  exportCanvasZip,
  importCanvasZip,
  latexToCanvasZip,
  parseLatexQuestions
} from "./importers/index.js";
import { guessMimeFromPath, ImportedAsset } from "./importers/shared/assets.js";
import type { AnswerKey, ImportOptions, QuizJson } from "./importers/latex/latexParse.js";

function parseJsonArg(value?: string): any {
  if (!value) return undefined;
  if (value.startsWith("@")) {
    const path = value.slice(1);
    return JSON.parse(readFileSync(path, "utf8"));
  }
  if (value.endsWith(".json")) {
    return JSON.parse(readFileSync(value, "utf8"));
  }
  return JSON.parse(value);
}

function buildImportOptions(opts: any): ImportOptions {
  return {
    courseCode: opts.courseCode,
    subject: opts.subject,
    level: opts.level,
    versionIndex: opts.versionIndex ? Number(opts.versionIndex) : undefined,
    topicByQuizTitle: parseJsonArg(opts.topicByQuizTitle),
    fillBlankExportMode: opts.fillBlankExportMode,
    combinedDelimiter: opts.combinedDelimiter
  };
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}

function walkFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function loadAssetsFromDir(assetsDir: string): ImportedAsset[] {
  const root = resolve(assetsDir);
  if (!statSync(root).isDirectory()) {
    throw new Error(`Assets path is not a directory: ${assetsDir}`);
  }
  const files = walkFiles(root);
  return files.map((file) => {
    const rel = relative(root, file).replace(/\\/g, "/");
    return {
      zipPath: rel,
      bytes: readFileSync(file),
      mime: guessMimeFromPath(rel),
      suggestedName: basename(file)
    };
  });
}

const program = new Command();
program.name("quiz-import").description("Import/export utilities for Canvas QTI/IMS-CC and LaTeX");
program
  .option("--courseCode <code>", "Course code (e.g. MAT3500)", "MAT3500")
  .option("--subject <subject>", "Subject slug", "discrete-math")
  .option("--level <level>", "Default level", "basic")
  .option("--versionIndex <n>", "Version index")
  .option("--topicByQuizTitle <jsonOrPath>", "JSON mapping quiz title -> topic, or @file.json")
  .option("--fillBlankExportMode <mode>", "combined_short_answer or split_items")
  .option("--combinedDelimiter <delimiter>", "Delimiter for combined fill-blank export", "; ");

program
  .command("canvas-import")
  .description("Import Canvas IMS-CC ZIP to app JSON")
  .argument("<zip>", "Path to IMS-CC zip")
  .option("--out <dir>", "Output directory", "out")
  .action(async (zip, cmd) => {
    const opts = buildImportOptions(program.opts());
    const result = await importCanvasZip(zip, opts);
    const outDir = resolve(cmd.out);
    mkdirSync(outDir, { recursive: true });
    writeJson(join(outDir, "quizzes.json"), result.quizzes);
    writeJson(join(outDir, "answerKey.json"), result.answerKey);
    writeJson(join(outDir, "warnings.json"), result.warnings);
    for (const asset of result.assets) {
      const outPath = join(outDir, "assets", asset.zipPath);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, asset.bytes);
    }
  });

program
  .command("canvas-export")
  .description("Export app JSON to Canvas IMS-CC ZIP")
  .requiredOption("--quizzes <file>", "quizzes.json")
  .requiredOption("--answerKey <file>", "answerKey.json")
  .requiredOption("--out <zip>", "Output zip path")
  .option("--assets <dir>", "Assets directory (same layout as import)")
  .action(async (cmd) => {
    const opts = buildImportOptions(program.opts());
    const quizzes = JSON.parse(readFileSync(cmd.quizzes, "utf8")) as QuizJson[];
    const answerKey = JSON.parse(readFileSync(cmd.answerKey, "utf8")) as AnswerKey;
    const assets = cmd.assets ? loadAssetsFromDir(cmd.assets) : [];
    const zipBytes = await exportCanvasZip(quizzes, answerKey, assets, opts);
    writeFileSync(cmd.out, zipBytes);
  });

program
  .command("latex-parse")
  .description("Parse LaTeX questions into app JSON")
  .argument("<tex>", "Path to .tex file")
  .option("--topic <topic>", "Override topic for versionId")
  .option("--out <dir>", "Output directory", "out")
  .action(async (tex, cmd) => {
    const opts = buildImportOptions(program.opts());
    const content = readFileSync(tex, "utf8");
    const result = await parseLatexQuestions(content, { ...opts, topic: cmd.topic });
    const outDir = resolve(cmd.out);
    mkdirSync(outDir, { recursive: true });
    writeJson(join(outDir, "quiz.json"), result.quiz);
    writeJson(join(outDir, "answerKey.json"), result.answerKey);
    writeJson(join(outDir, "warnings.json"), result.warnings);
  });

program
  .command("latex-build")
  .description("Build LaTeX from app JSON + AnswerKey")
  .requiredOption("--quiz <file>", "quiz.json")
  .requiredOption("--answerKey <file>", "answerKey.json")
  .requiredOption("--out <file>", "Output .tex file")
  .option("--includeSolutions <boolean>", "Include solutions", "true")
  .action((cmd) => {
    const opts = buildImportOptions(program.opts());
    const quiz = JSON.parse(readFileSync(cmd.quiz, "utf8")) as QuizJson;
    const answerKey = JSON.parse(readFileSync(cmd.answerKey, "utf8")) as AnswerKey;
    const includeSolutions = cmd.includeSolutions !== "false";
    const tex = buildLatexQuestions(quiz, answerKey, { ...opts, includeSolutions });
    writeFileSync(cmd.out, tex, "utf8");
  });

program
  .command("canvas-to-latex")
  .description("Convert Canvas IMS-CC ZIP to LaTeX")
  .argument("<zip>", "Path to IMS-CC zip")
  .option("--out <dir>", "Output directory", "out")
  .action(async (zip, cmd) => {
    const opts = buildImportOptions(program.opts());
    const result = await canvasZipToLatex(zip, opts);
    const outDir = resolve(cmd.out);
    mkdirSync(outDir, { recursive: true });
    writeJson(join(outDir, "answerKey.json"), result.answerKey);
    writeJson(join(outDir, "warnings.json"), result.warnings);
    for (const [versionId, latex] of Object.entries(result.latexByQuizVersionId)) {
      const safeName = versionId.replace(/[^a-z0-9-_]+/gi, "_");
      writeFileSync(join(outDir, `${safeName}.tex`), latex, "utf8");
    }
    for (const asset of result.assets) {
      const outPath = join(outDir, "assets", asset.zipPath);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, asset.bytes);
    }
  });

program
  .command("latex-to-canvas")
  .description("Convert LaTeX to Canvas IMS-CC ZIP")
  .argument("<tex>", "Path to .tex file")
  .requiredOption("--quizTitle <title>", "Quiz title")
  .requiredOption("--topic <topic>", "Topic slug")
  .requiredOption("--out <zip>", "Output zip path")
  .action(async (tex, cmd) => {
    const opts = buildImportOptions(program.opts());
    const content = readFileSync(tex, "utf8");
    const result = await latexToCanvasZip(content, {
      ...opts,
      quizTitle: cmd.quizTitle,
      topic: cmd.topic
    });
    writeFileSync(cmd.out, result.zipBytes);
    const outDir = dirname(resolve(cmd.out));
    writeJson(join(outDir, "answerKey.json"), result.answerKey);
    writeJson(join(outDir, "warnings.json"), result.warnings);
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
