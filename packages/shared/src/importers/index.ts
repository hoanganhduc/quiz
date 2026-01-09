import { importCanvasZip, importCanvasZipBytes } from "./canvasQti/importCanvasZip.js";
import { exportCanvasZip } from "./canvasQti/ccBuild.js";
import { buildLatexQuestions } from "./latex/latexBuild.js";
import { parseLatexQuestions } from "./latex/latexParse.js";
import { AnswerKey, ImportOptions, QuizJson } from "./latex/latexParse.js";
import { ImportedAsset } from "./shared/assets.js";

export {
  importCanvasZip,
  importCanvasZipBytes,
  exportCanvasZip,
  buildLatexQuestions,
  parseLatexQuestions
};

export type { AnswerKey, ImportOptions, QuizJson, ImportedAsset };

export async function canvasZipToLatex(
  zipPath: string,
  opts: ImportOptions
): Promise<{ latexByQuizVersionId: Record<string, string>; answerKey: AnswerKey; assets: ImportedAsset[]; warnings: string[] }> {
  const result = await importCanvasZip(zipPath, opts);
  const latexByQuizVersionId: Record<string, string> = {};
  for (const quiz of result.quizzes) {
    latexByQuizVersionId[quiz.version.versionId] = buildLatexQuestions(quiz, result.answerKey, {
      ...opts,
      includeSolutions: true
    });
  }
  return { latexByQuizVersionId, answerKey: result.answerKey, assets: result.assets, warnings: result.warnings };
}

export async function latexToCanvasZip(
  tex: string,
  opts: ImportOptions & { quizTitle: string; topic: string }
): Promise<{ zipBytes: Buffer; quiz: QuizJson; answerKey: AnswerKey; warnings: string[] }> {
  const parsed = await parseLatexQuestions(tex, { ...opts, topic: opts.topic });
  const quiz: QuizJson = {
    version: { versionId: opts.quizTitle, versionIndex: opts.versionIndex ?? 0 },
    questions: parsed.quiz.questions
  };
  const zipBytes = await exportCanvasZip([quiz], parsed.answerKey, [], opts);
  return { zipBytes, quiz, answerKey: parsed.answerKey, warnings: parsed.warnings };
}
