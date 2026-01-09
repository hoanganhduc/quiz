import type { ReactNode } from "react";
import clsx from "clsx";
import { Button } from "./Button";

type Action = {
  label: string;
  onClick: () => void;
};

type Props = {
  icon?: ReactNode;
  title: string;
  description: string;
  primaryAction: Action;
  secondaryAction?: Action;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className
}: Props) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-border bg-card p-6 text-center",
        "flex flex-col items-center gap-2",
        className
      )}
    >
      {icon ? <div className="text-textMuted">{icon}</div> : null}
      <div className="text-base font-semibold text-text">{title}</div>
      <div className="text-sm text-textMuted max-w-md">{description}</div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={primaryAction.onClick}>{primaryAction.label}</Button>
        {secondaryAction ? (
          <Button variant="secondary" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
