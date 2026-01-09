import yauzl from "yauzl";
import { AnswerKey, ImportOptions, QuizJson } from "../latex/latexParse.js";
import { ImportedAsset } from "../shared/assets.js";
import { normalizeCanvasHtml, slugify } from "../shared/normalize.js";
import { parseManifest } from "./manifest.js";
import { parseAssessmentMeta } from "./meta.js";
import { parseQtiXml } from "./qtiParse.js";

export type CanvasImportResult = {
  quizzes: QuizJson[];
  answerKey: AnswerKey;
  assets: ImportedAsset[];
  warnings: string[];
};

function readZipEntries(zipPath: string): Promise<{ entries: string[]; buffers: Map<string, Buffer> }> {
  return new Promise((resolve, reject) => {
    const buffers = new Map<string, Buffer>();
    const entries: string[] = [];
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) {
        reject(err ?? new Error("Failed to open zip"));
        return;
      }
      zip.readEntry();
      zip.on("entry", (entry) => {
        if (entry.fileName.endsWith("/")) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (streamErr, stream) => {
          if (streamErr || !stream) {
            reject(streamErr ?? new Error("Failed to read zip entry"));
            return;
          }
          const chunks: Buffer[] = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("end", () => {
            const buffer = Buffer.concat(chunks);
            buffers.set(entry.fileName, buffer);
            entries.push(entry.fileName);
            zip.readEntry();
          });
          stream.on("error", reject);
        });
      });
      zip.on("end", () => resolve({ entries, buffers }));
      zip.on("error", reject);
    });
  });
}

function readZipEntriesFromBuffer(zipBytes: Buffer): Promise<{ entries: string[]; buffers: Map<string, Buffer> }> {
  return new Promise((resolve, reject) => {
    const buffers = new Map<string, Buffer>();
    const entries: string[] = [];
    yauzl.fromBuffer(zipBytes, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) {
        reject(err ?? new Error("Failed to open zip buffer"));
        return;
      }
      zip.readEntry();
      zip.on("entry", (entry) => {
        if (entry.fileName.endsWith("/")) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (streamErr, stream) => {
          if (streamErr || !stream) {
            reject(streamErr ?? new Error("Failed to read zip entry"));
            return;
          }
          const chunks: Buffer[] = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("end", () => {
            const buffer = Buffer.concat(chunks);
            buffers.set(entry.fileName, buffer);
            entries.push(entry.fileName);
            zip.readEntry();
          });
          stream.on("error", reject);
        });
      });
      zip.on("end", () => resolve({ entries, buffers }));
      zip.on("error", reject);
    });
  });
}

function mapChoicesToKeys(choices: { ident: string; text: string }[]): { key: string; text: string }[] {
  const keys = ["A", "B", "C", "D", "E"];
  return choices.map((choice, index) => ({ key: keys[index], text: choice.text }));
}

function findKeyForIdent(choices: { ident: string; text: string }[], ident?: string): string | undefined {
  if (!ident) return undefined;
  const keys = ["A", "B", "C", "D", "E"];
  const idx = choices.findIndex((c) => c.ident === ident);
  if (idx === -1) return undefined;
  return keys[idx];
}

function normalizePrompt(
  html: string,
  zipEntries: Map<string, Buffer>,
  assetsOut: Map<string, ImportedAsset>,
  warnings: string[]
): string {
  return normalizeCanvasHtml(html, { zipEntries, assetsOut, warnings });
}

