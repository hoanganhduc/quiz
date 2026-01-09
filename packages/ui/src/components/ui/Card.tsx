import { ReactNode } from "react";
import clsx from "clsx";

type CardProps = {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md";
};

export function Card({ children, className, padding = "md" }: CardProps) {
  const pad = padding === "none" ? "" : padding === "sm" ? "p-3" : "p-4";
  return <div className={clsx("rounded-xl bg-card shadow-card border border-border", pad, className)}>{children}</div>;
}
