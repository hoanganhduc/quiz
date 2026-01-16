import { Badge } from "./Badge";
import { Button } from "./Button";
import { ProgressBar } from "./ProgressBar";
import { IconArrowUp, IconArrowDown } from "./Icons";
import clsx from "clsx";

type Props = {
  examId: string;
  subject: string;
  title?: string | null;
  progressPct: number;
  answered: number;
  total: number;
  status?: string;
  bankLoaded: boolean;
  onLoadQuestions: () => void;
  onClearAnswers: () => void;
  onSave: () => void;
  onSubmit: () => void;
  onScrollTop: () => void;
  onScrollBottom: () => void;
  onReviewUnanswered?: () => void;
  loadDisabled?: boolean;
  clearDisabled?: boolean;
  saveDisabled?: boolean;
  submitDisabled?: boolean;
  viewCode?: string;
  onViewCodeChange?: (v: string) => void;
  submitCode?: string;
  onSubmitCodeChange?: (v: string) => void;
  requireViewCode?: boolean;
  requireSubmitCode?: boolean;
  timeRemainingLabel?: string | null;
  timeExpired?: boolean;
};

export function StickyHeader({
  examId,
  subject,
  title,
  progressPct,
  answered,
  total,
  status,
  bankLoaded,
  onLoadQuestions,
  onClearAnswers,
  onSave,
  onSubmit,
  onScrollTop,
  onScrollBottom,
  onReviewUnanswered,
  loadDisabled,
  clearDisabled,
  saveDisabled,
  submitDisabled,
  viewCode,
  onViewCodeChange,
  submitCode,
  onSubmitCodeChange,
  requireViewCode,
  requireSubmitCode,
  timeRemainingLabel,
  timeExpired
}: Props) {
  return (
    <div className="sticky top-14 z-30 w-full border-b border-border bg-card/95 backdrop-blur-sm shadow-sm transition-all duration-200">
      <div className="mx-auto max-w-6xl px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left info: Title, Badge, Progress */}
          <div className="min-w-0 flex-1 flex items-center gap-4">
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 dark:text-neutral-400">Exam</span>
                <Badge tone={status === "error" ? "error" : "info"} className="text-[10px] uppercase py-0 px-1.5 h-auto">
                  {status ?? "In progress"}
                </Badge>
              </div>
              <div className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 truncate max-w-[200px]">
                {title || examId}
              </div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate max-w-[150px]">
                {subject}
              </div>
            </div>

            <div className="flex-1 max-w-[180px]">
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="font-medium text-neutral-600 dark:text-neutral-400">{answered}/{total} Answered</span>
                <div className="flex items-center gap-2">
                  {timeRemainingLabel && (
                    <span className={clsx("font-bold", timeExpired ? "text-error" : "text-neutral-700 dark:text-neutral-300")}>
                      {timeRemainingLabel}
                    </span>
                  )}
                  <span className="font-bold text-info">{Math.round(progressPct)}%</span>
                </div>
              </div>
              <ProgressBar value={progressPct} />
            </div>
          </div>

          {/* Right actions: Codes and Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            {!bankLoaded && requireViewCode && (
              <input
                type="text"
                value={viewCode || ""}
                onChange={(e) => onViewCodeChange?.(e.target.value)}
                placeholder="View code"
                className="h-8 w-24 rounded-md border border-border bg-bg px-2 text-xs focus:outline-none focus:ring-2 focus:ring-info outline-none"
              />
            )}

            {!bankLoaded ? (
              <Button variant="primary" size="sm" onClick={onLoadQuestions} disabled={loadDisabled}>
                Load questions
              </Button>
            ) : (
              <>
                {requireSubmitCode && total > 0 && (
                  <input
                    type="text"
                    value={submitCode || ""}
                    onChange={(e) => onSubmitCodeChange?.(e.target.value)}
                    placeholder="Submit code"
                    className="h-8 w-24 rounded-md border border-border bg-bg px-2 text-xs focus:outline-none focus:ring-2 focus:ring-info outline-none"
                  />
                )}
                <div className="flex items-center gap-1 border-r border-border pr-2 mr-1 h-8">
                  <Button variant="ghost" size="sm" onClick={onReviewUnanswered} className="h-7 text-xs px-2" disabled={answered === total}>
                    Review
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onClearAnswers} className="h-7 text-xs px-2 text-error hover:text-error" disabled={clearDisabled}>
                    Clear
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={onSave} disabled={saveDisabled}>
                    Save
                  </Button>
                  <Button variant="primary" size="sm" onClick={onSubmit} disabled={submitDisabled}>
                    Submit
                  </Button>
                </div>
              </>
            )}

            <div className="flex items-center gap-1 ml-1 pl-2 border-l border-border h-8">
              <button
                onClick={onScrollTop}
                className="p-1 text-neutral-500 hover:text-info hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                title="Scroll to Top"
              >
                <IconArrowUp className="w-5 h-5" />
              </button>
              <button
                onClick={onScrollBottom}
                className="p-1 text-neutral-500 hover:text-info hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                title="Scroll to Bottom"
              >
                <IconArrowDown className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
