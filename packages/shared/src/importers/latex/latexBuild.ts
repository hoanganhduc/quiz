import { ChoiceKey } from "../../index.js";
import { AnswerKey, ImportOptions, QuizJson } from "./latexParse.js";

const CHOICE_MACROS: Record<number, string> = {
  2: "\\haipa",
  3: "\\bapa",
  4: "\\bonpa",
  5: "\\nampa"
};

function keyToCorrectToken(key: ChoiceKey): string {
  return key;
}

function replaceUnderlines(
  prompt: string,
  blankCount: number,
  acceptedAnswers?: string[]
): string {
  const underline = "\\underline{\\qquad}";
  let out = "";
  let idx = 0;
  let used = 0;

  while (idx < prompt.length && used < blankCount) {
    const next = prompt.indexOf(underline, idx);
    if (next === -1) break;
    out += prompt.slice(idx, next);
    const answer = acceptedAnswers?.[used];
    if (answer && answer.length > 0) {
      out += `\\blank{${answer}}`;
    } else {
      out += "\\daugach{}";
    }
    used += 1;
    idx = next + underline.length;
  }

  out += prompt.slice(idx);
  return out;
}

export function buildLatexQuestions(
  quiz: QuizJson,
  answerKey: AnswerKey,
  opts: ImportOptions & { includeSolutions?: boolean }
): string {
  const lines: string[] = [];

  for (const q of quiz.questions) {
    if (q.type === "mcq-single") {
      const choices = q.choices ?? [];
      const macro = CHOICE_MACROS[choices.length] ?? "\\bonpa";
      const answer = answerKey[q.uid];
      const correctKey = answer && answer.type === "mcq-single" ? answer.correctKey : "A";
      const solution = answer && answer.type === "mcq-single" ? answer.solutionLatex ?? "" : "";

      const blockParts = [keyToCorrectToken(correctKey), ...choices.map((c: { text: string }) => c.text.trim())]
        .map((part) => `{${part}}`)
        .join("");
      const choicesBlock = `${macro}${blockParts}`;

      const solutionLatex = opts.includeSolutions === false ? "" : solution;
      lines.push(`\\baitracnghiem{${q.id}}{${q.prompt}}{${choicesBlock}}{${solutionLatex}}`);
      continue;
    }

    if (q.type === "fill-blank") {
      const answer = answerKey[q.uid];
      const answers = answer && answer.type === "fill-blank" ? answer.acceptedAnswers : undefined;
      const solution = answer && answer.type === "fill-blank" ? answer.solutionLatex ?? "" : "";
      const promptWithBlanks = replaceUnderlines(q.prompt, q.blankCount, answers);
      const solutionLatex = opts.includeSolutions === false ? "" : solution;
      lines.push(`\\baidienvao{${q.id}}{${promptWithBlanks}}{${solutionLatex}}`);
    }
  }

  return lines.join("\n");
}
