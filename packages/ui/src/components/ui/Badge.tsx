import { ReactNode } from "react";
import clsx from "clsx";

type Tone = "info" | "warn" | "error" | "success" | "muted";

const toneClasses: Record<Tone, string> = {
  info: "bg-info/10 text-info border-info/30",
  warn: "bg-warn/10 text-warn border-warn/30",
  error: "bg-error/10 text-error border-error/30",
  success: "bg-success/10 text-success border-success/30",
  muted: "bg-muted text-text border-border"
};

export function Badge({ tone = "muted", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", toneClasses[tone], className)}>
      {children}
    </span>
  );
}
