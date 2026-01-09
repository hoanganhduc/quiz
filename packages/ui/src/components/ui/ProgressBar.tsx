import clsx from "clsx";

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={clsx("w-full rounded-full bg-muted h-2", className)} aria-label="Completion progress">
      <div className="h-2 rounded-full bg-info transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}
