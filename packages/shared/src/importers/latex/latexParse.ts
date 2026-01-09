import { ChoiceKey } from "../../index.js";

export type ImportOptions = {
  courseCode: string;
  subject: string;
  level?: string;
  versionIndex?: number;
  topicByQuizTitle?: Record<string, string>;
  fillBlankExportMode?: "combined_short_answer" | "split_items";
  combinedDelimiter?: string;
};

export type QuizJson = { version: { versionId: string; versionIndex: number }; questions: any[] };

export type AnswerKey = Record<
  string,
  | { type: "mcq-single"; correctKey: ChoiceKey; points?: number; solutionLatex?: string }
  | {
      type: "fill-blank";
      blankCount: number;
      acceptedAnswers?: string[];
      points?: number;
      solutionLatex?: string;
      notes?: string;
    }
>;

type ParsedQuestion = {
  uid: string;
  subject: string;
  type: "mcq-single" | "fill-blank";
  id: string;
  topic: string;
  level: "basic" | "advanced";
  number: number;
  prompt: string;
  choices?: { key: ChoiceKey; text: string }[];
  blankCount?: number;
};

function isEscaped(text: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (text[i] === "\\") backslashes += 1;
    else break;
  }
  return backslashes % 2 === 1;
}

export function stripLatexComments(text: string): string {
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

function parseGroup(text: string, startIndex: number): { content: string; end: number } {
  if (text[startIndex] !== "{") {
    throw new Error("Expected '{' while parsing group");
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
  throw new Error("Unbalanced braces while parsing group");
}

function parseBracketGroup(text: string, startIndex: number): { content: string; end: number } {
  if (text[startIndex] !== "[") {
    throw new Error("Expected '[' while parsing bracket group");
  }
  let depth = 0;
  for (let i = startIndex; i < text.length; i += 1) {
    const char = text[i];
    if (char === "[" && !isEscaped(text, i)) {
      depth += 1;
    } else if (char === "]" && !isEscaped(text, i)) {
      depth -= 1;
      if (depth === 0) {
        return { content: text.slice(startIndex + 1, i), end: i + 1 };
      }
    }
  }
  throw new Error("Unbalanced brackets while parsing group");
}

function parseQuestionId(id: string): { topic: string; level: "basic" | "advanced"; number: number } | null {
  const advancedMatch = /^advance([a-z0-9-]+):q(\d+)$/i.exec(id);
  if (advancedMatch) {
    const [, topic, num] = advancedMatch;
    return { topic, level: "advanced", number: parseInt(num, 10) };
  }
  const basicMatch = /^([a-z0-9-]+):q(\d+)$/i.exec(id);
  if (basicMatch) {
    const [, topic, num] = basicMatch;
    return { topic, level: "basic", number: parseInt(num, 10) };
  }
  return null;
}

function parseChoicesBlock(block: string, questionId: string): { correctKey: ChoiceKey; choices: { key: ChoiceKey; text: string }[] } {
  const trimmed = block.trim();
  const supported = [
    { cmd: "\\bonpa", n: 4 },
    { cmd: "\\haipa", n: 2 },
    { cmd: "\\bapa", n: 3 },
    { cmd: "\\nampa", n: 5 }
  ] as const;

  const match = supported.find((m) => trimmed.startsWith(m.cmd));
  if (!match) {
    throw new Error(`Expected one of ${supported.map((m) => m.cmd).join(", ")} in choices block`);
  }

  let idx = match.cmd.length;
  if (trimmed[idx] === "[") {
    const { end } = parseBracketGroup(trimmed, idx);
    idx = end;
  }

  const parts: string[] = [];
  for (let i = 0; i < match.n + 1; i += 1) {
    while (/\s/.test(trimmed[idx] ?? "")) idx += 1;
    if (trimmed[idx] !== "{") {
      throw new Error(`Expected '{' in ${match.cmd} block`);
    }
    const { content, end } = parseGroup(trimmed, idx);
    parts.push(content);
    idx = end;
  }

  const [correctRaw, ...choiceTexts] = parts;
  const correctToken = correctRaw.trim().toUpperCase();
  const keys = ["A", "B", "C", "D", "E"] as ChoiceKey[];

  let correctKey: ChoiceKey;
  if (keys.includes(correctToken as ChoiceKey)) {
    correctKey = correctToken as ChoiceKey;
  } else if (/^[1-5]$/.test(correctToken)) {
    correctKey = keys[Number(correctToken) - 1];
  } else {
    throw new Error(`Invalid correct choice '${correctRaw}' in ${questionId}`);
  }

  const allowedKeys = keys.slice(0, match.n);
  if (!allowedKeys.includes(correctKey)) {
    throw new Error(`Correct choice '${correctKey}' out of range for ${questionId}`);
  }

  const choices = choiceTexts.map((text, i) => ({
    key: allowedKeys[i],
    text: text.trim()
  }));

  return { correctKey, choices };
}

function extractInlineBlanks(promptRaw: string): { maskedPrompt: string; answers: string[]; foundAny: boolean } {
  const answers: string[] = [];
  const underline = "\\underline{\\qquad}";
  let out = "";
  let i = 0;
  let foundAny = false;

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
      out += nextCmd;
      i = nextIdx + nextCmd.length;
      continue;
    }

    foundAny = true;
    const { content, end } = parseGroup(promptRaw, pos);
    if (nextCmd === "\\blank" || nextCmd === "\\answer") {
      answers.push(content.trim());
    }
    out += underline;
    i = end;
  }

  return { maskedPrompt: out, answers, foundAny };
}

