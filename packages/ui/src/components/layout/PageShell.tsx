import type { ReactNode } from "react";
import clsx from "clsx";

type MaxWidth = "3xl" | "4xl" | "6xl";

const maxWidthClass: Record<MaxWidth, string> = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl"
};

type Props = {
  children: ReactNode;
  maxWidth?: MaxWidth;
  className?: string;
};

export function PageShell({ children, maxWidth = "6xl", className }: Props) {
  return (
    <div className="bg-bg">
      <div className={clsx("mx-auto w-full px-4 py-8", maxWidthClass[maxWidth], className)}>{children}</div>
    </div>
  );
}
