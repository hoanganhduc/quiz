import { XMLParser } from "fast-xml-parser";

export type AssessmentMeta = {
  title?: string;
  description?: string;
  points_possible?: number;
  shuffle_answers?: boolean;
  scoring_policy?: string;
  allowed_attempts?: number;
  one_question_at_a_time?: boolean;
  cant_go_back?: boolean;
  show_correct_answers?: boolean;
  one_time_results?: boolean;
  due_at?: string;
  unlock_at?: string;
  lock_at?: string;
};

function coerceBoolean(value: unknown): boolean | undefined {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}

function coerceNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function parseAssessmentMeta(xml: string): AssessmentMeta {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    parseTagValue: false,
    parseAttributeValue: false,
    removeNSPrefix: true
  });
  const doc = parser.parse(xml);
  const quiz = doc.quiz ?? doc;
  return {
    title: quiz?.title,
    description: quiz?.description,
    points_possible: coerceNumber(quiz?.points_possible),
    shuffle_answers: coerceBoolean(quiz?.shuffle_answers),
    scoring_policy: quiz?.scoring_policy,
    allowed_attempts: coerceNumber(quiz?.allowed_attempts),
    one_question_at_a_time: coerceBoolean(quiz?.one_question_at_a_time),
    cant_go_back: coerceBoolean(quiz?.cant_go_back),
    show_correct_answers: coerceBoolean(quiz?.show_correct_answers),
    one_time_results: coerceBoolean(quiz?.one_time_results),
    due_at: quiz?.due_at,
    unlock_at: quiz?.unlock_at,
    lock_at: quiz?.lock_at
  };
}
