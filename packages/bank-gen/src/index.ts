import { Command } from "commander";
import fg from "fast-glob";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BankAnswersV1,
  BankAnswersV1Schema,
  BankPublicV1,
  BankPublicV1Schema,
  makeUid,
  parseQuestionId,
  ChoiceKey,
  ChoiceV1,
  QuestionAnswersV1,
  QuestionFillBlankAnswersV1,
  QuestionFillBlankPublicV1,
  QuestionMcqAnswersV1,
  QuestionMcqPublicV1,
  QuestionPublicV1
} from "@app/shared";
import { importCanvasZipBytes, type AnswerKey as CanvasAnswerKey } from "@app/shared/importers";
import { z } from "zod";
import { cleanupTempDir, downloadSourcesToTemp, loadSourcesConfigFile } from "./sources.js";
import { renderLatexAssets } from "./latex-render.js";
import { collectSequentialLabels, replaceFigureReferences, type LabelMap } from "./figure-labels.js";

// No hardcoded COURSE_CODE or SUBJECT here.
// They will be loaded from SourcesConfigV1.

export type ParseResult = {
  publicQuestion: QuestionPublicV1;
  answerQuestion: QuestionAnswersV1;
};

function isEscaped(text: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (text[i] === "\\") backslashes += 1;
    else break;
  }
  return backslashes % 2 === 1;
}

