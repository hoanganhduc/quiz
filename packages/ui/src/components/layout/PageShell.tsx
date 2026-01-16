import type { ReactNode } from "react";
import clsx from "clsx";
import { Footer } from "./Footer";

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
    <div className="bg-bg min-h-screen flex flex-col">
      <main className={clsx("mx-auto w-full px-3 sm:px-4 py-6 sm:py-8 flex-1", maxWidthClass[maxWidth], className)}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
