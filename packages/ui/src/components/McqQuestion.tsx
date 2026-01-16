import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChoiceKey } from "@app/shared";
import type { ExamBankQuestion } from "../api";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import clsx from "clsx";
import { LatexContent } from "./LatexContent";

type Status = "unanswered" | "answered" | "correct" | "incorrect";

type Props = {
  index: number;
  question: ExamBankQuestion;
  answer?: string;
  onChange: (uid: string, value: string) => void;
  showSolution: boolean;
  submissionStatus?: "correct" | "incorrect";
};

export function McqQuestion({ index, question, answer, onChange, showSolution, submissionStatus }: Props) {
  if (question.type !== "mcq-single") {
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

  const choices = question.choices;
  const keys = choices.map((c) => c.key);
  const [focused, setFocused] = useState<ChoiceKey | null>(null);
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    setFocused(answer ? (answer as ChoiceKey) : null);
  }, [answer]);

  const onSelect = useCallback(
    (key: ChoiceKey) => {
      onChange(question.uid, key);
      setFocused(key);
    },
    [onChange, question.uid]
  );

  const badgeTone = status === "correct" ? "success" : status === "incorrect" ? "error" : status === "answered" ? "info" : "warn";
  const badgeLabel =
    status === "correct" ? "Correct" : status === "incorrect" ? "Incorrect" : status === "answered" ? "Answered" : "Unanswered";

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = focused ? keys.indexOf(focused) : -1;
      const letter = e.key.toUpperCase();
      if (/^[A-E]$/.test(letter)) {
        if (keys.includes(letter as ChoiceKey)) {
          e.preventDefault();
          onSelect(letter as ChoiceKey);
        }
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = currentIndex === -1 ? 0 : (currentIndex + 1) % keys.length;
        const key = keys[next];
        setFocused(key);
        optionRefs.current[key]?.focus();
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = currentIndex <= 0 ? keys.length - 1 : currentIndex - 1;
        const key = keys[prev];
        setFocused(key);
        optionRefs.current[key]?.focus();
      } else if (e.key === "Enter" || e.key === " ") {
        if (focused) {
          e.preventDefault();
          onSelect(focused);
        }
      }
    },
    [focused, keys, onSelect]
  );

  const answeredChoice = useMemo(() => answer, [answer]);

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

      <div
        role="radiogroup"
        aria-label={`Choices for question ${index + 1}`}
        onKeyDown={handleKey}
        className="space-y-2"
      >
        {choices.map((choice) => {
          const active = answeredChoice === choice.key;
          const isCorrect = "answerKey" in question && question.answerKey === choice.key;
          const showAsCorrect = showSolution && isCorrect;
          const showAsIncorrect = showSolution && active && !isCorrect;

          return (
            <button
              key={choice.key}
              ref={(el) => (optionRefs.current[choice.key] = el)}
              type="button"
              onClick={() => onSelect(choice.key)}
              className={clsx(
                "w-full text-left rounded-lg border px-3 py-3 flex gap-3 items-start focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2 transition-colors",
                showAsCorrect
                  ? "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600"
                  : showAsIncorrect
                    ? "border-red-500 bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-100 dark:border-red-600"
                    : active
                      ? "border-info bg-selectionBg text-selectionText"
                      : "border-border bg-muted/60 hover:border-info/50 dark:bg-slate-900/70",
                "min-h-[44px]"
              )}
            >
              <span className={clsx("font-semibold text-sm w-6 text-center", (showAsCorrect || showAsIncorrect || active) ? "text-inherit" : "text-text")}>{choice.key}.</span>
              <span className="text-sm leading-relaxed flex-1">
                <LatexContent inline content={choice.text} />
              </span>
              {showAsCorrect && (
                <span className="text-green-600 dark:text-green-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
              {showAsIncorrect && (
                <span className="text-red-600 dark:text-red-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {showSolution && "answerKey" in question && question.answerKey ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-info font-medium">View solution</summary>
          <div className="prose-solution mt-2">
            <div className="text-xs font-semibold text-textMuted uppercase tracking-wide">Solution</div>
            <div className="mt-2">
              <div className="text-sm">
                <span className="font-semibold">Answer:</span> {question.answerKey}
              </div>
              {question.solution ? (
                <div className="mt-2 text-sm leading-relaxed">
                  <LatexContent content={question.solution} />
                </div>
              ) : null}
            </div>
          </div>
        </details>
      ) : null}
    </Card>
  );
}