export function stripComments(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      for (let i = 0; i < line.length; i += 1) {
        if (line[i] === "%" && !isEscaped(line, i)) {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join("\n");
}

function applyFigureReferencesToQuestion(
  question: ParseResult,
  resolver: (value: string) => string
): ParseResult {
  const updatedPrompt = resolver(question.publicQuestion.prompt);
  const updatedSolution = question.answerQuestion.solution
    ? resolver(question.answerQuestion.solution)
    : question.answerQuestion.solution;

  const updateChoices = (choices: ChoiceV1[]): ChoiceV1[] =>
    choices.map((choice) => ({
      ...choice,
      text: resolver(choice.text)
    }));

  let publicQuestion: QuestionPublicV1;
  let answerQuestion: QuestionAnswersV1;

  if (question.publicQuestion.type === "mcq-single") {
    const mcq = question.publicQuestion as QuestionMcqPublicV1;
    const mcqAnswer = question.answerQuestion as QuestionMcqAnswersV1;
    const choices = updateChoices(mcq.choices);
    publicQuestion = {
      ...mcq,
      prompt: updatedPrompt,
      choices
    };
    answerQuestion = {
      ...mcqAnswer,
      prompt: updatedPrompt,
      choices,
      solution: updatedSolution
    };
  } else {
    const fib = question.publicQuestion as QuestionFillBlankPublicV1;
    const fibAnswer = question.answerQuestion as QuestionFillBlankAnswersV1;
    publicQuestion = {
      ...fib,
      prompt: updatedPrompt
    };
    answerQuestion = {
      ...fibAnswer,
      prompt: updatedPrompt,
      solution: updatedSolution
    };
  }

  return { publicQuestion, answerQuestion };
}

function lineFromIndex(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

export function parseGroup(text: string, startIndex: number, file: string): { content: string; end: number } {
  if (text[startIndex] !== "{") {
    throw new Error(`[${file}:${lineFromIndex(text, startIndex)}] Expected '{' while parsing group`);
  }
  let depth = 0;
  for (let i = startIndex; i < text.length; i += 1) {
    const char = text[i];
    if (char === "{" && !isEscaped(text, i)) {
      depth += 1;
    } else if (char === "}" && !isEscaped(text, i)) {
      depth -= 1;
      if (depth === 0) {
        return { content: text.slice(startIndex + 1, i), end: i + 1 };
      }
    }
  }
  throw new Error(`[${file}:${lineFromIndex(text, startIndex)}] Unbalanced braces while parsing group`);
}

function normalizeForCompare(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function parseChoicesBlock(
  block: string,
  file: string,
  questionIdForErrors: string
): { answerKey: ChoiceKey; choices: ChoiceV1[] } {
  const trimmed = block.trim();
  const supported = [
    { cmd: "\\bonpa", n: 4 },
    { cmd: "\\haipa", n: 2 },
    { cmd: "\\bapa", n: 3 },
    { cmd: "\\nampa", n: 5 }
  ] as const;

  const match = supported.find((m) => trimmed.startsWith(m.cmd));
  if (!match) {
    throw new Error(`[${file}] Expected one of ${supported.map((m) => m.cmd).join(", ")} in choices block`);
  }

  let idx = match.cmd.length;
  // optional [layout]
  if (trimmed[idx] === "[") {
    const closeBracket = trimmed.indexOf("]", idx + 1);
    if (closeBracket === -1) {
      throw new Error(`[${file}] Unterminated layout option in ${match.cmd}`);
    }
    idx = closeBracket + 1;
  }

  const parts: string[] = [];
  for (let i = 0; i < match.n + 1; i += 1) {
    while (/\s/.test(trimmed[idx] ?? "")) idx += 1;
    if (trimmed[idx] !== "{") {
      throw new Error(`[${file}] Expected '{' in ${match.cmd} block`);
    }
    const { content, end } = parseGroup(trimmed, idx, file);
    parts.push(content);
    idx = end;
  }

  const [correctRaw, ...choiceTexts] = parts;
  const correctToken = correctRaw.trim().toUpperCase();
  const mapIndexToKey = ["A", "B", "C", "D", "E"] as ChoiceKey[];

  let answerKey: ChoiceKey;
  if (mapIndexToKey.includes(correctToken as ChoiceKey)) {
    answerKey = correctToken as ChoiceKey;
  } else if (/^[1-5]$/.test(correctToken)) {
    answerKey = mapIndexToKey[Number(correctToken) - 1];
  } else {
    throw new Error(`[${file}] Invalid correct choice code '${correctRaw}' in ${match.cmd}`);
  }

  const allowedKeys = mapIndexToKey.slice(0, match.n);
  if (!allowedKeys.includes(answerKey)) {
    throw new Error(`[${file}] Correct choice '${answerKey}' out of range for ${match.cmd}`);
  }

  const choices: ChoiceV1[] = choiceTexts.map((text, i) => ({
    key: allowedKeys[i],
    text: text.trim()
  }));

  const choiceTextSeen = new Map<string, string>();
  for (const c of choices) {
    const norm = normalizeForCompare(c.text);
    const otherKey = choiceTextSeen.get(norm);
    if (otherKey) {
      throw new Error(
        `[${file}] Duplicate choice text in ${questionIdForErrors}: '${c.text.trim()}' (choices ${otherKey} and ${c.key})`
      );
    }
    choiceTextSeen.set(norm, c.key);
  }

  return { answerKey, choices };
}

class FootnoteManager {
  private count = 1;
  private notes: string[] = [];

  process(text: string): string {
    const cmd = "\\footnote";
    let out = "";
    let i = 0;
    while (i < text.length) {
      const idx = text.indexOf(cmd, i);
      if (idx === -1) {
        out += text.slice(i);
        break;
      }
      out += text.slice(i, idx);

      let pos = idx + cmd.length;
      while (/\s/.test(text[pos] || "")) pos++;

      if (text[pos] !== "{") {
        out += text.slice(idx, pos);
        i = pos;
        continue;
      }

      const { content, end } = parseGroup(text, pos, "footnote-processing");
      const marker = `[${this.count}]`;
      this.notes.push(content);
      this.count++;

      out += marker;
      i = end;
    }
    return out;
  }

  getAppendText(): string {
    if (this.notes.length === 0) return "";
    return "\n\n" + this.notes.map((n, i) => `[${i + 1}] ${n}`).join("\n");
  }
}

function processCitations(text: string): string {
  return text.replace(/\\cite\s*\{([^}]+)\}/g, (_, key) => `[${key}]`);
}

export function parseQuestionsFromContent(
  content: string,
  file: string,
  courseCode: string = "MAT3500",
  subjectId: string = "discrete-math"
): ParseResult[] {
  const results: ParseResult[] = [];
  let cursor = 0;
  while (true) {
    const start = content.indexOf("\\baitracnghiem", cursor);
    if (start === -1) break;
    let pos = start + "\\baitracnghiem".length;
    const groups: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      while (/\s/.test(content[pos] ?? "")) pos += 1;
      if (content[pos] !== "{") {
        throw new Error(`[${file}:${lineFromIndex(content, pos)}] Expected '{' for argument ${i + 1} of \\baitracnghiem`);
      }
      const { content: groupContent, end } = parseGroup(content, pos, file);
      groups.push(groupContent);
      pos = end;
    }
    cursor = pos;

    const [id, promptRaw, choicesRaw, solutionRaw] = groups;
    const { topic, level, number } = parseQuestionId(id);
    const uid = makeUid(courseCode, id);

    // Process footnotes and citations
    const fn = new FootnoteManager();
    const promptProcessed = fn.process(processCitations(promptRaw));
    const choicesProcessed = fn.process(processCitations(choicesRaw));

    const { answerKey, choices } = parseChoicesBlock(choicesProcessed, file, id);

    // Append footnotes to prompt
    const finalPrompt = (promptProcessed.trim() + fn.getAppendText()).trim();

    const publicQuestion: QuestionPublicV1 = {
      uid,
      subject: subjectId,
      type: "mcq-single",
      id,
      topic,
      level,
      number,
      prompt: finalPrompt,
      choices
    };

    const answerQuestion: QuestionAnswersV1 = {
      ...publicQuestion,
      answerKey,
      solution: processCitations(solutionRaw.trim())
    };

    results.push({ publicQuestion, answerQuestion });
  }
  return results;
}

function skipOptionalBracketGroups(text: string, start: number, max: number, file: string): number {
  let pos = start;
  for (let i = 0; i < max; i += 1) {
    while (/\s/.test(text[pos] ?? "")) pos += 1;
    if (text[pos] !== "[") break;
    const close = text.indexOf("]", pos + 1);
    if (close === -1) {
      throw new Error(`[${file}:${lineFromIndex(text, pos)}] Unterminated '[' group`);
    }
    pos = close + 1;
  }
  return pos;
}

function extractInlineBlanks(promptRaw: string, file: string): { maskedPrompt: string; answers: string[] } {
  const answers: string[] = [];
  const underline = "\\underline{\\qquad}";
  let out = "";
  let i = 0;

  const cmds = ["\\blank", "\\answer", "\\daugach"] as const;

  while (i < promptRaw.length) {
    let nextIdx = -1;
    let nextCmd: (typeof cmds)[number] | null = null;
    for (const cmd of cmds) {
      const idx = promptRaw.indexOf(cmd, i);
      if (idx !== -1 && (nextIdx === -1 || idx < nextIdx)) {
        nextIdx = idx;
        nextCmd = cmd;
      }
    }

    if (nextIdx === -1 || !nextCmd) {
      out += promptRaw.slice(i);
      break;
    }

    out += promptRaw.slice(i, nextIdx);
    let pos = nextIdx + nextCmd.length;
    while (/\s/.test(promptRaw[pos] ?? "")) pos += 1;

    if (promptRaw[pos] !== "{") {
      // Not a well-formed macro call, keep going.
      out += nextCmd;
      i = nextIdx + nextCmd.length;
      continue;
    }

    const { content, end } = parseGroup(promptRaw, pos, file);
    if (nextCmd === "\\blank" || nextCmd === "\\answer") {
      answers.push(content.trim());
      out += underline;
    } else {
      // \daugach: underline only, no stored answer
      out += underline;
    }
    i = end;
  }

  return { maskedPrompt: out, answers };
}

export function parseFillBlankQuestionsFromContent(
  content: string,
  file: string,
  courseCode: string = "MAT3500",
  subjectId: string = "discrete-math"
): ParseResult[] {
  const results: ParseResult[] = [];
  let cursor = 0;
  while (true) {
    const start = content.indexOf("\\baidienvao", cursor);
    if (start === -1) break;

    let pos = start + "\\baidienvao".length;
    pos = skipOptionalBracketGroups(content, pos, 2, file);

    const groups: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      while (/\s/.test(content[pos] ?? "")) pos += 1;
      if (content[pos] !== "{") {
        throw new Error(`[${file}:${lineFromIndex(content, pos)}] Expected '{' for argument ${i + 1} of \\baidienvao`);
      }
      const { content: groupContent, end } = parseGroup(content, pos, file);
      groups.push(groupContent);
      pos = end;
    }

    cursor = pos;

    const [id, promptRaw, solutionRaw] = groups;
    const { topic, level, number } = parseQuestionId(id);
    const uid = makeUid(courseCode, id);

    // Process footnotes and citations
    const fn = new FootnoteManager();
    const promptProcessed = fn.process(processCitations(promptRaw));

    const extracted = extractInlineBlanks(promptProcessed, file);
    if (extracted.answers.length === 0) continue;

    // Append footnotes to prompt
    const finalPrompt = (extracted.maskedPrompt.trim() + fn.getAppendText()).trim();

    const publicQuestion: QuestionPublicV1 = {
      uid,
      subject: subjectId,
      type: "fill-blank",
      id,
      topic,
      level,
      number,
      prompt: finalPrompt,
      blankCount: extracted.answers.length
    };

    const answerQuestion: QuestionAnswersV1 = {
      ...publicQuestion,
      answers: extracted.answers,
      solution: processCitations(solutionRaw.trim())
    };

    results.push({ publicQuestion, answerQuestion });
  }
  return results;
}

function getQuestionContentSignature(q: QuestionPublicV1): string {
  if (q.type === "mcq-single") {
    return JSON.stringify({
      type: q.type,
      subject: q.subject,
      prompt: normalizeForCompare(q.prompt),
      choices: q.choices.map((c) => normalizeForCompare(c.text))
    });
  }
  if (q.type === "fill-blank") {
    return JSON.stringify({
      type: q.type,
      subject: q.subject,
      prompt: normalizeForCompare(q.prompt),
      blankCount: q.blankCount
    });
  }
  // Exhaustive in case more types are added.
  return JSON.stringify(q);
}

function ensureUniqueQuestions(
  questions: ParseResult[],
  uidToFileMap: Map<string, string>,
  contentSigMap: Map<string, { uid: string; file: string; id: string }>,
  file: string
): void {
  for (const { publicQuestion } of questions) {
    if (uidToFileMap.has(publicQuestion.uid)) {
      const otherFile = uidToFileMap.get(publicQuestion.uid);
      throw new Error(`Duplicate uid ${publicQuestion.uid} found in ${otherFile} and ${file}`);
    }

    const sig = getQuestionContentSignature(publicQuestion);
    const other = contentSigMap.get(sig);
    if (other) {
      throw new Error(
        `Duplicate question content found: ${other.uid} (${other.file}) and ${publicQuestion.uid} (${file})`
      );
    }

    uidToFileMap.set(publicQuestion.uid, file);
    contentSigMap.set(sig, { uid: publicQuestion.uid, file, id: publicQuestion.id });
  }
}

function writeBanks(publicBank: BankPublicV1, answersBank: BankAnswersV1, subjectId: string): void {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const distDir = resolve(currentDir, "../dist");
  mkdirSync(distDir, { recursive: true });
  writeFileSync(resolve(distDir, `bank.${subjectId}.public.v1.json`), JSON.stringify(publicBank, null, 2), "utf8");
  writeFileSync(resolve(distDir, `bank.${subjectId}.answers.v1.json`), JSON.stringify(answersBank, null, 2), "utf8");

  // Also write default for backward compatibility if it's the only one or marked default
  if (subjectId === "discrete-math") {
    writeFileSync(resolve(distDir, "bank.public.v1.json"), JSON.stringify(publicBank, null, 2), "utf8");
    writeFileSync(resolve(distDir, "bank.answers.v1.json"), JSON.stringify(answersBank, null, 2), "utf8");
  }
}

export async function buildBanksFromFiles(
  filePaths: string[],
  courseCode: string = "MAT3500",
  subjectId: string = "discrete-math"
): Promise<{
  publicBank: BankPublicV1;
  answersBank: BankAnswersV1;
  questions: ParseResult[];
}> {
  if (filePaths.length === 0) {
    throw new Error("No LaTeX files provided");
  }

  const allResults: ParseResult[] = [];
  const seenUid = new Map<string, string>();
  const seenContent = new Map<string, { uid: string; file: string; id: string }>();

  for (const file of filePaths) {
    const raw = readFileSync(file, "utf8");
    const cleaned = stripComments(raw);
    const mcq = parseQuestionsFromContent(cleaned, file, courseCode, subjectId);
    const fib = parseFillBlankQuestionsFromContent(cleaned, file, courseCode, subjectId);
    const questions = [...mcq, ...fib];
    ensureUniqueQuestions(questions, seenUid, seenContent, file);
    allResults.push(...questions);
  }

  // Stable order by uid using natural numeric sorting (Q1, Q2, ..., Q10)
  allResults.sort((a, b) =>
    a.publicQuestion.uid.localeCompare(b.publicQuestion.uid, undefined, { numeric: true, sensitivity: 'base' })
  );

  const generatedAt = new Date().toISOString();
  const publicBank: BankPublicV1 = {
    version: "v1",
    subject: subjectId,
    generatedAt,
    questions: allResults.map((q) => q.publicQuestion)
  };
  const answersBank: BankAnswersV1 = {
    version: "v1",
    subject: subjectId,
    generatedAt,
    questions: allResults.map((q) => q.answerQuestion)
  };

  BankPublicV1Schema.parse(publicBank);
  BankAnswersV1Schema.parse(answersBank);

  return { publicBank, answersBank, questions: allResults };
}

async function parseCanvasZipToResults(
  zipPath: string,
  courseCode: string,
  subject: string
): Promise<ParseResult[]> {
  const buf = readFileSync(zipPath);
  const result = await importCanvasZipBytes(buf, {
    courseCode,
    subject,
    level: "basic",
    versionIndex: 0
  });

  const outputs: ParseResult[] = [];
  const canvasKey = result.answerKey as CanvasAnswerKey;

  for (const quiz of result.quizzes) {
    for (const q of quiz.questions) {
      const publicQuestion = q as QuestionPublicV1;
      const entry = canvasKey[publicQuestion.uid];
      if (publicQuestion.type === "mcq-single") {
        const answerQuestion: QuestionAnswersV1 = {
          ...(publicQuestion as any),
          answerKey: entry && entry.type === "mcq-single" ? entry.correctKey : "A",
          solution: entry && entry.type === "mcq-single" ? entry.solutionLatex ?? "" : ""
        };
        outputs.push({ publicQuestion, answerQuestion });
      } else if (publicQuestion.type === "fill-blank") {
        const answers =
          entry && entry.type === "fill-blank" && entry.acceptedAnswers ? entry.acceptedAnswers : [];
        const answerQuestion: QuestionAnswersV1 = {
          ...(publicQuestion as any),
          answers,
          solution: entry && entry.type === "fill-blank" ? entry.solutionLatex ?? "" : ""
        };
        outputs.push({ publicQuestion, answerQuestion });
      }
    }
  }

  return outputs;
}

async function run(): Promise<void> {
  const program = new Command();
  program.name("bank-gen").description("Generate bank JSON files from LaTeX sources");

  program.option("--sources-config <path>", "Path to sources config JSON (raw or exported)");
  program.option("--latex-assets-dir <path>", "Output directory for rendered LaTeX assets (PNG)");
  program.option("--latex-assets-base <url>", "Public base URL for rendered LaTeX assets");
  program.option("--language <lang>", "Language for exam generation (en or vi)", "vi");

  program.action(
    async (opts: {
      sourcesConfig?: string;
      latexAssetsDir?: string;
      latexAssetsBase?: string;
      language: string;
      labelData?: LabelMap;
    }) => {
      const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
      const language = (opts.language === "en" ? "en" : "vi") as "en" | "vi";

      let files: string[] = [];
      let canvasZips: string[] = [];
      let tempDir: string | null = null;
      let baseDirs: string[] = []; // Base directories for image assets
      let cfg: any = { courseCode: "MAT3500", subject: "discrete-math", subjects: [] };

      try {
        if (opts.sourcesConfig) {
          cfg = await loadSourcesConfigFile(resolve(opts.sourcesConfig));
          const downloaded = await downloadSourcesToTemp(cfg);
          tempDir = downloaded.tempDir;
          files = downloaded.texFiles;
          canvasZips = downloaded.canvasZipFiles;
          baseDirs = downloaded.baseDirs; // Get base directories for image assets
        } else {
          files = await fg("src/**/*.tex", { cwd: packageRoot, absolute: true });
          // For local files, use packageRoot as base dir (images are in packageRoot/figs/, etc.)
          baseDirs = [packageRoot];
        }

        const subjectsToBuild = cfg.subjects?.length
          ? cfg.subjects
          : [{ id: cfg.subject || "discrete-math", title: "Default Subject" }];

        for (const sub of subjectsToBuild) {
          console.log(`--- Building subject: ${sub.title} (${sub.id}) ---`);
          const subId = sub.id;
          const courseCode = cfg.courseCode;

          // Filter files/zips for this subject if they have subjectId set
          const subFiles = files.filter((f) => {
            // This is a bit tricky since downloadSourcesToTemp doesn't return metadata per file.
            // For now, if no subjectId is set on source, or it matches subId, include it.
            return true;
          });
          const subCanvasZips = canvasZips;

          let publicBank: BankPublicV1;
          let answersBank: BankAnswersV1;
          let questions: ParseResult[] = [];

          if (subFiles.length > 0) {
            const built = await buildBanksFromFiles(subFiles, courseCode, subId);
            const allQuestionsTexts = built.questions.map((q) => {
              let text = q.publicQuestion.prompt;
              if (q.publicQuestion.type === "mcq-single") {
                text += " " + (q.publicQuestion as any).choices.map((c: any) => c.text).join(" ");
              }
              if (q.answerQuestion.solution) {
                text += " " + q.answerQuestion.solution;
              }
              return text;
            });

            const labelData = collectSequentialLabels(allQuestionsTexts);
            const resolver = (value: string): string => replaceFigureReferences(value, labelData.labels, language);

            const normalized = built.questions.map((q) => applyFigureReferencesToQuestion(q, resolver));

            publicBank = {
              ...built.publicBank,
              questions: normalized.map((q) => q.publicQuestion)
            };
            answersBank = {
              ...built.answersBank,
              questions: normalized.map((q) => q.answerQuestion)
            };
            questions = normalized;
            (opts as any).labelData = labelData;
          } else {
            const generatedAt = new Date().toISOString();
            publicBank = { version: "v1", subject: subId, generatedAt, questions: [] };
            answersBank = { version: "v1", subject: subId, generatedAt, questions: [] };
          }

          if (subCanvasZips.length > 0) {
            const seenUid = new Map<string, string>();
            const seenContent = new Map<string, { uid: string; file: string; id: string }>();
            for (const q of questions) {
              seenUid.set(q.publicQuestion.uid, "latex");
              seenContent.set(getQuestionContentSignature(q.publicQuestion), {
                uid: q.publicQuestion.uid,
                file: "latex",
                id: q.publicQuestion.id
              });
            }

            const canvasResults: ParseResult[] = [];
            for (const zip of subCanvasZips) {
              const parsed = await parseCanvasZipToResults(zip, courseCode, subId);
              ensureUniqueQuestions(parsed, seenUid, seenContent, zip);
              canvasResults.push(...parsed);
            }

            const merged = [...questions, ...canvasResults];
            merged.sort((a, b) =>
              a.publicQuestion.uid.localeCompare(b.publicQuestion.uid, undefined, {
                numeric: true,
                sensitivity: "base"
              })
            );

            const generatedAt = new Date().toISOString();
            publicBank = { ...publicBank, generatedAt, questions: merged.map((q) => q.publicQuestion) };
            answersBank = { ...answersBank, generatedAt, questions: merged.map((q) => q.answerQuestion) };
            questions = merged;
          }

          if (opts.latexAssetsDir && opts.latexAssetsBase) {
            const rendered = await renderLatexAssets(publicBank, answersBank, {
              assetsDir: resolve(opts.latexAssetsDir),
              assetsBase: opts.latexAssetsBase,
              labelData: (opts as any).labelData,
              language,
              sourceAssetDirs: baseDirs.length > 0 ? baseDirs : undefined
            });
            publicBank = rendered.publicBank;
            answersBank = rendered.answersBank;
          }

          BankPublicV1Schema.parse(publicBank);
          BankAnswersV1Schema.parse(answersBank);
          writeBanks(publicBank, answersBank, subId);
          console.log(`Generated ${questions.length} questions for ${subId}`);
        }
      } finally {
        if (tempDir) {
          await cleanupTempDir(tempDir);
        }
      }
    }
  );

  await program.parseAsync(process.argv);
}

run().catch((err) => {
  console.error(err instanceof z.ZodError ? err.format() : err);
  process.exit(1);
});
