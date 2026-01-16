import { useCallback, useEffect, useMemo, useState } from "react";
import type { AnswerValueV1 } from "@app/shared";
import type { ExamBankQuestion } from "../api";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import clsx from "clsx";
import { LatexContent } from "./LatexContent";

type Status = "unanswered" | "answered" | "correct" | "incorrect";

type Props = {
  index: number;
  question: ExamBankQuestion;
  answer?: AnswerValueV1;
  onChange: (uid: string, value: string[]) => void;
  showSolution: boolean;
  submissionStatus?: "correct" | "incorrect";
};

export function FillBlankQuestion({
  index,
  question,
  answer,
  onChange,
  showSolution,
  submissionStatus
}: Props) {
  if (question.type !== "fill-blank") {
    return null;
  }

  const status: Status =
    submissionStatus === "correct"
      ? "correct"
      : submissionStatus === "incorrect"
        ? "incorrect"
        : answer
          ? "answered"
          : "unanswered";

  const [values, setValues] = useState<string[]>([]);

  useEffect(() => {
    if (Array.isArray(answer)) setValues(answer);
    else if (typeof answer === "string") setValues([answer]);
    else setValues([]);
  }, [answer]);

  const blankCount = question.blankCount;

  const onSet = useCallback(
    (idx: number, val: string) => {
      const next = Array.from({ length: blankCount }, (_, i) => (i === idx ? val : values[i] ?? ""));
      setValues(next);
      onChange(question.uid, next);
    },
    [blankCount, onChange, question.uid, values]
  );

  const badgeTone = status === "correct" ? "success" : status === "incorrect" ? "error" : status === "answered" ? "info" : "warn";
  const badgeLabel =
    status === "correct" ? "Correct" : status === "incorrect" ? "Incorrect" : status === "answered" ? "Answered" : "Unanswered";

  const hasSolutions = showSolution && "answers" in question && Array.isArray((question as any).answers);

  const expected = useMemo(() => (hasSolutions ? ((question as any).answers as string[]) : []), [hasSolutions, question]);

  return (
    <Card className="space-y-3" padding="md">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs text-slate-500">Question {index + 1}</div>
          <div className="font-semibold text-base leading-relaxed">
            <LatexContent content={question.prompt} />
          </div>
        </div>
        <Badge tone={badgeTone}>{badgeLabel}</Badge>
      </div>

      <div className="space-y-2">
        {Array.from({ length: blankCount }, (_, i) => (
          <label key={i} className="block">
            <div className="text-xs text-textMuted mb-1">Blank {i + 1}</div>
            <input
              className={clsx(
                "w-full rounded-lg border px-3 py-2 text-sm transition-colors",
                status === "correct"
                  ? "border-green-500 bg-green-50 text-green-900 focus:ring-green-500 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600"
                  : status === "incorrect"
                    ? "border-red-500 bg-red-50 text-red-900 focus:ring-red-500 dark:bg-red-900/20 dark:text-red-100 dark:border-red-600"
                    : "border-border bg-bg focus:ring-info",
                "focus:outline-none focus:ring-2 focus:ring-offset-2"
              )}
              value={values[i] ?? ""}
              onChange={(e) => onSet(i, e.target.value)}
              placeholder="Enter answer"
              disabled={status === "correct" || status === "incorrect"}
            />
          </label>
        ))}
      </div>

      {hasSolutions ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-info font-medium">View solution</summary>
          <div className="prose-solution mt-2">
            <div className="text-xs font-semibold text-textMuted uppercase tracking-wide">Solution</div>
            <div className="mt-2">
              <div className="text-sm">
                <span className="font-semibold">Expected:</span> {expected.join(", ")}
              </div>
              {"solution" in question && (question as any).solution ? (
                <div className="mt-2 text-sm leading-relaxed">
                  <LatexContent content={(question as any).solution} />
                </div>
              ) : null}
            </div>
          </div>
        </details>
      ) : null}
    </Card>
  );
}
