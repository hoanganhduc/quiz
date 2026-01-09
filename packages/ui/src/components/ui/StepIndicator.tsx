import clsx from "clsx";

export type StepStatus = "done" | "current" | "todo" | "optional";

export type Step = {
  title: string;
  description?: string;
  status: StepStatus;
};

function statusStyles(status: StepStatus) {
  switch (status) {
    case "done":
      return {
        dot: "bg-success text-white border-success",
        title: "text-text",
        desc: "text-textMuted"
      };
    case "current":
      return {
        dot: "bg-info text-white border-info",
        title: "text-text",
        desc: "text-textMuted"
      };
    case "optional":
      return {
        dot: "bg-muted text-text border-border",
        title: "text-text",
        desc: "text-textMuted"
      };
    case "todo":
    default:
      return {
        dot: "bg-card text-textMuted border-border",
        title: "text-textMuted",
        desc: "text-textMuted"
      };
  }
}

function Dot({ status, index }: { status: StepStatus; index: number }) {
  const s = statusStyles(status);
  return (
    <div
      className={clsx(
        "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
        s.dot
      )}
      aria-hidden
    >
      {status === "done" ? "✓" : index + 1}
    </div>
  );
}

export function StepIndicator({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol className={clsx("space-y-3", className)}>
      {steps.map((step, idx) => {
        const s = statusStyles(step.status);
        return (
          <li key={`${idx}-${step.title}`} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <Dot status={step.status} index={idx} />
              {idx < steps.length - 1 ? <div className="mt-2 h-6 w-px bg-border" aria-hidden /> : null}
            </div>

            <div className="min-w-0 pt-0.5">
              <div className={clsx("text-sm font-semibold", s.title)}>
                {step.title}
                {step.status === "optional" ? (
                  <span className="ml-2 text-xs font-medium text-textMuted">(optional)</span>
                ) : null}
              </div>
              {step.description ? <div className={clsx("text-sm", s.desc)}>{step.description}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
