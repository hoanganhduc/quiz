import { ProgressBar } from "./ProgressBar";
import { Badge } from "./Badge";
import { Card } from "./Card";

type Props = {
  examId: string;
  subject: string;
  title?: string | null;
  progressPct: number;
  answered: number;
  total: number;
  status?: string;
};

export function StickyHeader({ examId, subject, title, progressPct, answered, total, status }: Props) {
  return (
    <div className="sticky top-14 z-30 backdrop-blur bg-bg/90 border-b border-border">
      <Card padding="sm" className="flex flex-col gap-2 shadow-none border-none">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-xs uppercase text-neutral-500 dark:text-neutral-400">Exam</div>
            <div className="font-semibold text-base text-neutral-900 dark:text-neutral-100">{title || examId}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">{subject}</div>
          </div>
          <Badge tone={status === "error" ? "error" : "info"}>{status ?? "In progress"}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-neutral-600 dark:text-neutral-300">
            {answered}/{total} answered
          </div>
          <div className="flex-1">
            <ProgressBar value={progressPct} />
          </div>
          <div className="text-xs font-medium text-neutral-700 dark:text-neutral-200">{Math.round(progressPct)}%</div>
        </div>
      </Card>
    </div>
  );
}
