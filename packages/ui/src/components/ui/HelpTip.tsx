import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";

type Props = {
  text: string;
  className?: string;
  buttonLabel?: string;
};

export function HelpTip({ text, className, buttonLabel = "Help" }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        btnRef.current?.focus();
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={clsx("relative inline-flex", className)}>
      <button
        ref={btnRef}
        type="button"
        className={clsx(
          "inline-flex h-6 w-6 items-center justify-center rounded-full",
          "border border-border bg-card text-textMuted hover:bg-muted",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        )}
        aria-label={buttonLabel}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>

      {open ? (
        <span
          id={`${id}-panel`}
          role="tooltip"
          className={clsx(
            "absolute right-0 top-full mt-2 w-[260px] max-w-[80vw]",
            "rounded-lg border border-border bg-card p-3 text-sm text-text shadow-card"
          )}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
