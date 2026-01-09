import { useEffect } from "react";
import clsx from "clsx";

export type ToastTone = "info" | "success" | "error" | "warn";

const toneClasses: Record<ToastTone, string> = {
  info: "border-info/40 bg-info/10 text-info",
  success: "border-success/40 bg-success/10 text-success",
  error: "border-error/40 bg-error/10 text-error",
  warn: "border-warn/40 bg-warn/10 text-warn"
};

type Props = {
  message: string;
  tone?: ToastTone;
  onDismiss: () => void;
  durationMs?: number;
};

export function Toast({ message, tone = "info", onDismiss, durationMs = 2600 }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, onDismiss]);

  return (
    <div
      className={clsx(
        "pointer-events-auto rounded-lg border px-3 py-2 text-sm shadow-lg",
        toneClasses[tone]
      )}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
