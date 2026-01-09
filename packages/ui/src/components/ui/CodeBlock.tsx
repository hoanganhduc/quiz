import { ReactNode } from "react";
import clsx from "clsx";

type Props = {
  children: ReactNode;
  className?: string;
};

export function CodeBlock({ children, className }: Props) {
  return (
    <pre
      className={clsx(
        "overflow-auto rounded-lg border border-border bg-slate-950/90 p-3 text-xs text-slate-100",
        className
      )}
    >
      <code>{children}</code>
    </pre>
  );
}
