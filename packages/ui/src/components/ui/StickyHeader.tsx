import { ProgressBar } from "./ProgressBar";
import { Badge } from "./Badge";
import { Card } from "./Card";
import { Button } from "./Button";

type Props = {
  examId: string;
  subject: string;
  title?: string | null;
  progressPct: number;
  answered: number;
  total: number;
  status?: string;
  bankLoaded: boolean;
  onLoadQuestions?: () => void;
  onClearAnswers?: () => void;
  onSave?: () => void;
  onSubmit?: () => void;
  onScrollTop?: () => void;
  onScrollBottom?: () => void;
  loadDisabled?: boolean;
  clearDisabled?: boolean;
  saveDisabled?: boolean;
  submitDisabled?: boolean;
};

export function StickyHeader({
  examId,
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
  loadDisabled,
  clearDisabled,
  saveDisabled,
  submitDisabled
}: Props) {
  return (
    <div className="sticky top-14 z-30 backdrop-blur bg-bg/90 border-b border-border">
      <Card padding="sm" className="flex flex-col gap-2 shadow-none border-none">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 dark:text-neutral-400">Exam</span>
              <Badge tone={status === "error" ? "error" : "info"} className="text-[10px] uppercase py-0 px-1.5 h-auto">
                {status ?? "In progress"}
              </Badge>
            </div>
            <div className="font-semibold text-sm sm:text-base text-neutral-900 dark:text-neutral-100 truncate">
              {title || examId}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
            {!bankLoaded ? (
              <Button variant="primary" size="sm" onClick={onLoadQuestions} disabled={loadDisabled}>
                Load questions
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={onClearAnswers} disabled={clearDisabled} title="Clear all answers">
                  Clear
                </Button>
                <Button variant="secondary" size="sm" onClick={onSave} disabled={saveDisabled}>
                  Save
                </Button>
                <Button variant="primary" size="sm" onClick={onSubmit} disabled={submitDisabled}>
                  Submit
                </Button>
                <div className="h-4 w-px bg-border mx-0.5 hidden sm:block" />
                <Button variant="ghost" size="sm" onClick={onScrollTop} title="Scroll to top" className="px-2">
                  ↑
                </Button>
                <Button variant="ghost" size="sm" onClick={onScrollBottom} title="Scroll to bottom" className="px-2">
                  ↓
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[11px] text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
            {answered}/{total} answered
          </div>
          <div className="flex-1">
            <ProgressBar value={progressPct} />
          </div>
          <div className="text-[11px] font-bold text-neutral-700 dark:text-neutral-200">
            {Math.round(progressPct)}%
          </div>
        </div>
      </Card>
    </div>
  );
}