export async function parseLatexQuestions(
  tex: string,
  opts: ImportOptions & { topic?: string }
): Promise<{ quiz: QuizJson; answerKey: AnswerKey; warnings: string[] }> {
  const cleaned = stripLatexComments(tex);
  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];
  const answerKey: AnswerKey = {};
  const topics = new Set<string>();

  let i = 0;
  let depth = 0;
  const commands = ["\\baitracnghiem", "\\baidienvao"] as const;

  while (i < cleaned.length) {
    const ch = cleaned[i];
    if (ch === "{" && !isEscaped(cleaned, i)) depth += 1;
    if (ch === "}" && !isEscaped(cleaned, i)) depth -= 1;

    if (depth === 0) {
      const cmd = commands.find((c) => cleaned.startsWith(c, i));
      if (cmd) {
        if (cmd === "\\baitracnghiem") {
          let pos = i + cmd.length;
          const groups: string[] = [];
          for (let arg = 0; arg < 4; arg += 1) {
            while (/\s/.test(cleaned[pos] ?? "")) pos += 1;
            if (cleaned[pos] !== "{") {
              warnings.push(`Invalid \\baitracnghiem at index ${i}: missing argument ${arg + 1}`);
              break;
            }
            const { content, end } = parseGroup(cleaned, pos);
            groups.push(content);
            pos = end;
          }
          i = pos;
          if (groups.length !== 4) continue;

          const [id, promptRaw, choicesRaw, solutionRaw] = groups;
          const idInfo = parseQuestionId(id.trim());
          if (!idInfo) {
            warnings.push(`Invalid question id in \\baitracnghiem: ${id}`);
            continue;
          }

          const { correctKey, choices } = parseChoicesBlock(choicesRaw, id.trim());
          const uid = `latex:${opts.courseCode}:${id.trim()}`;
          topics.add(idInfo.topic);

          const question: ParsedQuestion = {
            uid,
            subject: opts.subject,
            type: "mcq-single",
            id: id.trim(),
            topic: idInfo.topic,
            level: idInfo.level,
            number: idInfo.number,
            prompt: promptRaw.trim(),
            choices
          };

          questions.push(question);
          answerKey[uid] = {
            type: "mcq-single",
            correctKey,
            solutionLatex: solutionRaw.trim()
          };
          continue;
        }

        if (cmd === "\\baidienvao") {
          let pos = i + cmd.length;
          let optionalCount = 0;
          while (optionalCount < 2) {
            while (/\s/.test(cleaned[pos] ?? "")) pos += 1;
            if (cleaned[pos] !== "[") break;
            const { end } = parseBracketGroup(cleaned, pos);
            pos = end;
            optionalCount += 1;
          }

          const groups: string[] = [];
          for (let arg = 0; arg < 3; arg += 1) {
            while (/\s/.test(cleaned[pos] ?? "")) pos += 1;
            if (cleaned[pos] !== "{") {
              warnings.push(`Invalid \\baidienvao at index ${i}: missing argument ${arg + 1}`);
              break;
            }
            const { content, end } = parseGroup(cleaned, pos);
            groups.push(content);
            pos = end;
          }
          i = pos;
          if (groups.length !== 3) continue;

          const [id, promptRaw, solutionRaw] = groups;
          const idInfo = parseQuestionId(id.trim());
          if (!idInfo) {
            warnings.push(`Invalid question id in \\baidienvao: ${id}`);
            continue;
          }

          const extracted = extractInlineBlanks(promptRaw);
          if (!extracted.foundAny || extracted.answers.length === 0) {
            warnings.push(`Fill-blank ${id.trim()} has no \\blank or \\answer macros`);
            continue;
          }

          const uid = `latex:${opts.courseCode}:${id.trim()}`;
          topics.add(idInfo.topic);

          const question: ParsedQuestion = {
            uid,
            subject: opts.subject,
            type: "fill-blank",
            id: id.trim(),
            topic: idInfo.topic,
            level: idInfo.level,
            number: idInfo.number,
            prompt: extracted.maskedPrompt.trim(),
            blankCount: extracted.answers.length
          };

          questions.push(question);
          answerKey[uid] = {
            type: "fill-blank",
            blankCount: extracted.answers.length,
            acceptedAnswers: extracted.answers,
            solutionLatex: solutionRaw.trim()
          };
          continue;
        }
      }
    }

    i += 1;
  }

  const versionTopic = opts.topic ?? (topics.size === 1 ? [...topics][0] : "mixed");
  const quiz: QuizJson = {
    version: { versionId: `latex:${opts.courseCode}:${versionTopic}`, versionIndex: opts.versionIndex ?? 0 },
    questions
  };

  return { quiz, answerKey, warnings };
}