function importFromBuffers(buffers: Map<string, Buffer>, opts: ImportOptions): CanvasImportResult {
  const warnings: string[] = [];
  const assetsMap = new Map<string, ImportedAsset>();
  const answerKey: AnswerKey = {};
  const quizzes: QuizJson[] = [];

  const manifestXml = buffers.get("imsmanifest.xml");
  if (!manifestXml) {
    throw new Error("imsmanifest.xml not found in ZIP");
  }
  const manifest = parseManifest(manifestXml.toString("utf8"));

  for (const resource of manifest.quizResources) {
    const qtiBuf = buffers.get(resource.qtiPath);
    if (!qtiBuf) {
      warnings.push(`Missing QTI file: ${resource.qtiPath}`);
      continue;
    }
    const metaBuf = resource.metaPath ? buffers.get(resource.metaPath) : undefined;
    const meta = metaBuf ? parseAssessmentMeta(metaBuf.toString("utf8")) : undefined;
    const title = meta?.title ?? resource.identifier;
    const topic = opts.topicByQuizTitle?.[title] ?? slugify(title) ?? "quiz";

    const items = parseQtiXml(qtiBuf.toString("utf8"));
    const questions: any[] = [];

    items.forEach((item, index) => {
      const number = index + 1;
      const id = `${topic}:q${String(number).padStart(2, "0")}`;
      const uid = `latex:${opts.courseCode}:${id}`;
      const prompt = normalizePrompt(item.promptHtml ?? "", buffers, assetsMap, warnings);
      const base = {
        uid,
        subject: opts.subject,
        id,
        topic,
        level: (opts.level ?? "basic") as "basic" | "advanced",
        number,
        prompt
      };

      if (item.questionType === "multiple_choice_question" || item.questionType === "true_false_question") {
        const choices = item.choices ?? [];
        const choiceEntries = mapChoicesToKeys(choices);
        const correctKey = findKeyForIdent(choices, item.correctIdent);
        if (!correctKey) warnings.push(`Missing correct choice for ${uid}`);

        questions.push({ ...base, type: "mcq-single", choices: choiceEntries });
        if (correctKey) {
          answerKey[uid] = {
            type: "mcq-single",
            correctKey: correctKey as any,
            points: item.pointsPossible
          };
        }
        return;
      }

      if (item.questionType === "short_answer_question") {
        let promptText = prompt;
        if (!promptText.includes("\\underline{\\qquad}")) {
          promptText = `${promptText} \\underline{\\qquad}`.trim();
        }
        const accepted = item.shortAnswers ?? [];
        questions.push({ ...base, type: "fill-blank", prompt: promptText, blankCount: 1 });
        answerKey[uid] = {
          type: "fill-blank",
          blankCount: 1,
          acceptedAnswers: accepted,
          points: item.pointsPossible
        };
        return;
      }

      if (item.questionType === "multiple_answers_question") {
        const choices = item.choices ?? [];
        const choiceEntries = mapChoicesToKeys(choices);
        const required = item.multiAnswer?.required ?? [];
        const correctKeys = required
          .map((ident) => findKeyForIdent(choices, ident))
          .filter(Boolean)
          .sort();
        const promptLines = [
          prompt,
          "",
          "Select ALL that apply. Write letters separated by commas:",
          ...choiceEntries.map((c) => `${c.key}) ${c.text}`),
          "Answer: \\underline{\\qquad}"
        ];
        questions.push({
          ...base,
          type: "fill-blank",
          prompt: promptLines.join("\n"),
          blankCount: 1
        });
        answerKey[uid] = {
          type: "fill-blank",
          blankCount: 1,
          acceptedAnswers: correctKeys.length > 0 ? [correctKeys.join(",")] : undefined,
          points: item.pointsPossible,
          notes: "multi-answer converted"
        };
        if (correctKeys.length === 0) {
          warnings.push(`Missing correct keys for ${uid}`);
        }
        return;
      }

      if (item.questionType === "fill_in_multiple_blanks_question") {
        const blanks = item.blanks ?? [];
        const placeholderMatches = prompt.match(/\[[A-Za-z0-9_-]+\]/g) ?? [];
        let maskedPrompt = prompt.replace(/\[[A-Za-z0-9_-]+\]/g, "\\underline{\\qquad}");
        if (placeholderMatches.length !== blanks.length) {
          warnings.push(`Placeholder count mismatch for ${uid}`);
        }

        const optionsLines: string[] = [];
        const correctKeys: string[] = [];
        blanks.forEach((blank, bIndex) => {
          const choiceEntries = mapChoicesToKeys(blank.choices);
          const correctKey = findKeyForIdent(blank.choices, blank.correctIdent);
          if (correctKey) correctKeys.push(correctKey);
          optionsLines.push(`Blank ${bIndex + 1} options:`);
          optionsLines.push(...choiceEntries.map((c) => `${c.key}) ${c.text}`));
        });

        if (optionsLines.length > 0) {
          maskedPrompt = `${maskedPrompt}\n\n${optionsLines.join("\n")}`;
        }

        questions.push({ ...base, type: "fill-blank", prompt: maskedPrompt, blankCount: blanks.length });
        answerKey[uid] = {
          type: "fill-blank",
          blankCount: blanks.length,
          acceptedAnswers: correctKeys,
          points: item.pointsPossible,
          notes: "multi-blank converted"
        };
        if (blanks.length === 0) warnings.push(`Missing blanks for ${uid}`);
        return;
      }

      warnings.push(`Unknown question_type '${item.questionType}' for ${uid}`);
    });

    const quiz: QuizJson = {
      version: { versionId: `canvas:${resource.identifier}`, versionIndex: opts.versionIndex ?? 0 },
      questions
    };
    quizzes.push(quiz);
  }

  return {
    quizzes,
    answerKey,
    assets: Array.from(assetsMap.values()),
    warnings
  };
}

export async function importCanvasZip(zipPath: string, opts: ImportOptions): Promise<CanvasImportResult> {
  const { buffers } = await readZipEntries(zipPath);
  return importFromBuffers(buffers, opts);
}

export async function importCanvasZipBytes(zipBytes: Buffer, opts: ImportOptions): Promise<CanvasImportResult> {
  const { buffers } = await readZipEntriesFromBuffer(zipBytes);
  return importFromBuffers(buffers, opts);
}
